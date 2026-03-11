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

// ═══════════════════════════════════════════════════════════
// Message Queue Service (RabbitMQ / Kafka / SQS)
// ═══════════════════════════════════════════════════════════

MockServer.register('POST', '/queue/publish', (ctx) => {
    const { queue, exchange, routingKey, message } = ctx.body || {};
    return {
        status: 200,
        body: {
            messageId: 'msg_' + Math.random().toString(36).slice(2, 10),
            queue: queue || 'default',
            exchange: exchange || 'amq.direct',
            routingKey: routingKey || queue || 'default',
            status: 'published',
            timestamp: new Date().toISOString(),
            payload: message || {}
        }
    };
});

MockServer.register('POST', '/queue/consume', (ctx) => {
    const { queue, ack } = ctx.body || {};
    return {
        status: 200,
        body: {
            messages: [
                {
                    messageId: 'msg_' + Math.random().toString(36).slice(2, 10),
                    queue: queue || 'default',
                    payload: { event: 'order.created', orderId: 'ord_abc1', userId: 'usr_001' },
                    timestamp: new Date().toISOString(),
                    deliveryTag: 1
                }
            ],
            count: 1,
            acknowledged: ack !== false
        }
    };
});

MockServer.register('GET', '/queue/:name/status', (ctx) => {
    return {
        status: 200,
        body: {
            queue: ctx.params.name,
            messages: Math.floor(Math.random() * 50),
            consumers: Math.floor(Math.random() * 5) + 1,
            rate: { publish: 12.5, consume: 11.8 },
            status: 'running'
        }
    };
});

MockServer.register('POST', '/queue/dlq/retry', (ctx) => {
    const { queue, messageId } = ctx.body || {};
    return {
        status: 200,
        body: {
            messageId: messageId || 'msg_dlq001',
            originalQueue: queue || 'orders',
            status: 'requeued',
            retriedAt: new Date().toISOString()
        }
    };
});

// ═══════════════════════════════════════════════════════════
// PostgreSQL (Banco Relacional)
// ═══════════════════════════════════════════════════════════

MockServer.register('POST', '/db/pg/query', (ctx) => {
    const { sql, params } = ctx.body || {};
    const sqlUpper = (sql || '').toUpperCase().trim();

    // Simula diferentes tipos de query
    if (sqlUpper.startsWith('SELECT')) {
        return {
            status: 200,
            body: {
                rows: [
                    { id: 1, name: 'Record 1', status: 'active', created_at: '2025-01-15T10:00:00Z' },
                    { id: 2, name: 'Record 2', status: 'active', created_at: '2025-02-20T14:30:00Z' },
                    { id: 3, name: 'Record 3', status: 'inactive', created_at: '2025-03-10T09:15:00Z' }
                ],
                rowCount: 3,
                command: 'SELECT',
                duration: Math.floor(Math.random() * 50) + 5 + 'ms'
            }
        };
    }
    if (sqlUpper.startsWith('INSERT')) {
        return {
            status: 201,
            body: {
                rows: [{ id: Math.floor(Math.random() * 1000) + 100 }],
                rowCount: 1,
                command: 'INSERT',
                duration: Math.floor(Math.random() * 30) + 3 + 'ms'
            }
        };
    }
    if (sqlUpper.startsWith('UPDATE')) {
        return {
            status: 200,
            body: {
                rows: [],
                rowCount: 1,
                command: 'UPDATE',
                duration: Math.floor(Math.random() * 40) + 4 + 'ms'
            }
        };
    }
    if (sqlUpper.startsWith('DELETE')) {
        return {
            status: 200,
            body: {
                rows: [],
                rowCount: 1,
                command: 'DELETE',
                duration: Math.floor(Math.random() * 30) + 3 + 'ms'
            }
        };
    }
    return {
        status: 200,
        body: { rows: [], rowCount: 0, command: 'UNKNOWN', duration: '1ms' }
    };
});

MockServer.register('POST', '/db/pg/transaction', (ctx) => {
    const { queries } = ctx.body || {};
    const results = (queries || []).map((q, i) => ({
        step: i + 1,
        sql: q.sql,
        rowCount: 1,
        status: 'ok',
        duration: Math.floor(Math.random() * 30) + 3 + 'ms'
    }));
    return {
        status: 200,
        body: {
            transactionId: 'txn_pg_' + Math.random().toString(36).slice(2, 8),
            status: 'committed',
            results,
            totalDuration: Math.floor(Math.random() * 100) + 20 + 'ms'
        }
    };
});

MockServer.register('GET', '/db/pg/health', () => {
    return {
        status: 200,
        body: {
            database: 'app_production',
            host: 'pg-primary.internal:5432',
            status: 'connected',
            poolSize: 20,
            activeConnections: 8,
            idleConnections: 12,
            version: 'PostgreSQL 16.2'
        }
    };
});

// ═══════════════════════════════════════════════════════════
// MongoDB (Banco NoSQL - Documentos)
// ═══════════════════════════════════════════════════════════

MockServer.register('POST', '/db/mongo/find', (ctx) => {
    const { collection, filter, limit } = ctx.body || {};
    return {
        status: 200,
        body: {
            collection: collection || 'documents',
            documents: [
                { _id: '65a1b2c3d4e5f6a7b8c9d0e1', type: 'event_log', data: { action: 'user.login', userId: 'usr_001' }, createdAt: '2025-06-01T10:00:00Z' },
                { _id: '65a1b2c3d4e5f6a7b8c9d0e2', type: 'event_log', data: { action: 'order.created', orderId: 'ord_abc1' }, createdAt: '2025-06-01T10:05:00Z' }
            ],
            count: 2,
            filter: filter || {},
            duration: Math.floor(Math.random() * 20) + 2 + 'ms'
        }
    };
});

