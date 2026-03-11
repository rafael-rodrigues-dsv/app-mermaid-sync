/**
 * Flow: Operações com PostgreSQL, MongoDB e Redis
 */
const DatabaseFlow = {
    id: 'database-flow',
    name: '🗄️ Database Flow (PG + Mongo + Redis)',
    description: 'Health checks → Cache lookup → Query PG → Aggregate Mongo → Transaction PG → Invalidar Cache',
    variables: {
        baseUrl: 'http://mock',
        email: 'admin@test.com',
        password: 'admin123'
    },
    diagram: `graph TD
        START([🚀 Início]) --> LOGIN[🔐 POST /auth/login]
        LOGIN -->|200 OK| PG_HEALTH[🐘 GET /db/pg/health]
        LOGIN -->|401| ERR_LOGIN[❌ Login Falhou]
        PG_HEALTH -->|connected| MONGO_HEALTH[🍃 GET /db/mongo/health]
        PG_HEALTH -->|error| ERR_PG[❌ PostgreSQL Down]
        MONGO_HEALTH -->|connected| REDIS_HEALTH[⚡ GET /db/redis/health]
        MONGO_HEALTH -->|error| ERR_MONGO[❌ MongoDB Down]
        REDIS_HEALTH -->|connected| CACHE_GET[⚡ POST /db/redis/get<br/>Buscar cache]
        REDIS_HEALTH -->|error| ERR_REDIS[❌ Redis Down]
        CACHE_GET -->|hit/miss| PG_SELECT[🐘 POST /db/pg/query<br/>SELECT orders]
        PG_SELECT -->|rows| MONGO_FIND[🍃 POST /db/mongo/find<br/>event_logs]
        MONGO_FIND -->|docs| MONGO_AGG[🍃 POST /db/mongo/aggregate<br/>Pipeline analytics]
        MONGO_AGG -->|results| PG_TXN[🐘 POST /db/pg/transaction<br/>UPDATE + INSERT]
        PG_TXN -->|committed| MONGO_INSERT[🍃 POST /db/mongo/insert<br/>audit_log]
        MONGO_INSERT -->|inserted| CACHE_SET[⚡ POST /db/redis/set<br/>Atualizar cache]
        CACHE_SET -->|OK| CACHE_DEL[⚡ POST /db/redis/del<br/>Invalidar cache antigo]
        CACHE_DEL --> FIM([✅ Operações DB Completas])
        ERR_LOGIN --> FIM_ERR([❌ Fim com Erro])
        ERR_PG --> FIM_ERR
        ERR_MONGO --> FIM_ERR
        ERR_REDIS --> FIM_ERR

        style START fill:#1f6feb,stroke:#58a6ff,color:#fff
        style FIM fill:#238636,stroke:#3fb950,color:#fff
        style FIM_ERR fill:#da3633,stroke:#f85149,color:#fff
        style ERR_LOGIN fill:#da3633,stroke:#f85149,color:#fff
        style ERR_PG fill:#da3633,stroke:#f85149,color:#fff
        style ERR_MONGO fill:#da3633,stroke:#f85149,color:#fff
        style ERR_REDIS fill:#da3633,stroke:#f85149,color:#fff
        style PG_HEALTH fill:#336791,stroke:#58a6ff,color:#fff
        style PG_SELECT fill:#336791,stroke:#58a6ff,color:#fff
        style PG_TXN fill:#336791,stroke:#58a6ff,color:#fff
        style MONGO_HEALTH fill:#4db33d,stroke:#3fb950,color:#fff
        style MONGO_FIND fill:#4db33d,stroke:#3fb950,color:#fff
        style MONGO_AGG fill:#4db33d,stroke:#3fb950,color:#fff
        style MONGO_INSERT fill:#4db33d,stroke:#3fb950,color:#fff
        style REDIS_HEALTH fill:#dc382d,stroke:#f85149,color:#fff
        style CACHE_GET fill:#dc382d,stroke:#f85149,color:#fff
        style CACHE_SET fill:#dc382d,stroke:#f85149,color:#fff
        style CACHE_DEL fill:#dc382d,stroke:#f85149,color:#fff`,
    steps: [
        {
            id: 'LOGIN',
            name: 'Autenticação',
            method: 'POST',
            url: '{{baseUrl}}/auth/login',
            body: { email: '{{email}}', password: '{{password}}' },
            extract: { token: 'token', userId: 'user.id' },
            validate: { status: 200 }
        },
        {
            id: 'PG_HEALTH',
            name: 'Health Check - PostgreSQL',
            method: 'GET',
            url: '{{baseUrl}}/db/pg/health',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            extract: { pgVersion: 'version', pgPool: 'poolSize' },
            validate: { status: 200 }
        },
        {
            id: 'MONGO_HEALTH',
            name: 'Health Check - MongoDB',
            method: 'GET',
            url: '{{baseUrl}}/db/mongo/health',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            extract: { mongoVersion: 'version', mongoCluster: 'cluster' },
            validate: { status: 200 }
        },
        {
            id: 'REDIS_HEALTH',
            name: 'Health Check - Redis',
            method: 'GET',
            url: '{{baseUrl}}/db/redis/health',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            extract: { redisVersion: 'version', redisHitRate: 'hitRate' },
            validate: { status: 200 }
        },
        {
            id: 'CACHE_GET',
            name: 'Buscar do Cache Redis',
            method: 'POST',
            url: '{{baseUrl}}/db/redis/get',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: { key: 'orders:summary:{{userId}}' },
            extract: { cacheHit: 'hit', cachedData: 'value' },
            validate: { status: 200 }
        },
        {
            id: 'PG_SELECT',
            name: 'SELECT no PostgreSQL',
            method: 'POST',
            url: '{{baseUrl}}/db/pg/query',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: {
                sql: 'SELECT id, user_id, total, status, created_at FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
                params: ['{{userId}}']
            },
            extract: { pgRows: 'rowCount', pgDuration: 'duration' },
            validate: { status: 200 }
        },
        {
            id: 'MONGO_FIND',
            name: 'Find no MongoDB - Event Logs',
            method: 'POST',
            url: '{{baseUrl}}/db/mongo/find',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: {
                collection: 'event_logs',
                filter: { 'data.userId': '{{userId}}' },
                limit: 20
            },
            extract: { mongoDocCount: 'count', mongoDuration: 'duration' },
            validate: { status: 200 }
        },
        {
            id: 'MONGO_AGG',
            name: 'Aggregate no MongoDB - Analytics',
            method: 'POST',
            url: '{{baseUrl}}/db/mongo/aggregate',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: {
                collection: 'orders_analytics',
                pipeline: [
                    { $match: { userId: '{{userId}}' } },
                    { $group: { _id: '$status', count: { $sum: 1 }, totalRevenue: { $sum: '$total' } } },
                    { $sort: { count: -1 } }
                ]
            },
            extract: { aggResults: 'results', aggDuration: 'duration' },
            validate: { status: 200 }
        },
        {
            id: 'PG_TXN',
            name: 'Transaction PostgreSQL (UPDATE + INSERT)',
            method: 'POST',
            url: '{{baseUrl}}/db/pg/transaction',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: {
                queries: [
                    { sql: 'UPDATE orders SET status = $1 WHERE user_id = $2 AND status = $3', params: ['archived', '{{userId}}', 'delivered'] },
                    { sql: 'INSERT INTO order_history (user_id, action, details) VALUES ($1, $2, $3)', params: ['{{userId}}', 'bulk_archive', 'Archived delivered orders'] }
                ]
            },
            extract: { txnId: 'transactionId', txnStatus: 'status', txnDuration: 'totalDuration' },
            validate: { status: 200 }
        },
        {
            id: 'MONGO_INSERT',
            name: 'Insert Audit Log no MongoDB',
            method: 'POST',
            url: '{{baseUrl}}/db/mongo/insert',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: {
                collection: 'audit_logs',
                document: {
                    action: 'db.transaction.completed',
                    transactionId: '{{txnId}}',
                    userId: '{{userId}}',
                    details: 'Bulk archive + history insert'
                }
            },
            extract: { auditDocId: 'insertedIds.0' },
            validate: { status: 201 }
        },
        {
            id: 'CACHE_SET',
            name: 'Atualizar Cache Redis',
            method: 'POST',
            url: '{{baseUrl}}/db/redis/set',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: {
                key: 'orders:summary:{{userId}}',
                value: { pgRows: '{{pgRows}}', mongoLogs: '{{mongoDocCount}}', lastTxn: '{{txnId}}' },
                ttl: 1800
            },
            validate: { status: 200 }
        },
        {
            id: 'CACHE_DEL',
            name: 'Invalidar Cache Antigo',
            method: 'POST',
            url: '{{baseUrl}}/db/redis/del',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: { keys: ['orders:list:{{userId}}', 'orders:analytics:{{userId}}'] },
            validate: { status: 200 }
        }
    ]
};
