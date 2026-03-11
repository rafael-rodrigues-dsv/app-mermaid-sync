/**
 * Flow: Autenticação → Token → Acessar Recurso Protegido
 */
const AuthFlow = {
    id: 'auth-flow',
    name: '🔐 Auth Flow',
    description: 'Login → Obter Token → Acessar recurso protegido → Refresh Token → Logout',
    variables: {
        baseUrl: 'http://mock',
        email: 'admin@test.com',
        password: 'admin123'
    },
    diagram: `graph TD
        START([🚀 Início]) --> LOGIN[🔐 POST /auth/login]
        LOGIN -->|200 OK| GET_USER[👤 GET /users/me]
        LOGIN -->|401| ERR_LOGIN[❌ Login Falhou]
        GET_USER -->|200 OK| REFRESH[🔄 POST /auth/refresh]
        GET_USER -->|403| ERR_AUTH[❌ Não Autorizado]
        REFRESH -->|200 OK| GET_USERS[📋 GET /users]
        REFRESH -->|401| ERR_REFRESH[❌ Token Expirado]
        GET_USERS -->|200 OK| LOGOUT[🚪 POST /auth/logout]
        LOGOUT --> FIM([✅ Fim])
        ERR_LOGIN --> FIM_ERR([❌ Fim com Erro])
        ERR_AUTH --> FIM_ERR
        ERR_REFRESH --> FIM_ERR

        style START fill:#1f6feb,stroke:#58a6ff,color:#fff
        style FIM fill:#238636,stroke:#3fb950,color:#fff
        style FIM_ERR fill:#da3633,stroke:#f85149,color:#fff
        style ERR_LOGIN fill:#da3633,stroke:#f85149,color:#fff
        style ERR_AUTH fill:#da3633,stroke:#f85149,color:#fff
        style ERR_REFRESH fill:#da3633,stroke:#f85149,color:#fff`,
    steps: [
        {
            id: 'LOGIN',
            name: 'Login',
            method: 'POST',
            url: '{{baseUrl}}/auth/login',
            body: { email: '{{email}}', password: '{{password}}' },
            extract: {
                token: 'token',
                refreshToken: 'refreshToken',
                userId: 'user.id',
                userName: 'user.name'
            },
            validate: { status: 200 }
        },
        {
            id: 'GET_USER',
            name: 'Obter Perfil do Usuário',
            method: 'GET',
            url: '{{baseUrl}}/users/{{userId}}',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            extract: {
                userEmail: 'email'
            },
            validate: { status: 200 }
        },
        {
            id: 'REFRESH',
            name: 'Refresh Token',
            method: 'POST',
            url: '{{baseUrl}}/auth/refresh',
            body: { refreshToken: '{{refreshToken}}' },
            extract: {
                token: 'token',
                refreshToken: 'refreshToken'
            },
            validate: { status: 200 }
        },
        {
            id: 'GET_USERS',
            name: 'Listar Usuários',
            method: 'GET',
            url: '{{baseUrl}}/users',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            extract: {
                totalUsers: 'total'
            },
            validate: { status: 200 }
        },
        {
            id: 'LOGOUT',
            name: 'Logout',
            method: 'POST',
            url: '{{baseUrl}}/auth/logout',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            validate: { status: 200 }
        }
    ]
};
