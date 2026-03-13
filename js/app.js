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
    const canvasArea = document.getElementById('canvasArea');
    const sbFlowName = document.getElementById('sbFlowName');
    const sbZoom = document.getElementById('sbZoom');
    const zoomRange = document.getElementById('zoomRange');

    let selectedFlow = null;
    let stepMode = false;
    let currentZoom = 100;

    // ═══════════════════════════════════════════════════════════
    // Inicializar Mermaid — Visio light theme
    // ═══════════════════════════════════════════════════════════
    mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        themeVariables: {
            background: '#ffffff',
            primaryColor: '#deecf9',
            primaryTextColor: '#323130',
            primaryBorderColor: '#c8c6c4',
            lineColor: '#605e5c',
            secondaryColor: '#185abd',
            tertiaryColor: '#f3f2f1',
            fontFamily: 'Inter, Segoe UI, sans-serif',
            noteBkgColor: '#fff4ce',
            noteTextColor: '#605e5c',
            noteBorderColor: '#e1dfdd',
            actorBkg: '#deecf9',
            actorBorder: '#185abd',
            actorTextColor: '#323130',
            activationBkgColor: '#deecf980',
            activationBorderColor: '#185abd',
            sequenceNumberColor: '#185abd'
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
    // Visio Rulers
    // ═══════════════════════════════════════════════════════════
    function drawRulers() {
        const hCanvas = document.getElementById('rulerH');
        const vCanvas = document.getElementById('rulerV');
        if (!hCanvas || !vCanvas) return;

        // Horizontal ruler
        const hRect = hCanvas.parentElement.getBoundingClientRect();
        hCanvas.width = hRect.width;
        const hCtx = hCanvas.getContext('2d');
        hCtx.fillStyle = '#edebe9';
        hCtx.fillRect(0, 0, hCanvas.width, 20);
        hCtx.strokeStyle = '#c8c6c4';
        hCtx.fillStyle = '#a19f9d';
        hCtx.font = '9px Inter, Segoe UI, sans-serif';
        hCtx.textAlign = 'center';
        const scrollX = canvasArea ? canvasArea.scrollLeft : 0;
        for (let x = 0; x < hCanvas.width + scrollX; x += 24) {
            const px = x - (scrollX % 24);
            if (px < 0) continue;
            const tick = Math.round((x + Math.floor(scrollX / 24) * 24 - (scrollX % 24 > 0 ? 0 : 0)) / 24);
            if (tick % 4 === 0) {
                hCtx.beginPath();
                hCtx.moveTo(px, 12);
                hCtx.lineTo(px, 20);
                hCtx.stroke();
                if (tick % 8 === 0) {
                    hCtx.fillText(String(tick), px, 10);
                }
            } else {
                hCtx.beginPath();
                hCtx.moveTo(px, 16);
                hCtx.lineTo(px, 20);
                hCtx.stroke();
            }
        }

        // Vertical ruler
        const vRect = vCanvas.parentElement.getBoundingClientRect();
        vCanvas.height = vRect.height;
        const vCtx = vCanvas.getContext('2d');
        vCtx.fillStyle = '#edebe9';
        vCtx.fillRect(0, 0, 20, vCanvas.height);
        vCtx.strokeStyle = '#c8c6c4';
        vCtx.fillStyle = '#a19f9d';
        vCtx.font = '9px Inter, Segoe UI, sans-serif';
        vCtx.textAlign = 'center';
        const scrollY = canvasArea ? canvasArea.scrollTop : 0;
        for (let y = 0; y < vCanvas.height + scrollY; y += 24) {
            const py = y - (scrollY % 24);
            if (py < 0) continue;
            const tick = Math.round(y / 24);
            if (tick % 4 === 0) {
                vCtx.beginPath();
                vCtx.moveTo(12, py);
                vCtx.lineTo(20, py);
                vCtx.stroke();
                if (tick % 8 === 0) {
                    vCtx.save();
                    vCtx.translate(9, py);
                    vCtx.rotate(-Math.PI / 2);
                    vCtx.fillText(String(tick), 0, 0);
                    vCtx.restore();
                }
            } else {
                vCtx.beginPath();
                vCtx.moveTo(16, py);
                vCtx.lineTo(20, py);
                vCtx.stroke();
            }
        }
    }

    // Redraw rulers on scroll and resize
    if (canvasArea) {
        canvasArea.addEventListener('scroll', drawRulers);
    }
    window.addEventListener('resize', drawRulers);
    requestAnimationFrame(drawRulers);

    // ═══════════════════════════════════════════════════════════
    // Zoom control
    // ═══════════════════════════════════════════════════════════
    if (zoomRange) {
        zoomRange.addEventListener('input', () => {
            currentZoom = parseInt(zoomRange.value);
            sbZoom.textContent = currentZoom + '%';
            diagramContainer.style.transform = `scale(${currentZoom / 100})`;
        });
    }

    // ═══════════════════════════════════════════════════════════
    // Side panel tab switching
    // ═══════════════════════════════════════════════════════════
    const spTabs = document.querySelectorAll('.sp-tab');
    const tabInspector = document.getElementById('tabInspector');
    const tabConsole = document.getElementById('tabConsole');

    spTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            spTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const target = tab.getAttribute('data-tab');
            if (target === 'inspector') {
                tabInspector.classList.remove('hidden');
                tabConsole.classList.add('hidden');
            } else {
                tabInspector.classList.add('hidden');
                tabConsole.classList.remove('hidden');
            }
        });
    });

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
            diagramContainer.innerHTML = `<p style="color:#d13438;">Erro ao renderizar diagrama: ${err.message}</p>`;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Sequence diagram message highlighting
    // ═══════════════════════════════════════════════════════════
    let messageIndexMap = [];

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
        badgeSteps.className = 'badge badge-steps';
        badgeStatus.textContent = statusText;
        // Map class to Visio-appropriate styling
        if (statusClass === 'green') {
            badgeStatus.style.background = '#dff6dd';
            badgeStatus.style.color = '#107c10';
            badgeStatus.style.borderColor = '#b7e4b7';
        } else if (statusClass === 'yellow') {
            badgeStatus.style.background = '#fff4ce';
            badgeStatus.style.color = '#ca5010';
            badgeStatus.style.borderColor = '#e8c87a';
        } else if (statusClass === 'red') {
            badgeStatus.style.background = '#fde7e9';
            badgeStatus.style.color = '#d13438';
            badgeStatus.style.borderColor = '#f0b0b3';
        } else {
            badgeStatus.style.background = '#deecf9';
            badgeStatus.style.color = '#185abd';
            badgeStatus.style.borderColor = '#c0d8f0';
        }
    }

    function updateProgress(current, total) {
        const pct = total > 0 ? Math.round((current / total) * 100) : 0;
        progressFill.style.width = pct + '%';
        progressText.textContent = current + ' / ' + total;
    }

    function renderDiagramBadges(flow) {
        if (!diagramBadges) return;
        const techSection = document.getElementById('techSection');
        const diagram = flow.diagram || '';
        const techs = [];
        if (/PostgreSQL|PG/i.test(diagram)) techs.push({ label: 'PostgreSQL', color: '#336791' });
        if (/MongoDB|Mongo/i.test(diagram)) techs.push({ label: 'MongoDB', color: '#4db33d' });
        if (/Redis/i.test(diagram)) techs.push({ label: 'Redis', color: '#dc382d' });
        if (/RabbitMQ|Queue/i.test(diagram)) techs.push({ label: 'RabbitMQ', color: '#ff6600' });
        if (/Payment|Pay|Pagamento/i.test(diagram)) techs.push({ label: 'Payment', color: '#7b2f9e' });
        if (/Email|Push|Notif/i.test(diagram)) techs.push({ label: 'Notify', color: '#185abd' });
        if (/CEP|Shipping|Exchange|Credit|Externa/i.test(diagram)) techs.push({ label: 'External API', color: '#0078d4' });
        diagramBadges.innerHTML = techs.map(t =>
            `<span class="badge" style="background:${t.color}15;color:${t.color};border:1px solid ${t.color}40;font-size:0.6rem">${t.label}</span>`
        ).join('');
        if (techSection) techSection.style.display = techs.length > 0 ? 'block' : 'none';
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
            responseInfo.textContent = 'Aguardando resposta...';
            updateProgress(stepIdx + 1, selectedFlow ? selectedFlow.steps.length : 0);

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
            updateBadges(flow.steps.length, 'Concluído', 'green');
            updateProgress(flow.steps.length, flow.steps.length);
            addLog('info', '────────────────────────────');
            addLog('info', 'Contexto final:');
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
                btnRun.querySelector('span').textContent = 'Executar';
                btnStep.querySelector('span').textContent = 'Passo';
                updateBadges(totalSteps, 'Pronto', 'blue');
                updateProgress(0, totalSteps);
                break;
            case 'running':
                btnRun.disabled = true;
                btnStep.disabled = true;
                btnReset.disabled = false;
                btnRun.querySelector('span').textContent = 'Executando...';
                updateBadges(totalSteps, 'Executando', 'yellow');
                break;
            case 'stepping':
                btnRun.disabled = true;
                btnStep.disabled = false;
                btnReset.disabled = false;
                btnStep.querySelector('span').textContent = 'Próximo';
                updateBadges(totalSteps, 'Passo a passo', 'yellow');
                break;
            case 'finished':
                btnRun.disabled = true;
                btnStep.disabled = true;
                btnReset.disabled = false;
                btnRun.querySelector('span').textContent = 'Concluído';
                updateBadges(totalSteps, 'Concluído', 'green');
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
            sbFlowName.textContent = selectedFlow.name;
            setButtons('idle');
        } else {
            diagramContainer.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:3rem;font-size:0.85rem;">Selecione um diagrama de arquitetura</p>';
            if (diagramBadges) diagramBadges.innerHTML = '';
            flowInfo.classList.add('hidden');
            sbFlowName.textContent = 'Nenhum diagrama selecionado';
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
            addLog('info', 'Contexto final:');
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
    diagramContainer.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:3rem;font-size:0.85rem;">Selecione um diagrama de arquitetura</p>';
    setButtons('idle');
})();
