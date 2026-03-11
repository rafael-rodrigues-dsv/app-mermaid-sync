/**
 * Flow: Criar Pedido → Processar Pagamento → Notificar
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
    diagram: `graph TD
        START([🚀 Início]) --> LOGIN[🔐 POST /auth/login]
        LOGIN -->|200 OK| CREATE_ORDER[📦 POST /orders]
        LOGIN -->|401| ERR_LOGIN[❌ Login Falhou]
        CREATE_ORDER -->|201 Created| PROCESS_PAY[💳 POST /payments]
        CREATE_ORDER -->|400| ERR_ORDER[❌ Pedido Inválido]
        PROCESS_PAY -->|200 Approved| UPDATE_STATUS[📋 PUT /orders/:id/status]
        PROCESS_PAY -->|402| ERR_PAY[❌ Pagamento Recusado]
        UPDATE_STATUS -->|200 OK| SEND_EMAIL[📧 POST /notifications/email]
        SEND_EMAIL -->|200 OK| SEND_PUSH[📱 POST /notifications/push]
        SEND_PUSH --> GET_ORDER[🔍 GET /orders/:id]
        GET_ORDER --> FIM([✅ Pedido Completo])
        ERR_LOGIN --> FIM_ERR([❌ Fim com Erro])
        ERR_ORDER --> FIM_ERR
        ERR_PAY --> FIM_ERR

        style START fill:#1f6feb,stroke:#58a6ff,color:#fff
        style FIM fill:#238636,stroke:#3fb950,color:#fff
        style FIM_ERR fill:#da3633,stroke:#f85149,color:#fff
        style ERR_LOGIN fill:#da3633,stroke:#f85149,color:#fff
        style ERR_ORDER fill:#da3633,stroke:#f85149,color:#fff
        style ERR_PAY fill:#da3633,stroke:#f85149,color:#fff`,
    steps: [
        {
            id: 'LOGIN',
            name: 'Login',
            method: 'POST',
            url: '{{baseUrl}}/auth/login',
            body: { email: '{{email}}', password: '{{password}}' },
            extract: { token: 'token', userId: 'user.id' },
            validate: { status: 200 }
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
            validate: { status: 201 }
        },
        {
            id: 'PROCESS_PAY',
            name: 'Processar Pagamento',
            method: 'POST',
            url: '{{baseUrl}}/payments',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: {
                orderId: '{{orderId}}',
                amount: '{{orderTotal}}',
                method: 'credit_card'
            },
            extract: { paymentId: 'id', transactionId: 'transactionId' },
            validate: { status: 200 },
            continueOnError: false
        },
        {
            id: 'UPDATE_STATUS',
            name: 'Atualizar Status do Pedido',
            method: 'PUT',
            url: '{{baseUrl}}/orders/{{orderId}}/status',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: { status: 'confirmed' },
            validate: { status: 200 }
        },
        {
            id: 'SEND_EMAIL',
            name: 'Enviar Email de Confirmação',
            method: 'POST',
            url: '{{baseUrl}}/notifications/email',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: {
                to: '{{email}}',
                subject: 'Pedido Confirmado',
                template: 'order_confirmation',
                data: { orderId: '{{orderId}}', total: '{{orderTotal}}' }
            },
            extract: { emailNotifId: 'id' },
            validate: { status: 200 },
            continueOnError: true
        },
        {
            id: 'SEND_PUSH',
            name: 'Enviar Push Notification',
            method: 'POST',
            url: '{{baseUrl}}/notifications/push',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: {
                userId: '{{userId}}',
                title: 'Pedido Confirmado! 🎉',
                body: 'Seu pedido {{orderId}} foi confirmado.'
            },
            validate: { status: 200 },
            continueOnError: true
        },
        {
            id: 'GET_ORDER',
            name: 'Verificar Pedido Final',
            method: 'GET',
            url: '{{baseUrl}}/orders/{{orderId}}',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            validate: { status: 200 }
        }
    ]
};
