/**
 * Mock Server - Intercepta fetch() e retorna respostas simuladas.
 * Funciona como um "Postman Mock Server" no browser.
 */
const MockServer = (() => {
    const routes = new Map();
    const originalFetch = window.fetch;
    let interceptActive = false;
    let latencyMin = 100;
    let latencyMax = 500;

    function register(method, path, handler) {
        const key = `${method.toUpperCase()}::${path}`;
        routes.set(key, handler);
    }

    function findRoute(method, url) {
        const urlObj = new URL(url, 'http://mock');
        const pathname = urlObj.pathname;

        // Exact match first
        const exactKey = `${method.toUpperCase()}::${pathname}`;
        if (routes.has(exactKey)) {
            return { handler: routes.get(exactKey), params: {} };
        }

        // Pattern match (e.g., /users/:id)
        for (const [key, handler] of routes) {
            const [routeMethod, routePath] = key.split('::');
            if (routeMethod !== method.toUpperCase()) continue;

            const routeParts = routePath.split('/');
            const urlParts = pathname.split('/');

            if (routeParts.length !== urlParts.length) continue;

            const params = {};
            let match = true;

            for (let i = 0; i < routeParts.length; i++) {
                if (routeParts[i].startsWith(':')) {
                    params[routeParts[i].slice(1)] = urlParts[i];
                } else if (routeParts[i] !== urlParts[i]) {
                    match = false;
                    break;
                }
            }

            if (match) return { handler, params };
        }

        return null;
    }

    function simulateLatency() {
        const delay = Math.random() * (latencyMax - latencyMin) + latencyMin;
        return new Promise(resolve => setTimeout(resolve, delay));
    }

    function activate() {
        if (interceptActive) return;
        interceptActive = true;

        window.fetch = async (url, options = {}) => {
            const method = (options.method || 'GET').toUpperCase();
            const route = findRoute(method, url);

            if (!route) {
                return new Response(JSON.stringify({ error: 'Not Found', message: `No mock for ${method} ${url}` }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            await simulateLatency();

            let body = null;
            if (options.body) {
                try { body = JSON.parse(options.body); } catch { body = options.body; }
            }

            const ctx = {
                params: route.params,
                body,
                headers: options.headers || {},
                query: Object.fromEntries(new URL(url, 'http://mock').searchParams)
            };

            try {
                const result = route.handler(ctx);
                const status = result.status || 200;
                const responseBody = result.body !== undefined ? result.body : result;

                return new Response(JSON.stringify(responseBody), {
                    status,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Mock-Server': 'true',
                        ...(result.headers || {})
                    }
                });
            } catch (err) {
                return new Response(JSON.stringify({ error: 'Mock Error', message: err.message }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        };
    }

    function deactivate() {
        window.fetch = originalFetch;
        interceptActive = false;
    }

    function setLatency(min, max) {
        latencyMin = min;
        latencyMax = max;
    }

    function listRoutes() {
        return Array.from(routes.keys()).map(key => {
            const [method, path] = key.split('::');
            return { method, path };
        });
    }

    return { register, activate, deactivate, setLatency, listRoutes };
})();

// ═══════════════════════════════════════════════════════════
// Registrar Mock Endpoints
// ═══════════════════════════════════════════════════════════

// --- Auth Service ---
MockServer.register('POST', '/auth/login', (ctx) => {
    const { email, password } = ctx.body || {};
    if (email === 'admin@test.com' && password === 'admin123') {
        return {
            status: 200,
            body: {
                token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-token-admin',
                refreshToken: 'refresh-token-abc123',
                user: { id: 'usr_001', email, role: 'admin', name: 'Admin User' },
                expiresIn: 3600
            }
        };
    }
    if (email && password) {
        return {
            status: 200,
            body: {
                token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-token-user',
                refreshToken: 'refresh-token-def456',
                user: { id: 'usr_002', email, role: 'user', name: 'Test User' },
                expiresIn: 3600
            }
        };
    }
    return { status: 401, body: { error: 'Unauthorized', message: 'Invalid credentials' } };
});

MockServer.register('POST', '/auth/refresh', (ctx) => {
    const { refreshToken } = ctx.body || {};
    if (refreshToken) {
        return {
            status: 200,
            body: {
                token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-token-refreshed',
                refreshToken: 'refresh-token-new789',
                expiresIn: 3600
            }
        };
    }
    return { status: 401, body: { error: 'Unauthorized', message: 'Invalid refresh token' } };
});

MockServer.register('POST', '/auth/logout', () => {
    return { status: 200, body: { message: 'Logged out successfully' } };
});

// --- User Service ---
MockServer.register('GET', '/users', () => {
    return {
        status: 200,
        body: {
            data: [
                { id: 'usr_001', name: 'Admin User', email: 'admin@test.com', role: 'admin', status: 'active' },
                { id: 'usr_002', name: 'John Doe', email: 'john@test.com', role: 'user', status: 'active' },
                { id: 'usr_003', name: 'Jane Smith', email: 'jane@test.com', role: 'user', status: 'inactive' }
            ],
            total: 3,
            page: 1,
            limit: 10
        }
    };
});

MockServer.register('POST', '/users', (ctx) => {
    const { name, email, role } = ctx.body || {};
    return {
        status: 201,
        body: {
            id: 'usr_' + Math.random().toString(36).slice(2, 8),
            name: name || 'New User',
            email: email || 'new@test.com',
            role: role || 'user',
            status: 'active',
            createdAt: new Date().toISOString()
        }
    };
});

MockServer.register('GET', '/users/:id', (ctx) => {
    return {
        status: 200,
        body: {
            id: ctx.params.id,
            name: 'User Detail',
            email: 'user@test.com',
            role: 'user',
            status: 'active',
            createdAt: '2025-01-15T10:30:00Z',
            profile: { bio: 'Test user profile', avatar: 'https://placeholder.co/100' }
        }
    };
});

MockServer.register('PUT', '/users/:id', (ctx) => {
    return {
        status: 200,
        body: {
            id: ctx.params.id,
            ...ctx.body,
            updatedAt: new Date().toISOString()
        }
    };
});

MockServer.register('DELETE', '/users/:id', (ctx) => {
    return { status: 200, body: { message: `User ${ctx.params.id} deleted successfully` } };
});

// --- Order Service ---
MockServer.register('POST', '/orders', (ctx) => {
    const { userId, items } = ctx.body || {};
    const total = (items || []).reduce((sum, i) => sum + (i.price || 10) * (i.quantity || 1), 0);
    return {
        status: 201,
        body: {
            id: 'ord_' + Math.random().toString(36).slice(2, 8),
            userId: userId || 'usr_001',
            items: items || [{ productId: 'prod_001', name: 'Widget', price: 29.99, quantity: 2 }],
            total,
            status: 'pending',
            createdAt: new Date().toISOString()
        }
    };
});

MockServer.register('GET', '/orders/:id', (ctx) => {
    return {
        status: 200,
        body: {
            id: ctx.params.id,
            userId: 'usr_001',
            items: [{ productId: 'prod_001', name: 'Widget', price: 29.99, quantity: 2 }],
            total: 59.98,
            status: 'confirmed',
            createdAt: '2025-06-01T14:00:00Z'
        }
    };
});

MockServer.register('GET', '/orders/user/:userId', (ctx) => {
    return {
        status: 200,
        body: {
            data: [
                { id: 'ord_abc1', userId: ctx.params.userId, total: 59.98, status: 'confirmed' },
                { id: 'ord_abc2', userId: ctx.params.userId, total: 124.50, status: 'delivered' }
            ],
            total: 2
        }
    };
});

MockServer.register('PUT', '/orders/:id/status', (ctx) => {
    return {
        status: 200,
        body: {
            id: ctx.params.id,
            status: ctx.body?.status || 'confirmed',
            updatedAt: new Date().toISOString()
        }
    };
});

// --- Payment Service ---
MockServer.register('POST', '/payments', (ctx) => {
    const { orderId, amount, method } = ctx.body || {};
    const success = Math.random() > 0.1; // 90% success rate
    if (success) {
        return {
            status: 200,
            body: {
                id: 'pay_' + Math.random().toString(36).slice(2, 8),
                orderId: orderId || 'ord_abc1',
                amount: amount || 59.98,
                method: method || 'credit_card',
                status: 'approved',
                transactionId: 'txn_' + Math.random().toString(36).slice(2, 10),
                processedAt: new Date().toISOString()
            }
        };
    }
    return {
        status: 402,
        body: { error: 'Payment Failed', message: 'Insufficient funds', code: 'INSUFFICIENT_FUNDS' }
    };
});

MockServer.register('GET', '/payments/:id', (ctx) => {
    return {
        status: 200,
        body: {
            id: ctx.params.id,
            orderId: 'ord_abc1',
            amount: 59.98,
            status: 'approved',
            method: 'credit_card'
        }
    };
});

MockServer.register('POST', '/payments/:id/refund', (ctx) => {
    return {
        status: 200,
        body: {
            id: ctx.params.id,
            refundId: 'ref_' + Math.random().toString(36).slice(2, 8),
            amount: ctx.body?.amount || 59.98,
            status: 'refunded',
            refundedAt: new Date().toISOString()
        }
    };
});

// --- Notification Service ---
MockServer.register('POST', '/notifications/email', (ctx) => {
    return {
        status: 200,
        body: {
            id: 'notif_' + Math.random().toString(36).slice(2, 8),
            type: 'email',
            to: ctx.body?.to || 'user@test.com',
            subject: ctx.body?.subject || 'Notification',
            status: 'sent',
            sentAt: new Date().toISOString()
        }
    };
});

MockServer.register('POST', '/notifications/push', (ctx) => {
    return {
        status: 200,
        body: {
            id: 'notif_' + Math.random().toString(36).slice(2, 8),
            type: 'push',
            to: ctx.body?.userId || 'usr_001',
            title: ctx.body?.title || 'Notification',
            status: 'delivered'
        }
    };
});
