/**
 * Flow: E-Commerce completo - API + Fila + PG + Mongo + Redis + APIs Externas
 */
const FullIntegrationFlow = {
    id: 'full-integration-flow',
    name: '🌐 Integração Completa (E-Commerce)',
    description: 'API → CEP → Frete → Pedido (PG) → Pagamento → Fila → Mongo Log → Redis Cache → Email → Push',
    variables: {
        baseUrl: 'http://mock',
        email: 'admin@test.com',
        password: 'admin123'
    },
    diagram: `graph TD
        START([🚀 Cliente faz Checkout]) --> LOGIN[🔐 POST /auth/login]
        LOGIN -->|200 OK| CEP[🌍 POST /external/cep<br/>Buscar endereço]
        LOGIN -->|401| ERR[❌ Erro]

        CEP -->|endereço| FRETE[🚚 POST /external/shipping<br/>Calcular frete]
        FRETE -->|opções| CAMBIO[💱 POST /external/exchange-rate<br/>USD → BRL]
        CAMBIO -->|rate| PG_INSERT[🐘 POST /db/pg/query<br/>INSERT order]

        PG_INSERT -->|201| PAYMENT[💳 POST /payments<br/>Processar pagamento]
        PAYMENT -->|approved| PG_UPDATE[🐘 POST /db/pg/query<br/>UPDATE order status]
        PAYMENT -->|402| ERR_PAY[❌ Pagamento Recusado]

        PG_UPDATE -->|updated| Q_PUBLISH[📤 POST /queue/publish<br/>order.confirmed event]
        Q_PUBLISH -->|published| MONGO_LOG[🍃 POST /db/mongo/insert<br/>order_events log]
        MONGO_LOG -->|inserted| CACHE[⚡ POST /db/redis/set<br/>Cache do pedido]

        CACHE -->|OK| EMAIL[📧 POST /notifications/email<br/>Confirmação]
        EMAIL -->|sent| PUSH[📱 POST /notifications/push<br/>Push notification]

        PUSH -->|delivered| SCORE[📊 POST /external/credit-score<br/>Atualizar score]
        SCORE --> FIM([✅ Checkout Completo])

        ERR --> FIM_ERR([❌ Fim com Erro])
        ERR_PAY --> FIM_ERR

        style START fill:#1f6feb,stroke:#58a6ff,color:#fff
        style FIM fill:#238636,stroke:#3fb950,color:#fff
        style FIM_ERR fill:#da3633,stroke:#f85149,color:#fff
        style ERR fill:#da3633,stroke:#f85149,color:#fff
        style ERR_PAY fill:#da3633,stroke:#f85149,color:#fff

        style CEP fill:#0891b2,stroke:#22d3ee,color:#fff
        style FRETE fill:#0891b2,stroke:#22d3ee,color:#fff
        style CAMBIO fill:#0891b2,stroke:#22d3ee,color:#fff
        style SCORE fill:#0891b2,stroke:#22d3ee,color:#fff

        style PG_INSERT fill:#336791,stroke:#58a6ff,color:#fff
        style PG_UPDATE fill:#336791,stroke:#58a6ff,color:#fff

        style Q_PUBLISH fill:#d29922,stroke:#f0c000,color:#000
        style MONGO_LOG fill:#4db33d,stroke:#3fb950,color:#fff
        style CACHE fill:#dc382d,stroke:#f85149,color:#fff

        style PAYMENT fill:#7c3aed,stroke:#a78bfa,color:#fff
        style EMAIL fill:#6e40c9,stroke:#bc8cff,color:#fff
        style PUSH fill:#6e40c9,stroke:#bc8cff,color:#fff`,
    steps: [
        {
            id: 'LOGIN',
            name: 'Login do Cliente',
            method: 'POST',
            url: '{{baseUrl}}/auth/login',
            body: { email: '{{email}}', password: '{{password}}' },
            extract: { token: 'token', userId: 'user.id', userName: 'user.name' },
            validate: { status: 200 }
        },
        {
            id: 'CEP',
            name: 'Buscar Endereço (API Externa)',
            method: 'POST',
            url: '{{baseUrl}}/external/cep',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: { cep: '01001-000' },
            extract: { cidade: 'cidade', estado: 'estado', logradouro: 'logradouro' },
            validate: { status: 200 }
        },
        {
            id: 'FRETE',
            name: 'Calcular Frete (API Externa)',
            method: 'POST',
            url: '{{baseUrl}}/external/shipping/calculate',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: { from: '04543-907', to: '01001-000', weight: 2.5 },
            extract: { shippingOptions: 'options', cheapestShipping: 'options.0.price' },
            validate: { status: 200 }
        },
        {
            id: 'CAMBIO',
            name: 'Consultar Câmbio USD→BRL',
            method: 'POST',
            url: '{{baseUrl}}/external/exchange-rate',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: { from: 'USD', to: 'BRL' },
            extract: { exchangeRate: 'rate' },
            validate: { status: 200 }
        },
        {
            id: 'PG_INSERT',
            name: 'Criar Pedido no PostgreSQL',
            method: 'POST',
            url: '{{baseUrl}}/db/pg/query',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: {
                sql: 'INSERT INTO orders (user_id, total, shipping_cost, status, address) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                params: ['{{userId}}', 159.97, '{{cheapestShipping}}', 'pending', '{{logradouro}}, {{cidade}}-{{estado}}']
            },
            extract: { orderId: 'rows.0.id' },
            validate: { status: 201 }
        },
        {
            id: 'PAYMENT',
            name: 'Processar Pagamento',
            method: 'POST',
            url: '{{baseUrl}}/payments',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: { orderId: '{{orderId}}', amount: 159.97, method: 'credit_card' },
            extract: { paymentId: 'id', transactionId: 'transactionId' },
            validate: { status: 200 }
        },
        {
            id: 'PG_UPDATE',
            name: 'Atualizar Status no PostgreSQL',
            method: 'POST',
            url: '{{baseUrl}}/db/pg/query',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: {
                sql: 'UPDATE orders SET status = $1, payment_id = $2, updated_at = NOW() WHERE id = $3',
                params: ['confirmed', '{{paymentId}}', '{{orderId}}']
            },
            validate: { status: 200 }
        },
        {
            id: 'Q_PUBLISH',
            name: 'Publicar Evento na Fila',
            method: 'POST',
            url: '{{baseUrl}}/queue/publish',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: {
                exchange: 'order.events',
                routingKey: 'order.confirmed',
                queue: 'order.fulfillment',
                message: {
                    event: 'order.confirmed',
                    orderId: '{{orderId}}',
                    userId: '{{userId}}',
                    paymentId: '{{paymentId}}',
                    total: 159.97
                }
            },
            extract: { queueMessageId: 'messageId' },
            validate: { status: 200 }
        },
        {
            id: 'MONGO_LOG',
            name: 'Registrar no MongoDB',
            method: 'POST',
            url: '{{baseUrl}}/db/mongo/insert',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: {
                collection: 'order_events',
                document: {
                    event: 'checkout.completed',
                    orderId: '{{orderId}}',
                    userId: '{{userId}}',
                    paymentId: '{{paymentId}}',
                    transactionId: '{{transactionId}}',
                    address: '{{cidade}}-{{estado}}',
                    total: 159.97,
                    exchangeRate: '{{exchangeRate}}'
                }
            },
            extract: { eventDocId: 'insertedIds.0' },
            validate: { status: 201 }
        },
        {
            id: 'CACHE',
            name: 'Cache do Pedido no Redis',
            method: 'POST',
            url: '{{baseUrl}}/db/redis/set',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: {
                key: 'order:{{orderId}}',
                value: { orderId: '{{orderId}}', status: 'confirmed', total: 159.97, userId: '{{userId}}' },
                ttl: 7200
            },
            validate: { status: 200 }
        },
        {
            id: 'EMAIL',
            name: 'Enviar Email de Confirmação',
            method: 'POST',
            url: '{{baseUrl}}/notifications/email',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: {
                to: '{{email}}',
                subject: 'Pedido Confirmado #{{orderId}}',
                template: 'checkout_complete',
                data: { orderId: '{{orderId}}', total: 159.97, address: '{{logradouro}}, {{cidade}}' }
            },
            extract: { emailId: 'id' },
            validate: { status: 200 },
            continueOnError: true
        },
        {
            id: 'PUSH',
            name: 'Push Notification',
            method: 'POST',
            url: '{{baseUrl}}/notifications/push',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: {
                userId: '{{userId}}',
                title: 'Pedido Confirmado! 🎉',
                body: 'Seu pedido #{{orderId}} de R$ 159,97 foi confirmado.'
            },
            validate: { status: 200 },
            continueOnError: true
        },
        {
            id: 'SCORE',
            name: 'Atualizar Credit Score (API Externa)',
            method: 'POST',
            url: '{{baseUrl}}/external/credit-score',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: { cpf: '123.456.789-00' },
            extract: { creditScore: 'score', creditRisk: 'risk' },
            validate: { status: 200 },
            continueOnError: true
        }
    ]
};
