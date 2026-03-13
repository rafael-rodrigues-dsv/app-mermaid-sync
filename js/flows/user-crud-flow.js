/**
 * Flow: CRUD completo de Usuário
 * Sequence diagram com raias: Cliente, Auth, User API, PostgreSQL, Redis
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
    diagram: `sequenceDiagram
        box rgb(232,240,254) 🖥️ Cliente
            participant Client as 🌐 Browser
        end
        box rgb(237,231,246) 🔐 Auth
            participant Auth as 🔐 Auth API
        end
        box rgb(232,245,233) 👤 User Service
            participant User as 👤 User API
        end
        box rgb(255,243,224) 🗄️ Banco Relacional
            participant PG as 🐘 PostgreSQL
        end
        box rgb(252,228,236) ⚡ Cache
            participant Redis as ⚡ Redis
        end

        Client->>+Auth: POST /auth/login (admin)
        Auth->>+PG: SELECT user WHERE email
        PG-->>-Auth: User row
        Auth-->>-Client: 200 { token }

        Note over Client,Redis: 📋 LIST - Listar todos os usuários
        Client->>+User: GET /users 🔑
        User->>+PG: SELECT * FROM users
        PG-->>-User: 3 rows
        User-->>-Client: 200 { data: [3 users] }

        Note over Client,Redis: ➕ CREATE - Criar novo usuário
        Client->>+User: POST /users { name, email }
        User->>+PG: INSERT INTO users
        PG-->>-User: 201 new row
        User->>+Redis: DEL cache:users:list
        Redis-->>-User: Invalidated
        User-->>-Client: 201 { id: usr_new }

        Note over Client,Redis: 🔍 READ - Buscar usuário criado
        Client->>+User: GET /users/usr_new
        User->>+Redis: GET cache:user:usr_new
        Redis-->>-User: MISS
        User->>+PG: SELECT * FROM users WHERE id
        PG-->>-User: User row
        User->>+Redis: SET cache:user:usr_new
        Redis-->>-User: Cached
        User-->>-Client: 200 user details

        Note over Client,Redis: ✏️ UPDATE - Atualizar usuário
        Client->>+User: PUT /users/usr_new { name, role }
        User->>+PG: UPDATE users SET name, role
        PG-->>-User: Updated
        User->>+Redis: DEL cache:user:usr_new
        Redis-->>-User: Invalidated
        User-->>-Client: 200 updated

        Note over Client,Redis: 🗑️ DELETE - Remover usuário
        Client->>+User: DELETE /users/usr_new
        User->>+PG: DELETE FROM users WHERE id
        PG-->>-User: Deleted
        User->>+Redis: DEL cache:user:usr_new
        Redis-->>-User: Cleaned
        User-->>-Client: 200 deleted

        Note over Client,Redis: ✅ VERIFY - Confirmar remoção
        Client->>+User: GET /users (verify)
        User->>+PG: SELECT * FROM users
        PG-->>-User: 3 rows (back to original)
        User-->>-Client: 200 { data: [3 users] }`,
    steps: [
        {
            id: 'LOGIN',
            name: 'Login como Admin',
            method: 'POST',
            url: '{{baseUrl}}/auth/login',
            body: { email: '{{email}}', password: '{{password}}' },
            extract: { token: 'token' },
            validate: { status: 200 },
            messageCount: 4
        },
        {
            id: 'LIST',
            name: 'Listar Todos os Usuários',
            method: 'GET',
            url: '{{baseUrl}}/users',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            extract: { totalBefore: 'total' },
            validate: { status: 200 },
            messageCount: 4
        },
        {
            id: 'CREATE',
            name: 'Criar Novo Usuário',
            method: 'POST',
            url: '{{baseUrl}}/users',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: { name: 'Novo Usuário Teste', email: 'novo@test.com', role: 'user' },
            extract: { newUserId: 'id', newUserName: 'name' },
            validate: { status: 201 },
            messageCount: 6
        },
        {
            id: 'GET_ONE',
            name: 'Buscar Usuário Criado',
            method: 'GET',
            url: '{{baseUrl}}/users/{{newUserId}}',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            validate: { status: 200 },
            messageCount: 8
        },
        {
            id: 'UPDATE',
            name: 'Atualizar Usuário',
            method: 'PUT',
            url: '{{baseUrl}}/users/{{newUserId}}',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            body: { name: 'Usuário Atualizado', email: 'atualizado@test.com', role: 'admin' },
            validate: { status: 200 },
            messageCount: 6
        },
        {
            id: 'DELETE_USER',
            name: 'Deletar Usuário',
            method: 'DELETE',
            url: '{{baseUrl}}/users/{{newUserId}}',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            validate: { status: 200 },
            messageCount: 6
        },
        {
            id: 'VERIFY',
            name: 'Verificar Lista Final',
            method: 'GET',
            url: '{{baseUrl}}/users',
            headers: { 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' },
            extract: { totalAfter: 'total' },
            validate: { status: 200 },
            messageCount: 4
        }
    ]
};
