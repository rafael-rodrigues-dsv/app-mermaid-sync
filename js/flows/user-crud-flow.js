/**
 * Flow: CRUD completo de Usuário
 */
const UserCrudFlow = {
    id: 'user-crud-flow',
    name: '👤 User CRUD Flow',
    description: 'Login → Listar Users → Criar User → Buscar → Atualizar → Deletar → Verificar',
    variables: {
        baseUrl: 'http://mock',
        email: 'admin@test.com',
        password: 'admin123'
    },
    diagram: `graph TD
        START([🚀 Início]) --> LOGIN[🔐 POST /auth/login]
        LOGIN -->|200 OK| LIST[📋 GET /users]
        LOGIN -->|401| ERR_LOGIN[❌ Login Falhou]
        LIST -->|200 OK| CREATE[➕ POST /users]
        CREATE -->|201 Created| GET_ONE[🔍 GET /users/:id]
        GET_ONE -->|200 OK| UPDATE[✏️ PUT /users/:id]
        UPDATE -->|200 OK| DELETE_USER[🗑️ DELETE /users/:id]
        DELETE_USER -->|200 OK| VERIFY[📋 GET /users - Verificar]
        VERIFY --> FIM([✅ CRUD Completo])
        ERR_LOGIN --> FIM_ERR([❌ Fim com Erro])

        style START fill:#1f6feb,stroke:#58a6ff,color:#fff
        style FIM fill:#238636,stroke:#3fb950,color:#fff
        style FIM_ERR fill:#da3633,stroke:#f85149,color:#fff
        style ERR_LOGIN fill:#da3633,stroke:#f85149,color:#fff`,
    steps: [
        {
            id: 'LOGIN',
            name: 'Login como Admin',
            method: 'POST',
            url: '{{baseUrl}}/auth/login',
            body: { email: '{{email}}', password: '{{password}}' },
            extract: { token: 'token' },
            validate: { status: 200 }
        },
        {
            id: 'LIST',
            name: 'Listar Todos os Usuários',
            method: 'GET',
            url: '{{baseUrl}}/users',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            extract: { totalBefore: 'total' },
            validate: { status: 200 }
        },
        {
            id: 'CREATE',
            name: 'Criar Novo Usuário',
            method: 'POST',
            url: '{{baseUrl}}/users',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: {
                name: 'Novo Usuário Teste',
                email: 'novo@test.com',
                role: 'user'
            },
            extract: { newUserId: 'id', newUserName: 'name' },
            validate: { status: 201 }
        },
        {
            id: 'GET_ONE',
            name: 'Buscar Usuário Criado',
            method: 'GET',
            url: '{{baseUrl}}/users/{{newUserId}}',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            validate: { status: 200 }
        },
        {
            id: 'UPDATE',
            name: 'Atualizar Usuário',
            method: 'PUT',
            url: '{{baseUrl}}/users/{{newUserId}}',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: {
                name: 'Usuário Atualizado',
                email: 'atualizado@test.com',
                role: 'admin'
            },
            validate: { status: 200 }
        },
        {
            id: 'DELETE_USER',
            name: 'Deletar Usuário',
            method: 'DELETE',
            url: '{{baseUrl}}/users/{{newUserId}}',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            validate: { status: 200 }
        },
        {
            id: 'VERIFY',
            name: 'Verificar Lista Final',
            method: 'GET',
            url: '{{baseUrl}}/users',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            extract: { totalAfter: 'total' },
            validate: { status: 200 }
        }
    ]
};
