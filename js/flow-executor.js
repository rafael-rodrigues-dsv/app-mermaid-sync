/**
 * Flow Executor - Percorre os steps de um flow, chama os endpoints
 * e destaca os nós do diagrama Mermaid em tempo real.
 */
const FlowExecutor = (() => {
    let currentFlow = null;
    let currentStepIndex = -1;
    let isRunning = false;
    let isPaused = false;
    let stepDelay = 1000;
    let context = {};        // Variáveis compartilhadas entre steps
    let onStepStart = null;
    let onStepEnd = null;
    let onFlowEnd = null;
    let onLog = null;
    let abortController = null;

    function setCallbacks({ stepStart, stepEnd, flowEnd, log }) {
        onStepStart = stepStart || null;
        onStepEnd = stepEnd || null;
        onFlowEnd = flowEnd || null;
        onLog = log || null;
    }

    function setDelay(ms) {
        stepDelay = ms;
    }

    function log(type, message) {
        if (onLog) onLog(type, message);
    }

    function resolveTemplate(str, ctx) {
        if (typeof str !== 'string') return str;
        return str.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
            return path.split('.').reduce((obj, key) => obj?.[key], ctx) ?? `{{${path}}}`;
        });
    }

    function resolveObject(obj, ctx) {
        if (typeof obj === 'string') return resolveTemplate(obj, ctx);
        if (Array.isArray(obj)) return obj.map(item => resolveObject(item, ctx));
        if (obj && typeof obj === 'object') {
            const resolved = {};
            for (const [key, val] of Object.entries(obj)) {
                resolved[key] = resolveObject(val, ctx);
            }
            return resolved;
        }
        return obj;
    }

    async function executeStep(step) {
        const { id, name, method, url, body, headers, extract, validate } = step;

        const resolvedUrl = resolveTemplate(url, context);
        const resolvedBody = body ? resolveObject(body, context) : undefined;
        const resolvedHeaders = headers ? resolveObject(headers, context) : { 'Content-Type': 'application/json' };

        const requestInfo = {
            method: method || 'GET',
            url: resolvedUrl,
            headers: resolvedHeaders,
            body: resolvedBody
        };

        if (onStepStart) onStepStart(step, requestInfo);
        log('running', `▶ [${method || 'GET'}] ${resolvedUrl}`);

        const fetchOptions = { method: method || 'GET', headers: resolvedHeaders };
        if (resolvedBody && method !== 'GET') {
            fetchOptions.body = JSON.stringify(resolvedBody);
        }

        const startTime = performance.now();

        try {
            const response = await fetch(resolvedUrl, fetchOptions);
            const elapsed = Math.round(performance.now() - startTime);
            const responseBody = await response.json();

            const responseInfo = {
                status: response.status,
                body: responseBody,
                elapsed
            };

            // Extract variables from response
            if (extract) {
                for (const [varName, jsonPath] of Object.entries(extract)) {
                    const value = jsonPath.split('.').reduce((obj, key) => obj?.[key], responseBody);
                    context[varName] = value;
                    log('info', `  📎 ${varName} = ${JSON.stringify(value)?.slice(0, 80)}`);
                }
            }

            // Validate response
            let valid = response.ok;
            if (validate) {
                if (validate.status && response.status !== validate.status) valid = false;
                if (validate.bodyContains) {
                    const bodyStr = JSON.stringify(responseBody);
                    if (!bodyStr.includes(validate.bodyContains)) valid = false;
                }
            }

            const status = valid ? 'success' : 'error';
            log(status, `  ${valid ? '✅' : '❌'} ${response.status} (${elapsed}ms)`);

            if (onStepEnd) onStepEnd(step, status, requestInfo, responseInfo);
            return { status, requestInfo, responseInfo };

        } catch (err) {
            const elapsed = Math.round(performance.now() - startTime);
            const responseInfo = { status: 0, body: { error: err.message }, elapsed };
            log('error', `  💥 Error: ${err.message} (${elapsed}ms)`);
            if (onStepEnd) onStepEnd(step, 'error', requestInfo, responseInfo);
            return { status: 'error', requestInfo, responseInfo };
        }
    }

    async function run(flow) {
        currentFlow = flow;
        currentStepIndex = -1;
        isRunning = true;
        isPaused = false;
        context = { ...(flow.variables || {}) };

        log('info', `🚀 Iniciando flow: ${flow.name}`);
        log('info', `📋 ${flow.steps.length} steps para executar`);

        for (let i = 0; i < flow.steps.length; i++) {
            if (!isRunning) break;

            while (isPaused) {
                await new Promise(r => setTimeout(r, 100));
                if (!isRunning) break;
            }

            currentStepIndex = i;
            const step = flow.steps[i];
            log('info', `\n── Step ${i + 1}/${flow.steps.length}: ${step.name} ──`);

            const result = await executeStep(step);

            // Check if we should continue on error
            if (result.status === 'error' && !step.continueOnError) {
                log('error', `⛔ Flow interrompido no step "${step.name}"`);
                break;
            }

            // Delay between steps
            if (i < flow.steps.length - 1 && isRunning) {
                await new Promise(r => setTimeout(r, stepDelay));
            }
        }

        isRunning = false;
        log('info', `\n🏁 Flow "${flow.name}" finalizado`);
        if (onFlowEnd) onFlowEnd(flow, context);
    }

    async function stepOnce() {
        if (!currentFlow) return;

        const nextIndex = currentStepIndex + 1;
        if (nextIndex >= currentFlow.steps.length) {
            log('info', '🏁 Todos os steps foram executados');
            isRunning = false;
            if (onFlowEnd) onFlowEnd(currentFlow, context);
            return;
        }

        currentStepIndex = nextIndex;
        const step = currentFlow.steps[nextIndex];
        log('info', `\n── Step ${nextIndex + 1}/${currentFlow.steps.length}: ${step.name} ──`);
        await executeStep(step);
    }

    function prepareForStepping(flow) {
        currentFlow = flow;
        currentStepIndex = -1;
        isRunning = true;
        isPaused = true;
        context = { ...(flow.variables || {}) };
        log('info', `🚀 Flow "${flow.name}" pronto para step-by-step`);
        log('info', `📋 ${flow.steps.length} steps disponíveis`);
    }

    function stop() {
        isRunning = false;
        isPaused = false;
    }

    function reset() {
        isRunning = false;
        isPaused = false;
        currentFlow = null;
        currentStepIndex = -1;
        context = {};
    }

    function getState() {
        return {
            isRunning,
            isPaused,
            currentStepIndex,
            totalSteps: currentFlow?.steps?.length || 0,
            context: { ...context }
        };
    }

    return { setCallbacks, setDelay, run, stepOnce, prepareForStepping, stop, reset, getState };
})();
