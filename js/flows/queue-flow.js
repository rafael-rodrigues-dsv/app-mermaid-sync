/**
 * Flow: Publicar em Fila → Consumir → Processar → DLQ Retry
 * Sequence diagram com raias: App, Queue, Worker, DBs, Cache
 */
const QueueFlow = {
    id: 'queue-flow',
    name: '📨 Queue Flow (RabbitMQ/Kafka)',
    description: 'Verificar filas → Publicar evento → Consumir → PG → Mongo → Redis → DLQ',
    variables: {
        baseUrl: 'http://mock',
        email: 'admin@test.com',
        password: 'admin123'
    },
    diagram: `sequenceDiagram
        box rgb(30,40,60) 🖥️ Aplicação
            participant App as 📦 Order Service
        end
        box rgb(55,40,15) 📨 Mensageria
            participant RMQ as 📨 RabbitMQ
            participant DLQ as 💀 Dead Letter Queue
        end
        box rgb(35,30,55) ⚙️ Workers
            participant Worker as ⚙️ Consumer Worker
        end
        box rgb(50,30,30) 🐘 Banco Relacional
            participant PG as 🐘 PostgreSQL
        end
        box rgb(30,45,25) 🍃 Banco NoSQL
            participant Mongo as 🍃 MongoDB
        end
        box rgb(55,25,25) ⚡ Cache
            participant Redis as ⚡ Redis
        end

        Note over App,Redis: 📊 Health check da fila
        App->>+RMQ: GET /queue/orders/status
        RMQ-->>-App: running (15 msgs, 3 consumers)

        Note over App,Redis: 📤 Publicar evento order.created
        App->>+RMQ: PUBLISH order.events / order.created
        Note right of RMQ: exchange: order.events<br/>routingKey: order.created
        RMQ-->>-App: ACK (msg_id)

        Note over App,Redis: 📥 Consumer lê a mensagem
        RMQ->>+Worker: DELIVER message
        Worker-->>-RMQ: ACK (deliveryTag: 1)

        Note over App,Redis: 🐘 Persistir no PostgreSQL
        Worker->>+PG: INSERT INTO orders (id, user_id, total)
        PG-->>-Worker: 201 RETURNING id

        Note over App,Redis: 🍃 Log de evento no MongoDB
        Worker->>+Mongo: insertOne(event_logs)
        Note right of Mongo: { event: order.processed,<br/>source: queue.consumer }
        Mongo-->>-Worker: insertedId

        Note over App,Redis: ⚡ Cache do resultado no Redis
        Worker->>+Redis: SET order:ord_new_001 (TTL 3600)
        Redis-->>-Worker: OK

        Note over App,Redis: 📊 Verificar fila após processamento
        App->>+RMQ: GET /queue/orders/status
        RMQ-->>-App: running (14 msgs)

        Note over App,Redis: 💀 Re-processar mensagens da DLQ
        App->>+DLQ: GET failed messages
        DLQ-->>-App: 1 message
        App->>+RMQ: PUBLISH retry to original queue
        RMQ-->>-App: requeued ✅`,
    steps: [
        {
            id: 'Q_HEALTH',
            name: 'Verificar Status da Fila',
            method: 'GET',
            url: '{{baseUrl}}/queue/orders/status',
            extract: { queueMessages: 'messages', queueConsumers: 'consumers' },
            validate: { status: 200 },
            messageCount: 2
        },
        {
            id: 'PUBLISH',
            name: 'Publicar Evento na Fila',
            method: 'POST',
            url: '{{baseUrl}}/queue/publish',
            body: {
                exchange: 'order.events',
                routingKey: 'order.created',
                queue: 'order.processing',
                message: { event: 'order.created', orderId: 'ord_new_001', userId: 'usr_001', total: 59.98 }
            },
            extract: { messageId: 'messageId' },
            validate: { status: 200 },
            messageCount: 2
        },
        {
            id: 'CONSUME',
            name: 'Consumir Mensagem da Fila',
            method: 'POST',
            url: '{{baseUrl}}/queue/consume',
            body: { queue: 'order.processing', ack: true },
            extract: { consumedEvent: 'messages.0.payload.event' },
            validate: { status: 200 },
            messageCount: 2
        },
        {
            id: 'PG_INSERT',
            name: 'Inserir no PostgreSQL',
            method: 'POST',
            url: '{{baseUrl}}/db/pg/query',
            body: {
                sql: 'INSERT INTO orders (id, user_id, total, status) VALUES ($1, $2, $3, $4) RETURNING id',
                params: ['ord_new_001', 'usr_001', 59.98, 'confirmed']
            },
            extract: { pgInsertedId: 'rows.0.id' },
            validate: { status: 201 },
            messageCount: 2
        },
        {
            id: 'MONGO_LOG',
            name: 'Registrar Log no MongoDB',
            method: 'POST',
            url: '{{baseUrl}}/db/mongo/insert',
            body: {
                collection: 'event_logs',
                document: { event: 'order.processed', orderId: 'ord_new_001', source: 'queue.consumer', messageId: '{{messageId}}' }
            },
            extract: { mongoDocId: 'insertedIds.0' },
            validate: { status: 201 },
            messageCount: 2
        },
        {
            id: 'CACHE_SET',
            name: 'Gravar Cache no Redis',
            method: 'POST',
            url: '{{baseUrl}}/db/redis/set',
            body: { key: 'order:ord_new_001', value: { orderId: 'ord_new_001', status: 'confirmed', total: 59.98 }, ttl: 3600 },
            validate: { status: 200 },
            messageCount: 2
        },
        {
            id: 'Q_STATUS',
            name: 'Verificar Fila Após Processamento',
            method: 'GET',
            url: '{{baseUrl}}/queue/orders/status',
            extract: { finalQueueMessages: 'messages' },
            validate: { status: 200 },
            messageCount: 2
        },
        {
            id: 'DLQ_RETRY',
            name: 'Retry de Dead Letter Queue',
            method: 'POST',
            url: '{{baseUrl}}/queue/dlq/retry',
            body: { queue: 'order.processing', messageId: '{{messageId}}' },
            validate: { status: 200 },
            continueOnError: true,
            messageCount: 4
        }
    ]
};
