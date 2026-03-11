/**
 * Flow: Publicar em Fila → Consumir → Processar → DLQ Retry
 */
const QueueFlow = {
    id: 'queue-flow',
    name: '📨 Queue Flow (RabbitMQ/Kafka)',
    description: 'Verificar filas → Publicar evento → Consumir mensagem → Processar → Cache resultado → Verificar DLQ',
    variables: {
        baseUrl: 'http://mock',
        email: 'admin@test.com',
        password: 'admin123'
    },
    diagram: `graph TD
        START([🚀 Início]) --> LOGIN[🔐 POST /auth/login]
        LOGIN -->|200 OK| Q_HEALTH[📊 GET /queue/orders/status]
        LOGIN -->|401| ERR_LOGIN[❌ Login Falhou]
        Q_HEALTH -->|running| PUBLISH[📤 POST /queue/publish<br/>exchange: order.events]
        Q_HEALTH -->|down| ERR_QUEUE[❌ Fila Indisponível]
        PUBLISH -->|published| CONSUME[📥 POST /queue/consume<br/>queue: order.processing]
        CONSUME -->|messages| PG_INSERT[🐘 POST /db/pg/query<br/>INSERT INTO orders]
        PG_INSERT -->|201 inserted| MONGO_LOG[🍃 POST /db/mongo/insert<br/>event_log collection]
        MONGO_LOG -->|inserted| CACHE_SET[⚡ POST /db/redis/set<br/>cache: order data]
        CACHE_SET -->|OK| Q_STATUS[📊 GET /queue/orders/status<br/>Verificar fila]
        Q_STATUS --> DLQ_RETRY[🔄 POST /queue/dlq/retry<br/>Re-processar falhas]
        DLQ_RETRY --> FIM([✅ Pipeline Completo])
        ERR_LOGIN --> FIM_ERR([❌ Fim com Erro])
        ERR_QUEUE --> FIM_ERR

        style START fill:#1f6feb,stroke:#58a6ff,color:#fff
        style FIM fill:#238636,stroke:#3fb950,color:#fff
        style FIM_ERR fill:#da3633,stroke:#f85149,color:#fff
        style ERR_LOGIN fill:#da3633,stroke:#f85149,color:#fff
        style ERR_QUEUE fill:#da3633,stroke:#f85149,color:#fff
        style PUBLISH fill:#d29922,stroke:#f0c000,color:#000
        style CONSUME fill:#d29922,stroke:#f0c000,color:#000
        style PG_INSERT fill:#336791,stroke:#58a6ff,color:#fff
        style MONGO_LOG fill:#4db33d,stroke:#3fb950,color:#fff
        style CACHE_SET fill:#dc382d,stroke:#f85149,color:#fff
        style DLQ_RETRY fill:#6e40c9,stroke:#bc8cff,color:#fff`,
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
            id: 'Q_HEALTH',
            name: 'Verificar Status da Fila',
            method: 'GET',
            url: '{{baseUrl}}/queue/orders/status',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            extract: { queueMessages: 'messages', queueConsumers: 'consumers' },
            validate: { status: 200 }
        },
        {
            id: 'PUBLISH',
            name: 'Publicar Evento na Fila',
            method: 'POST',
            url: '{{baseUrl}}/queue/publish',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: {
                exchange: 'order.events',
                routingKey: 'order.created',
                queue: 'order.processing',
                message: {
                    event: 'order.created',
                    orderId: 'ord_new_001',
                    userId: '{{userId}}',
                    items: [{ productId: 'prod_001', quantity: 2, price: 29.99 }],
                    total: 59.98,
                    timestamp: '{{timestamp}}'
                }
            },
            extract: { messageId: 'messageId' },
            validate: { status: 200 }
        },
        {
            id: 'CONSUME',
            name: 'Consumir Mensagem da Fila',
            method: 'POST',
            url: '{{baseUrl}}/queue/consume',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: { queue: 'order.processing', ack: true },
            extract: { consumedEvent: 'messages.0.payload.event', consumedOrderId: 'messages.0.payload.orderId' },
            validate: { status: 200 }
        },
        {
            id: 'PG_INSERT',
            name: 'Inserir no PostgreSQL',
            method: 'POST',
            url: '{{baseUrl}}/db/pg/query',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: {
                sql: 'INSERT INTO orders (id, user_id, total, status) VALUES ($1, $2, $3, $4) RETURNING id',
                params: ['ord_new_001', '{{userId}}', 59.98, 'confirmed']
            },
            extract: { pgInsertedId: 'rows.0.id' },
            validate: { status: 201 }
        },
        {
            id: 'MONGO_LOG',
            name: 'Registrar Log no MongoDB',
            method: 'POST',
            url: '{{baseUrl}}/db/mongo/insert',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: {
                collection: 'event_logs',
                document: {
                    event: 'order.processed',
                    orderId: 'ord_new_001',
                    userId: '{{userId}}',
                    source: 'queue.consumer',
                    messageId: '{{messageId}}',
                    processedAt: '{{timestamp}}'
                }
            },
            extract: { mongoDocId: 'insertedIds.0' },
            validate: { status: 201 }
        },
        {
            id: 'CACHE_SET',
            name: 'Gravar Cache no Redis',
            method: 'POST',
            url: '{{baseUrl}}/db/redis/set',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: {
                key: 'order:ord_new_001',
                value: { orderId: 'ord_new_001', status: 'confirmed', total: 59.98 },
                ttl: 3600
            },
            validate: { status: 200 }
        },
        {
            id: 'Q_STATUS',
            name: 'Verificar Fila Após Processamento',
            method: 'GET',
            url: '{{baseUrl}}/queue/orders/status',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            extract: { finalQueueMessages: 'messages' },
            validate: { status: 200 }
        },
        {
            id: 'DLQ_RETRY',
            name: 'Retry de Dead Letter Queue',
            method: 'POST',
            url: '{{baseUrl}}/queue/dlq/retry',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: { queue: 'order.processing', messageId: '{{messageId}}' },
            validate: { status: 200 },
            continueOnError: true
        }
    ]
};
