/**
 * App principal - conecta o diagrama Mermaid com o Flow Executor e Mock Server.
 */
(async () => {
    // ═══════════════════════════════════════════════════════════
    // Registry de flows disponíveis
    // ═══════════════════════════════════════════════════════════
    const FLOWS = [AuthFlow, OrderFlow, UserCrudFlow];

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
        flowchart: {
            htmlLabels: true,
            curve: 'basis',
            useMaxWidth: true,
            padding: 15
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
        } catch (err) {
            diagramContainer.innerHTML = `<p style="color:#f85149;">Erro ao renderizar diagrama: ${err.message}</p>`;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Highlight de nós do diagrama
    // ═══════════════════════════════════════════════════════════
    function setNodeState(nodeId, state) {
        // Remove previous state classes
        const svg = diagramContainer.querySelector('svg');
        if (!svg) return;

        // Mermaid wraps nodes in elements with data-id or id containing the node name
        const allNodes = svg.querySelectorAll('.node');
        allNodes.forEach(node => {
            const nodeText = node.getAttribute('id') || '';
            const dataId = node.getAttribute('data-id') || '';
            // Match by node id in the mermaid graph
            if (nodeText.includes(nodeId) || dataId.includes(nodeId) ||
                nodeText.startsWith('flowchart-' + nodeId + '-')) {
                node.classList.remove('node-running', 'node-success', 'node-error', 'node-pending');
                if (state) {
                    node.classList.add('node-' + state);
                }
            }
        });
    }

    function resetAllNodes() {
        const svg = diagramContainer.querySelector('svg');
        if (!svg) return;
        svg.querySelectorAll('.node').forEach(node => {
            node.classList.remove('node-running', 'node-success', 'node-error', 'node-pending');
        });
    }

    function setAllNodesPending(flow) {
        flow.steps.forEach(step => setNodeState(step.id, 'pending'));
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
            setNodeState(step.id, 'running');
            stepDetail.classList.remove('hidden');
            requestInfo.textContent = JSON.stringify(reqInfo, null, 2);
            responseInfo.textContent = '⏳ Aguardando resposta...';
        },
        stepEnd(step, status, reqInfo, resInfo) {
            setNodeState(step.id, status);
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
        resetAllNodes();
        setAllNodesPending(selectedFlow);
        setButtons('running');
        FlowExecutor.setDelay(parseInt(speedRange.value));
        await FlowExecutor.run(selectedFlow);
    });

    btnStep.addEventListener('click', async () => {
        if (!selectedFlow) return;

        if (!stepMode) {
            stepMode = true;
            clearLog();
            resetAllNodes();
            setAllNodesPending(selectedFlow);
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