MockServer.register('POST', '/db/mongo/insert', (ctx) => {
    const { collection, document, documents } = ctx.body || {};
    const docs = documents || [document || {}];
    return {
        status: 201,
        body: {
            collection: collection || 'documents',
            insertedIds: docs.map(() => '65' + Math.random().toString(36).slice(2, 14)),
            insertedCount: docs.length,
            duration: Math.floor(Math.random() * 15) + 2 + 'ms'
        }
    };
});

MockServer.register('POST', '/db/mongo/update', (ctx) => {
    const { collection, filter, update } = ctx.body || {};
    return {
        status: 200,
        body: {
            collection: collection || 'documents',
            matchedCount: 1,
            modifiedCount: 1,
            filter: filter || {},
            duration: Math.floor(Math.random() * 15) + 2 + 'ms'
        }
    };
});

MockServer.register('POST', '/db/mongo/aggregate', (ctx) => {
    const { collection, pipeline } = ctx.body || {};
    return {
        status: 200,
        body: {
            collection: collection || 'documents',
            results: [
                { _id: 'active', count: 42, totalRevenue: 12580.50 },
                { _id: 'pending', count: 7, totalRevenue: 2100.00 },
                { _id: 'cancelled', count: 3, totalRevenue: 890.25 }
            ],
            stages: (pipeline || []).length,
            duration: Math.floor(Math.random() * 60) + 10 + 'ms'
        }
    };
});

MockServer.register('GET', '/db/mongo/health', () => {
    return {
        status: 200,
        body: {
            cluster: 'rs0',
            host: 'mongo-primary.internal:27017',
            status: 'connected',
            replicaSet: { primary: 1, secondary: 2 },
            version: 'MongoDB 7.0.5'
        }
    };
});

// ═══════════════════════════════════════════════════════════
// Redis (Cache / NoSQL Key-Value)
// ═══════════════════════════════════════════════════════════

MockServer.register('POST', '/db/redis/set', (ctx) => {
    const { key, value, ttl } = ctx.body || {};
    return {
        status: 200,
        body: {
            key: key || 'cache:key',
            status: 'OK',
            ttl: ttl || -1,
            operation: 'SET'
        }
    };
});

MockServer.register('POST', '/db/redis/get', (ctx) => {
    const { key } = ctx.body || {};
    return {
        status: 200,
        body: {
            key: key || 'cache:key',
            value: { cached: true, data: { userId: 'usr_001', name: 'Cached User' } },
            ttl: 3540,
            hit: true
        }
    };
});

MockServer.register('POST', '/db/redis/del', (ctx) => {
    const { keys } = ctx.body || {};
    return {
        status: 200,
        body: {
            deleted: (keys || ['cache:key']).length,
            keys: keys || ['cache:key'],
            operation: 'DEL'
        }
    };
});

MockServer.register('GET', '/db/redis/health', () => {
    return {
        status: 200,
        body: {
            host: 'redis.internal:6379',
            status: 'connected',
            usedMemory: '45.2 MB',
            connectedClients: 15,
            hitRate: '94.7%',
            version: 'Redis 7.2.4'
        }
    };
});

// ═══════════════════════════════════════════════════════════
// External API Service (Simula chamadas a APIs externas)
// ═══════════════════════════════════════════════════════════

MockServer.register('POST', '/external/cep', (ctx) => {
    const { cep } = ctx.body || {};
    return {
        status: 200,
        body: {
            cep: cep || '01001-000',
            logradouro: 'Praça da Sé',
            bairro: 'Sé',
            cidade: 'São Paulo',
            estado: 'SP',
            ibge: '3550308',
            provider: 'ViaCEP'
        }
    };
});

MockServer.register('POST', '/external/exchange-rate', (ctx) => {
    const { from, to } = ctx.body || {};
    return {
        status: 200,
        body: {
            from: from || 'USD',
            to: to || 'BRL',
            rate: 5.15 + (Math.random() * 0.3 - 0.15),
            timestamp: new Date().toISOString(),
            provider: 'ExchangeRates API'
        }
    };
});

MockServer.register('POST', '/external/credit-score', (ctx) => {
    const { cpf } = ctx.body || {};
    return {
        status: 200,
        body: {
            cpf: cpf || '***.***.***-**',
            score: Math.floor(Math.random() * 400) + 500,
            risk: 'low',
            lastUpdated: new Date().toISOString(),
            provider: 'Serasa'
        }
    };
});

MockServer.register('POST', '/external/shipping/calculate', (ctx) => {
    const { from, to, weight } = ctx.body || {};
    return {
        status: 200,
        body: {
            from: from || '01001-000',
            to: to || '20040-020',
            weight: weight || 1.5,
            options: [
                { carrier: 'Correios PAC', price: 25.90, days: 8, tracking: true },
                { carrier: 'Correios SEDEX', price: 45.50, days: 3, tracking: true },
                { carrier: 'Transportadora Express', price: 38.00, days: 2, tracking: true }
            ],
            provider: 'Shipping Gateway'
        }
    };
});
