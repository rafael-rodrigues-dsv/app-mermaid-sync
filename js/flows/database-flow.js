/**
 * Flow: Operações com PostgreSQL, MongoDB e Redis
 * Sequence diagram com raias: App, PostgreSQL, MongoDB, Redis
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
    diagram: `sequenceDiagram
        box rgb(232,240,254) 🖥️ Aplicação
            participant App as 📦 App Service
        end
        box rgb(255,243,224) 🐘 Banco Relacional
            participant PG as 🐘 PostgreSQL
        end
        box rgb(232,245,233) 🍃 Banco NoSQL
            participant Mongo as 🍃 MongoDB
        end
        box rgb(252,228,236) ⚡ Cache
            participant Redis as ⚡ Redis
        end

        Note over App,Redis: 🏥 Health Checks
        App->>+PG: GET /db/pg/health
        PG-->>-App: connected (v15.3, pool: 10)

        App->>+Mongo: GET /db/mongo/health
        Mongo-->>-App: connected (v7.0, cluster: rs0)

        App->>+Redis: GET /db/redis/health
        Redis-->>-App: connected (v7.2, hitRate: 94%)

        Note over App,Redis: ⚡ Cache Lookup
        App->>+Redis: GET orders:summary:usr_001
        Redis-->>-App: miss (null)

        Note over App,Redis: 🐘 Query PostgreSQL
        App->>+PG: SELECT orders WHERE user_id=$1 LIMIT 10
        PG-->>-App: 3 rows (12ms)

        Note over App,Redis: 🍃 Find MongoDB - Event Logs
        App->>+Mongo: find(event_logs, {userId: usr_001})
        Mongo-->>-App: 5 documents (8ms)

        Note over App,Redis: 🍃 Aggregate MongoDB - Analytics
        App->>+Mongo: aggregate(orders_analytics, pipeline)
        Note right of Mongo: $match → $group → $sort
        Mongo-->>-App: 3 results (15ms)

        Note over App,Redis: 🐘 Transaction PG (UPDATE + INSERT)
        App->>+PG: BEGIN TRANSACTION
        PG->>PG: UPDATE orders SET status='archived'
        PG->>PG: INSERT INTO order_history
        PG-->>-App: COMMIT (txn_001, 25ms)

        Note over App,Redis: 🍃 Insert Audit Log
        App->>+Mongo: insertOne(audit_logs, {action: txn.completed})
        Mongo-->>-App: insertedId

        Note over App,Redis: ⚡ Atualizar Cache
        App->>+Redis: SET orders:summary:usr_001 (TTL 1800)
        Redis-->>-App: OK

        Note over App,Redis: ⚡ Invalidar Cache Antigo
        App->>+Redis: DEL orders:list:*, orders:analytics:*
        Redis-->>-App: 2 keys deleted ✅`,
    steps: [
        {
            id: 'PG_HEALTH',
            name: 'Health Check - PostgreSQL',
            method: 'GET',
            url: '{{baseUrl}}/db/pg/health',
            extract: { pgVersion: 'version', pgPool: 'poolSize' },
            validate: { status: 200 },
            messageCount: 2
        },
        {
            id: 'MONGO_HEALTH',
            name: 'Health Check - MongoDB',
            method: 'GET',
            url: '{{baseUrl}}/db/mongo/health',
            extract: { mongoVersion: 'version', mongoCluster: 'cluster' },
            validate: { status: 200 },
            messageCount: 2
        },
        {
            id: 'REDIS_HEALTH',
            name: 'Health Check - Redis',
            method: 'GET',
            url: '{{baseUrl}}/db/redis/health',
            extract: { redisVersion: 'version', redisHitRate: 'hitRate' },
            validate: { status: 200 },
            messageCount: 2
        },
        {
            id: 'CACHE_GET',
            name: 'Buscar do Cache Redis',
            method: 'POST',
            url: '{{baseUrl}}/db/redis/get',
            body: { key: 'orders:summary:usr_001' },
            extract: { cacheHit: 'hit', cachedData: 'value' },
            validate: { status: 200 },
            messageCount: 2
        },
        {
            id: 'PG_SELECT',
            name: 'SELECT no PostgreSQL',
            method: 'POST',
            url: '{{baseUrl}}/db/pg/query',
            body: {
                sql: 'SELECT id, user_id, total, status, created_at FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
                params: ['usr_001']
            },
            extract: { pgRows: 'rowCount', pgDuration: 'duration' },
            validate: { status: 200 },
            messageCount: 2
        },
        {
            id: 'MONGO_FIND',
            name: 'Find no MongoDB - Event Logs',
            method: 'POST',
            url: '{{baseUrl}}/db/mongo/find',
            body: {
                collection: 'event_logs',
                filter: { 'data.userId': 'usr_001' },
                limit: 20
            },
            extract: { mongoDocCount: 'count', mongoDuration: 'duration' },
            validate: { status: 200 },
            messageCount: 2
        },
        {
            id: 'MONGO_AGG',
            name: 'Aggregate no MongoDB - Analytics',
            method: 'POST',
            url: '{{baseUrl}}/db/mongo/aggregate',
            body: {
                collection: 'orders_analytics',
                pipeline: [
                    { $match: { userId: 'usr_001' } },
                    { $group: { _id: '$status', count: { $sum: 1 }, totalRevenue: { $sum: '$total' } } },
                    { $sort: { count: -1 } }
                ]
            },
            extract: { aggResults: 'results', aggDuration: 'duration' },
            validate: { status: 200 },
            messageCount: 2
        },
        {
            id: 'PG_TXN',
            name: 'Transaction PostgreSQL (UPDATE + INSERT)',
            method: 'POST',
            url: '{{baseUrl}}/db/pg/transaction',
            body: {
                queries: [
                    { sql: 'UPDATE orders SET status = $1 WHERE user_id = $2 AND status = $3', params: ['archived', 'usr_001', 'delivered'] },
                    { sql: 'INSERT INTO order_history (user_id, action, details) VALUES ($1, $2, $3)', params: ['usr_001', 'bulk_archive', 'Archived delivered orders'] }
                ]
            },
            extract: { txnId: 'transactionId', txnStatus: 'status', txnDuration: 'totalDuration' },
            validate: { status: 200 },
            messageCount: 4
        },
        {
            id: 'MONGO_INSERT',
            name: 'Insert Audit Log no MongoDB',
            method: 'POST',
            url: '{{baseUrl}}/db/mongo/insert',
            body: {
                collection: 'audit_logs',
                document: {
                    action: 'db.transaction.completed',
                    transactionId: '{{txnId}}',
                    userId: 'usr_001',
                    details: 'Bulk archive + history insert'
                }
            },
            extract: { auditDocId: 'insertedIds.0' },
            validate: { status: 201 },
            messageCount: 2
        },
        {
            id: 'CACHE_SET',
            name: 'Atualizar Cache Redis',
            method: 'POST',
            url: '{{baseUrl}}/db/redis/set',
            body: {
                key: 'orders:summary:usr_001',
                value: { pgRows: '{{pgRows}}', mongoLogs: '{{mongoDocCount}}', lastTxn: '{{txnId}}' },
                ttl: 1800
            },
            validate: { status: 200 },
            messageCount: 2
        },
        {
            id: 'CACHE_DEL',
            name: 'Invalidar Cache Antigo',
            method: 'POST',
            url: '{{baseUrl}}/db/redis/del',
            body: { keys: ['orders:list:usr_001', 'orders:analytics:usr_001'] },
            validate: { status: 200 },
            messageCount: 2
        }
    ]
};
