/**
 * Flow: Autenticação → Token → Acessar Recurso Protegido
 * Sequence diagram com raias por camada
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
    diagram: `sequenceDiagram
        box rgb(30,40,60) 🖥️ Cliente
            participant Client as 🌐 Browser
        end
        box rgb(25,50,40) 🔀 API Gateway
            participant GW as 🔀 Gateway
        end
        box rgb(40,30,55) 🔐 Auth Service
            participant Auth as 🔐 Auth API
        end
        box rgb(30,45,35) 👤 User Service
            participant User as 👤 User API
        end
        box rgb(50,30,30) 🗄️ Data Layer
            participant PG as 🐘 PostgreSQL
            participant Redis as ⚡ Redis
        end

        Client->>+GW: POST /auth/login
        GW->>+Auth: Forward login
        Auth->>+PG: SELECT user WHERE email
        PG-->>-Auth: User row
        Auth->>+Redis: SET session token (TTL 3600)
        Redis-->>-Auth: OK
        Auth-->>-GW: 200 token + refreshToken
        GW-->>-Client: 200 JWT Token

        Client->>+GW: GET /users/usr_001 🔑
        GW->>+User: Forward + Bearer token
        User->>+Redis: GET cache:user:usr_001
        Redis-->>-User: HIT cached data
        User-->>-GW: 200 User profile
        GW-->>-Client: 200 { id, name, email }

        Client->>+GW: POST /auth/refresh
        GW->>+Auth: Refresh token
        Auth->>+Redis: VALIDATE refreshToken
        Redis-->>-Auth: Valid
        Auth->>+Redis: SET new session token
        Redis-->>-Auth: OK
        Auth-->>-GW: 200 newToken
        GW-->>-Client: 200 New JWT

        Client->>+GW: GET /users (list)
        GW->>+User: List all users
        User->>+PG: SELECT * FROM users
        PG-->>-User: 3 rows
        User-->>-GW: 200 users[]
        GW-->>-Client: 200 { data: [...] }

        Client->>+GW: POST /auth/logout
        GW->>+Auth: Logout
        Auth->>+Redis: DEL session token
        Redis-->>-Auth: Deleted
        Auth-->>-GW: 200 OK
        GW-->>-Client: 200 ✅`,
    steps: [
        {
            id: 'LOGIN',
            name: 'Login',
            method: 'POST',
            url: '{{baseUrl}}/auth/login',
            body: { email: '{{email}}', password: '{{password}}' },
            extract: { token: 'token', refreshToken: 'refreshToken', userId: 'user.id', userName: 'user.name' },
            validate: { status: 200 },
            messageCount: 8
        },
        {
            id: 'GET_USER',
            name: 'Obter Perfil do Usuário',
            method: 'GET',
            url: '{{baseUrl}}/users/{{userId}}',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            extract: { userEmail: 'email' },
            validate: { status: 200 },
            messageCount: 6
        },
        {
            id: 'REFRESH',
            name: 'Refresh Token',
            method: 'POST',
            url: '{{baseUrl}}/auth/refresh',
            body: { refreshToken: '{{refreshToken}}' },
            extract: { token: 'token', refreshToken: 'refreshToken' },
            validate: { status: 200 },
            messageCount: 8
        },
        {
            id: 'GET_USERS',
            name: 'Listar Usuários',
            method: 'GET',
            url: '{{baseUrl}}/users',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            extract: { totalUsers: 'total' },
            validate: { status: 200 },
            messageCount: 6
        },
        {
            id: 'LOGOUT',
            name: 'Logout',
            method: 'POST',
            url: '{{baseUrl}}/auth/logout',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            validate: { status: 200 },
            messageCount: 6
        }
    ]
};
