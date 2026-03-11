/**
 * Flow: Criar Pedido → Processar Pagamento → Notificar
 * Sequence diagram com raias: Cliente, APIs, Pagamento, Banco, Fila, Notificações
 */
const OrderFlow = {
    id: 'order-flow',
    name: '📦 Order Flow',
    description: 'Login → Criar Pedido → Processar Pagamento → Atualizar Status → Notificar Cliente',
    variables: {
        baseUrl: 'http://mock',
        email: 'admin@test.com',
        password: 'admin123'
    },
    diagram: `sequenceDiagram
        box rgb(30,40,60) 🖥️ Cliente
            participant Client as 🌐 Browser
        end
        box rgb(25,50,40) 🔀 APIs
            participant Auth as 🔐 Auth
            participant Order as 📦 Order API
        end
        box rgb(55,30,50) 💳 Pagamento
            participant Pay as 💳 Payment API
            participant PayGW as 🏦 Gateway Externo
        end
        box rgb(50,30,30) 🗄️ Banco de Dados
            participant PG as 🐘 PostgreSQL
        end
        box rgb(45,40,20) 📨 Mensageria
            participant Queue as 📨 RabbitMQ
        end
        box rgb(35,25,55) 📧 Notificações
            participant Email as 📧 SMTP
            participant Push as 📱 Push Service
        end

        Client->>+Auth: POST /auth/login
        Auth->>+PG: SELECT user by email
        PG-->>-Auth: User found
        Auth-->>-Client: 200 { token }

        Client->>+Order: POST /orders (items[])
        Order->>+PG: INSERT INTO orders
        PG-->>-Order: 201 order created
        Order-->>-Client: 201 { orderId, total }

        Client->>+Pay: POST /payments
        Pay->>+PayGW: Process credit card
        PayGW-->>-Pay: Approved ✅
        Pay->>+PG: INSERT INTO payments
        PG-->>-Pay: Payment recorded
        Pay-->>-Client: 200 { approved }

        Client->>+Order: PUT /orders/:id/status
        Order->>+PG: UPDATE orders SET confirmed
        PG-->>-Order: Updated
        Order->>+Queue: PUBLISH order.confirmed
        Queue-->>-Order: ACK
        Order-->>-Client: 200 { confirmed }

        Client->>+Email: POST /notifications/email
        Email-->>-Client: 200 { sent }

        Client->>+Push: POST /notifications/push
        Push-->>-Client: 200 { delivered }

        Client->>+Order: GET /orders/:id
        Order->>+PG: SELECT order by id
        PG-->>-Order: Order data
        Order-->>-Client: 200 { order details }`,
    steps: [
        {
            id: 'LOGIN',
            name: 'Login',
            method: 'POST',
            url: '{{baseUrl}}/auth/login',
            body: { email: '{{email}}', password: '{{password}}' },
            extract: { token: 'token', userId: 'user.id' },
            validate: { status: 200 },
            messageCount: 4
        },
        {
            id: 'CREATE_ORDER',
            name: 'Criar Pedido',
            method: 'POST',
            url: '{{baseUrl}}/orders',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: {
                userId: '{{userId}}',
                items: [
                    { productId: 'prod_001', name: 'Widget Pro', price: 29.99, quantity: 2 },
                    { productId: 'prod_002', name: 'Gadget Plus', price: 49.99, quantity: 1 }
                ]
            },
            extract: { orderId: 'id', orderTotal: 'total' },
            validate: { status: 201 },
            messageCount: 4
        },
        {
            id: 'PROCESS_PAY',
            name: 'Processar Pagamento',
            method: 'POST',
            url: '{{baseUrl}}/payments',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: { orderId: '{{orderId}}', amount: '{{orderTotal}}', method: 'credit_card' },
            extract: { paymentId: 'id', transactionId: 'transactionId' },
            validate: { status: 200 },
            continueOnError: false,
            messageCount: 6
        },
        {
            id: 'UPDATE_STATUS',
            name: 'Atualizar Status do Pedido',
            method: 'PUT',
            url: '{{baseUrl}}/orders/{{orderId}}/status',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: { status: 'confirmed' },
            validate: { status: 200 },
            messageCount: 6
        },
        {
            id: 'SEND_EMAIL',
            name: 'Enviar Email de Confirmação',
            method: 'POST',
            url: '{{baseUrl}}/notifications/email',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: { to: '{{email}}', subject: 'Pedido Confirmado', template: 'order_confirmation', data: { orderId: '{{orderId}}', total: '{{orderTotal}}' } },
            extract: { emailNotifId: 'id' },
            validate: { status: 200 },
            continueOnError: true,
            messageCount: 2
        },
        {
            id: 'SEND_PUSH',
            name: 'Enviar Push Notification',
            method: 'POST',
            url: '{{baseUrl}}/notifications/push',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: { userId: '{{userId}}', title: 'Pedido Confirmado! 🎉', body: 'Seu pedido {{orderId}} foi confirmado.' },
            validate: { status: 200 },
            continueOnError: true,
            messageCount: 2
        },
        {
            id: 'GET_ORDER',
            name: 'Verificar Pedido Final',
            method: 'GET',
            url: '{{baseUrl}}/orders/{{orderId}}',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            validate: { status: 200 },
            messageCount: 4
        }
    ]
};
