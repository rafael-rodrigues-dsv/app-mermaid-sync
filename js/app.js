/**
 * App principal - conecta o diagrama Mermaid com o Flow Executor e Mock Server.
 */
(async () => {
    // ═══════════════════════════════════════════════════════════
    // Registry de flows disponíveis
    // ═══════════════════════════════════════════════════════════
    const FLOWS = [AuthFlow, OrderFlow, UserCrudFlow, QueueFlow, DatabaseFlow, FullIntegrationFlow];

    // ═══════════════════════════════════════════════════════════
    // DOM Elements
    // ═══════════════════════════════════════════════════════════
    const flowSelect = document.getElementById('flowSelect');
    const btnRun = document.getElementById('btnRun');
    const btnStep = document.getElementById('btnStep');
    const btnReset = document.getElementById('btnReset');
    const speedRange = document.getElementById('speedRange');
    const speedLabel = document.getElementById('speedLabel');
    const diagramContainer = document.getElementById('mermaidDiagram');
    const flowInfo = document.getElementById('flowInfo');
    const flowTitle = document.getElementById('flowTitle');
    const flowDescription = document.getElementById('flowDescription');
    const stepDetail = document.getElementById('stepDetail');
    const requestInfo = document.getElementById('requestInfo');
    const responseInfo = document.getElementById('responseInfo');
    const logEntries = document.getElementById('logEntries');

    let selectedFlow = null;
    let stepMode = false;

    // ═══════════════════════════════════════════════════════════
    // Inicializar Mermaid
    // ═══════════════════════════════════════════════════════════
    mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
            darkMode: true,
            background: '#161b22',
            primaryColor: '#21262d',
            primaryTextColor: '#c9d1d9',
            primaryBorderColor: '#30363d',
            lineColor: '#8b949e',
            secondaryColor: '#1f6feb',
            tertiaryColor: '#161b22',
            fontFamily: 'Segoe UI, sans-serif'
        },
        sequence: {
            useMaxWidth: true,
            showSequenceNumbers: false,
            actorMargin: 50,
            messageMargin: 40,
            mirrorActors: true,
            wrap: true
        }
    });

    // ═══════════════════════════════════════════════════════════
    // Ativar Mock Server
    // ═══════════════════════════════════════════════════════════
    MockServer.activate();

    // ═══════════════════════════════════════════════════════════
    // Popular select com flows
    // ═══════════════════════════════════════════════════════════
    FLOWS.forEach(flow => {
        const option = document.createElement('option');
        option.value = flow.id;
        option.textContent = flow.name;
        flowSelect.appendChild(option);
    });

    // ═══════════════════════════════════════════════════════════
    // Renderizar diagrama Mermaid
    // ═══════════════════════════════════════════════════════════
    async function renderDiagram(flow) {
        diagramContainer.innerHTML = '';
        const diagramId = 'mermaid-' + Date.now();
        try {
            const { svg } = await mermaid.render(diagramId, flow.diagram);
            diagramContainer.innerHTML = svg;
            buildMessageIndexMap(flow);
            tagMessages();
        } catch (err) {
            diagramContainer.innerHTML = `<p style="color:#f85149;">Erro ao renderizar diagrama: ${err.message}</p>`;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Sequence diagram message highlighting
    // ═══════════════════════════════════════════════════════════
    let messageIndexMap = []; // maps step index to {start, end} message indices

    function buildMessageIndexMap(flow) {
        messageIndexMap = [];
        let currentIndex = 0;
        flow.steps.forEach(step => {
            const count = step.messageCount || 1;
            messageIndexMap.push({ start: currentIndex, end: currentIndex + count - 1 });
            currentIndex += count;
        });
    }

    function tagMessages() {
        const svg = diagramContainer.querySelector('svg');
        if (!svg) return;
        const texts = svg.querySelectorAll('.messageText');
        texts.forEach((text, i) => text.setAttribute('data-msg-index', i));
        const lines = svg.querySelectorAll('.messageLine0, .messageLine1');
        lines.forEach((line, i) => line.setAttribute('data-msg-index', i));
    }

    function setMessageState(stepIndex, state) {
        if (stepIndex < 0 || stepIndex >= messageIndexMap.length) return;
        const { start, end } = messageIndexMap[stepIndex];
        const svg = diagramContainer.querySelector('svg');
        if (!svg) return;

        for (let i = start; i <= end; i++) {
            svg.querySelectorAll(`[data-msg-index="${i}"]`).forEach(el => {
                el.classList.remove('msg-running', 'msg-success', 'msg-error', 'msg-pending');
                if (state) el.classList.add('msg-' + state);
            });
        }
    }

    function resetAllMessages() {
        const svg = diagramContainer.querySelector('svg');
        if (!svg) return;
        svg.querySelectorAll('.msg-running, .msg-success, .msg-error, .msg-pending').forEach(el => {
            el.classList.remove('msg-running', 'msg-success', 'msg-error', 'msg-pending');
        });
    }

    function setAllMessagesPending() {
        if (!selectedFlow) return;
        for (let i = 0; i < selectedFlow.steps.length; i++) {
            setMessageState(i, 'pending');
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Logging
    // ═══════════════════════════════════════════════════════════
    function addLog(type, message) {
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        const time = new Date().toLocaleTimeString('pt-BR', { hour12: false });
        entry.innerHTML = `<span class="timestamp">[${time}]</span>${escapeHtml(message)}`;
        logEntries.appendChild(entry);
        logEntries.scrollTop = logEntries.scrollHeight;
    }

    function clearLog() {
        logEntries.innerHTML = '';
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ═══════════════════════════════════════════════════════════
    // Flow Executor Callbacks
    // ═══════════════════════════════════════════════════════════
    FlowExecutor.setCallbacks({
        stepStart(step, reqInfo) {
            const stepIdx = selectedFlow ? selectedFlow.steps.indexOf(step) : -1;
            setMessageState(stepIdx, 'running');
            stepDetail.classList.remove('hidden');
            requestInfo.textContent = JSON.stringify(reqInfo, null, 2);
            responseInfo.textContent = '⏳ Aguardando resposta...';

            // Auto-scroll to highlighted messages
            const svg = diagramContainer.querySelector('svg');
            if (svg && stepIdx >= 0 && messageIndexMap[stepIdx]) {
                const firstMsg = svg.querySelector(`[data-msg-index="${messageIndexMap[stepIdx].start}"]`);
                if (firstMsg) firstMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        },
        stepEnd(step, status, reqInfo, resInfo) {
            const stepIdx = selectedFlow ? selectedFlow.steps.indexOf(step) : -1;
            setMessageState(stepIdx, status);
            responseInfo.textContent = JSON.stringify(resInfo, null, 2);
        },
        flowEnd(flow, context) {
            setButtons('finished');
            addLog('info', '────────────────────────────');
            addLog('info', '📊 Contexto final:');
            addLog('info', JSON.stringify(context, null, 2));
        },
        log(type, message) {
            addLog(type, message);
        }
    });

    // ═══════════════════════════════════════════════════════════
    // Controle de botões
    // ═══════════════════════════════════════════════════════════
    function setButtons(state) {
        switch (state) {
            case 'idle':
                btnRun.disabled = !selectedFlow;
                btnStep.disabled = !selectedFlow;
                btnReset.disabled = true;
                btnRun.textContent = '▶ Executar Flow';
                btnStep.textContent = '⏭ Step-by-Step';
                break;
            case 'running':
                btnRun.disabled = true;
                btnStep.disabled = true;
                btnReset.disabled = false;
                btnRun.textContent = '⏳ Executando...';
                break;
            case 'stepping':
                btnRun.disabled = true;
                btnStep.disabled = false;
                btnReset.disabled = false;
                btnStep.textContent = '⏭ Próximo Step';
                break;
            case 'finished':
                btnRun.disabled = true;
                btnStep.disabled = true;
                btnReset.disabled = false;
                btnRun.textContent = '✅ Concluído';
                break;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Event Handlers
    // ═══════════════════════════════════════════════════════════
    flowSelect.addEventListener('change', async () => {
        const flowId = flowSelect.value;
        selectedFlow = FLOWS.find(f => f.id === flowId) || null;

        if (selectedFlow) {
            await renderDiagram(selectedFlow);
            flowInfo.classList.remove('hidden');
            flowTitle.textContent = selectedFlow.name;
            flowDescription.textContent = selectedFlow.description;
            setButtons('idle');
        } else {
            diagramContainer.innerHTML = '<p style="color:#8b949e;text-align:center;padding:2rem;">Selecione um flow para visualizar</p>';
            flowInfo.classList.add('hidden');
            setButtons('idle');
        }

        stepDetail.classList.add('hidden');
        clearLog();
        FlowExecutor.reset();
        stepMode = false;
    });

    btnRun.addEventListener('click', async () => {
        if (!selectedFlow) return;
        stepMode = false;
        clearLog();
        resetAllMessages();
        setAllMessagesPending();
        setButtons('running');
        FlowExecutor.setDelay(parseInt(speedRange.value));
        await FlowExecutor.run(selectedFlow);
    });

    btnStep.addEventListener('click', async () => {
        if (!selectedFlow) return;

        if (!stepMode) {
            stepMode = true;
            clearLog();
            resetAllMessages();
            setAllMessagesPending();
            FlowExecutor.prepareForStepping(selectedFlow);
            setButtons('stepping');
        }

        await FlowExecutor.stepOnce();

        const state = FlowExecutor.getState();
        if (state.currentStepIndex >= state.totalSteps - 1) {
            setButtons('finished');
            addLog('info', '────────────────────────────');
            addLog('info', '📊 Contexto final:');
            addLog('info', JSON.stringify(state.context, null, 2));
        }
    });

    btnReset.addEventListener('click', async () => {
        FlowExecutor.stop();
        FlowExecutor.reset();
        stepMode = false;
        clearLog();
        stepDetail.classList.add('hidden');

        if (selectedFlow) {
            await renderDiagram(selectedFlow);
            setButtons('idle');
        }
    });

    speedRange.addEventListener('input', () => {
        const val = parseInt(speedRange.value);
        speedLabel.textContent = (val / 1000).toFixed(1) + 's';
        FlowExecutor.setDelay(val);
    });

    // ═══════════════════════════════════════════════════════════
    // Init
    // ═══════════════════════════════════════════════════════════
    diagramContainer.innerHTML = '<p style="color:#8b949e;text-align:center;padding:2rem;">👆 Selecione um flow para começar</p>';
    setButtons('idle');
})();
