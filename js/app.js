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
    const badgeSteps = document.getElementById('badgeSteps');
    const badgeStatus = document.getElementById('badgeStatus');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const diagramBadges = document.getElementById('diagramBadges');

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
            background: '#0a0e14',
            primaryColor: '#1c2533',
            primaryTextColor: '#e2e8f0',
            primaryBorderColor: '#1e2a3a',
            lineColor: '#556677',
            secondaryColor: '#1f6feb',
            tertiaryColor: '#111820',
            fontFamily: 'Inter, Segoe UI, sans-serif',
            noteBkgColor: '#1c253380',
            noteTextColor: '#8899aa',
            noteBorderColor: '#263345',
            actorBkg: '#171f2a',
            actorBorder: '#263345',
            actorTextColor: '#e2e8f0',
            activationBkgColor: '#1f6feb33',
            activationBorderColor: '#1f6feb',
            sequenceNumberColor: '#58a6ff'
        },
        sequence: {
            useMaxWidth: true,
            showSequenceNumbers: false,
            actorMargin: 50,
            messageMargin: 35,
            mirrorActors: true,
            wrap: true,
            bottomMarginAdj: 10
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
    // Status / Progress helpers
    // ═══════════════════════════════════════════════════════════
    function updateBadges(stepsCount, statusText, statusClass) {
        badgeSteps.textContent = stepsCount + ' steps';
        badgeStatus.textContent = statusText;
        badgeStatus.className = 'badge badge-' + statusClass;
    }

    function updateProgress(current, total) {
        const pct = total > 0 ? Math.round((current / total) * 100) : 0;
        progressFill.style.width = pct + '%';
        progressText.textContent = current + '/' + total;
    }

    function renderDiagramBadges(flow) {
        if (!diagramBadges) return;
        // Extract unique component types from the diagram
        const diagram = flow.diagram || '';
        const techs = [];
        if (/PostgreSQL|PG/i.test(diagram)) techs.push({ label: 'PostgreSQL', color: '#336791' });
        if (/MongoDB|Mongo/i.test(diagram)) techs.push({ label: 'MongoDB', color: '#4db33d' });
        if (/Redis/i.test(diagram)) techs.push({ label: 'Redis', color: '#dc382d' });
        if (/RabbitMQ|Queue/i.test(diagram)) techs.push({ label: 'RabbitMQ', color: '#ff6600' });
        if (/Payment|Pay|Pagamento/i.test(diagram)) techs.push({ label: 'Payment', color: '#8b5cf6' });
        if (/Email|Push|Notif/i.test(diagram)) techs.push({ label: 'Notify', color: '#6366f1' });
        if (/CEP|Shipping|Exchange|Credit|Externa/i.test(diagram)) techs.push({ label: 'External API', color: '#06b6d4' });
        diagramBadges.innerHTML = techs.map(t =>
            `<span class="badge" style="background:${t.color}22;color:${t.color};border:1px solid ${t.color}44;font-size:0.6rem">${t.label}</span>`
        ).join('');
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
            updateProgress(stepIdx + 1, selectedFlow ? selectedFlow.steps.length : 0);

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
            updateBadges(flow.steps.length, 'Done', 'green');
            updateProgress(flow.steps.length, flow.steps.length);
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
        const totalSteps = selectedFlow ? selectedFlow.steps.length : 0;
        switch (state) {
            case 'idle':
                btnRun.disabled = !selectedFlow;
                btnStep.disabled = !selectedFlow;
                btnReset.disabled = true;
                btnRun.querySelector('span').textContent = 'Run';
                btnStep.querySelector('span').textContent = 'Step';
                updateBadges(totalSteps, 'Idle', 'blue');
                updateProgress(0, totalSteps);
                break;
            case 'running':
                btnRun.disabled = true;
                btnStep.disabled = true;
                btnReset.disabled = false;
                btnRun.querySelector('span').textContent = 'Running...';
                updateBadges(totalSteps, 'Running', 'yellow');
                break;
            case 'stepping':
                btnRun.disabled = true;
                btnStep.disabled = false;
                btnReset.disabled = false;
                btnStep.querySelector('span').textContent = 'Next';
                updateBadges(totalSteps, 'Stepping', 'yellow');
                break;
            case 'finished':
                btnRun.disabled = true;
                btnStep.disabled = true;
                btnReset.disabled = false;
                btnRun.querySelector('span').textContent = 'Done';
                updateBadges(totalSteps, 'Done', 'green');
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
            renderDiagramBadges(selectedFlow);
            flowInfo.classList.remove('hidden');
            flowTitle.textContent = selectedFlow.name;
            flowDescription.textContent = selectedFlow.description;
            setButtons('idle');
        } else {
            diagramContainer.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:3rem;font-size:0.9rem;">Selecione um diagrama de arquitetura</p>';
            if (diagramBadges) diagramBadges.innerHTML = '';
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
            renderDiagramBadges(selectedFlow);
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
    diagramContainer.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:3rem;font-size:0.9rem;">Selecione um diagrama de arquitetura</p>';
    setButtons('idle');
})();
