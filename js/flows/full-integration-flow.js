/**
 * Flow: E-Commerce completo - API + Fila + PG + Mongo + Redis + APIs Externas
 * Sequence diagram com raias: Cliente, APIs Externas, PostgreSQL, Pagamento, Mensageria, MongoDB, Redis, Notificações
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
    diagram: `sequenceDiagram
        box rgb(30,40,60) 🖥️ Cliente
            participant App as 📱 Checkout App
        end
        box rgb(20,50,50) 🌍 APIs Externas
            participant CEP as 🌍 ViaCEP
            participant Ship as 🚚 Frete API
            participant FX as 💱 Câmbio API
            participant Score as 📊 Credit Score
        end
        box rgb(50,30,30) 🐘 Banco Relacional
            participant PG as 🐘 PostgreSQL
        end
        box rgb(50,20,50) 💳 Pagamento
            participant Pay as 💳 Payment Gateway
        end
        box rgb(55,40,15) 📨 Mensageria
            participant RMQ as 📨 RabbitMQ
        end
        box rgb(30,45,25) 🍃 Banco NoSQL
            participant Mongo as 🍃 MongoDB
        end
        box rgb(55,25,25) ⚡ Cache
            participant Redis as ⚡ Redis
        end
        box rgb(40,30,55) 📧 Notificações
            participant Email as 📧 Email Service
            participant Push as 📱 Push Service
        end

        Note over App,Push: 🌍 Consultar Endereço (ViaCEP)
        App->>+CEP: POST /external/cep {01001-000}
        CEP-->>-App: Praça da Sé, São Paulo-SP

        Note over App,Push: 🚚 Calcular Frete
        App->>+Ship: POST /external/shipping/calculate
        Note right of Ship: from: 04543-907<br/>to: 01001-000<br/>weight: 2.5kg
        Ship-->>-App: 3 opções (R$15.90 ~ R$45.00)

        Note over App,Push: 💱 Consultar Câmbio USD→BRL
        App->>+FX: POST /external/exchange-rate
        FX-->>-App: rate: 4.97

        Note over App,Push: 🐘 Criar Pedido no PostgreSQL
        App->>+PG: INSERT INTO orders (user_id, total, shipping)
        PG-->>-App: 201 RETURNING id (ord_new_001)

        Note over App,Push: 💳 Processar Pagamento
        App->>+Pay: POST /payments {R$159.97, credit_card}
        Pay-->>-App: approved (txn_001)

        Note over App,Push: 🐘 Atualizar Status do Pedido
        App->>+PG: UPDATE orders SET status='confirmed'
        PG-->>-App: updated

        Note over App,Push: 📨 Publicar Evento order.confirmed
        App->>+RMQ: PUBLISH order.events / order.confirmed
        Note right of RMQ: exchange: order.events<br/>routingKey: order.confirmed
        RMQ-->>-App: ACK (msg_id)

        Note over App,Push: 🍃 Registrar Evento no MongoDB
        App->>+Mongo: insertOne(order_events, {checkout.completed})
        Mongo-->>-App: insertedId

        Note over App,Push: ⚡ Cache do Pedido no Redis
        App->>+Redis: SET order:ord_new_001 (TTL 7200)
        Redis-->>-App: OK

        Note over App,Push: 📧 Email de Confirmação
        App->>+Email: POST /notifications/email
        Note right of Email: to: admin@test.com<br/>template: checkout_complete
        Email-->>-App: sent ✅

        Note over App,Push: 📱 Push Notification
        App->>+Push: POST /notifications/push
        Push-->>-App: delivered ✅

        Note over App,Push: 📊 Consultar Credit Score
        App->>+Score: POST /external/credit-score {CPF}
        Score-->>-App: score: 780, risk: low ✅`,
    steps: [
        {
            id: 'CEP',
            name: 'Buscar Endereço (API Externa)',
            method: 'POST',
            url: '{{baseUrl}}/external/cep',
            body: { cep: '01001-000' },
            extract: { cidade: 'cidade', estado: 'estado', logradouro: 'logradouro' },
            validate: { status: 200 },
            messageCount: 2
        },
        {
            id: 'FRETE',
            name: 'Calcular Frete (API Externa)',
            method: 'POST',
            url: '{{baseUrl}}/external/shipping/calculate',
            body: { from: '04543-907', to: '01001-000', weight: 2.5 },
            extract: { shippingOptions: 'options', cheapestShipping: 'options.0.price' },
            validate: { status: 200 },
            messageCount: 2
        },
        {
            id: 'CAMBIO',
            name: 'Consultar Câmbio USD→BRL',
            method: 'POST',
            url: '{{baseUrl}}/external/exchange-rate',
            body: { from: 'USD', to: 'BRL' },
            extract: { exchangeRate: 'rate' },
            validate: { status: 200 },
            messageCount: 2
        },
        {
            id: 'PG_INSERT',
            name: 'Criar Pedido no PostgreSQL',
            method: 'POST',
            url: '{{baseUrl}}/db/pg/query',
            body: {
                sql: 'INSERT INTO orders (user_id, total, shipping_cost, status, address) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                params: ['usr_001', 159.97, '{{cheapestShipping}}', 'pending', '{{logradouro}}, {{cidade}}-{{estado}}']
            },
            extract: { orderId: 'rows.0.id' },
            validate: { status: 201 },
            messageCount: 2
        },
        {
            id: 'PAYMENT',
            name: 'Processar Pagamento',
            method: 'POST',
            url: '{{baseUrl}}/payments',
            body: { orderId: '{{orderId}}', amount: 159.97, method: 'credit_card' },
            extract: { paymentId: 'id', transactionId: 'transactionId' },
            validate: { status: 200 },
            messageCount: 2
        },
        {
            id: 'PG_UPDATE',
            name: 'Atualizar Status no PostgreSQL',
            method: 'POST',
            url: '{{baseUrl}}/db/pg/query',
            body: {
                sql: 'UPDATE orders SET status = $1, payment_id = $2, updated_at = NOW() WHERE id = $3',
                params: ['confirmed', '{{paymentId}}', '{{orderId}}']
            },
            validate: { status: 200 },
            messageCount: 2
        },
        {
            id: 'Q_PUBLISH',
            name: 'Publicar Evento na Fila',
            method: 'POST',
            url: '{{baseUrl}}/queue/publish',
            body: {
                exchange: 'order.events',
                routingKey: 'order.confirmed',
                queue: 'order.fulfillment',
                message: {
                    event: 'order.confirmed',
                    orderId: '{{orderId}}',
                    userId: 'usr_001',
                    paymentId: '{{paymentId}}',
                    total: 159.97
                }
            },
            extract: { queueMessageId: 'messageId' },
            validate: { status: 200 },
            messageCount: 2
        },
        {
            id: 'MONGO_LOG',
            name: 'Registrar no MongoDB',
            method: 'POST',
            url: '{{baseUrl}}/db/mongo/insert',
            body: {
                collection: 'order_events',
                document: {
                    event: 'checkout.completed',
                    orderId: '{{orderId}}',
                    userId: 'usr_001',
                    paymentId: '{{paymentId}}',
                    transactionId: '{{transactionId}}',
                    address: '{{cidade}}-{{estado}}',
                    total: 159.97,
                    exchangeRate: '{{exchangeRate}}'
                }
            },
            extract: { eventDocId: 'insertedIds.0' },
            validate: { status: 201 },
            messageCount: 2
        },
        {
            id: 'CACHE',
            name: 'Cache do Pedido no Redis',
            method: 'POST',
            url: '{{baseUrl}}/db/redis/set',
            body: {
                key: 'order:{{orderId}}',
                value: { orderId: '{{orderId}}', status: 'confirmed', total: 159.97, userId: 'usr_001' },
                ttl: 7200
            },
            validate: { status: 200 },
            messageCount: 2
        },
        {
            id: 'EMAIL',
            name: 'Enviar Email de Confirmação',
            method: 'POST',
            url: '{{baseUrl}}/notifications/email',
            body: {
                to: '{{email}}',
                subject: 'Pedido Confirmado #{{orderId}}',
                template: 'checkout_complete',
                data: { orderId: '{{orderId}}', total: 159.97, address: '{{logradouro}}, {{cidade}}' }
            },
            extract: { emailId: 'id' },
            validate: { status: 200 },
            continueOnError: true,
            messageCount: 2
        },
        {
            id: 'PUSH',
            name: 'Push Notification',
            method: 'POST',
            url: '{{baseUrl}}/notifications/push',
            body: {
                userId: 'usr_001',
                title: 'Pedido Confirmado! 🎉',
                body: 'Seu pedido #{{orderId}} de R$ 159,97 foi confirmado.'
            },
            validate: { status: 200 },
            continueOnError: true,
            messageCount: 2
        },
        {
            id: 'SCORE',
            name: 'Atualizar Credit Score (API Externa)',
            method: 'POST',
            url: '{{baseUrl}}/external/credit-score',
            body: { cpf: '123.456.789-00' },
            extract: { creditScore: 'score', creditRisk: 'risk' },
            validate: { status: 200 },
            continueOnError: true,
            messageCount: 2
        }
    ]
};
