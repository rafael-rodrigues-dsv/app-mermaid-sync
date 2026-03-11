# 🔀 Mermaid Integration Flow Runner

Visualização **interativa** de fluxos de integração usando diagramas Mermaid com mock server embutido no browser.

> Sem React, sem frameworks — apenas HTML + JS + Mermaid.js

## O que faz

- Renderiza diagramas Mermaid mostrando integrações entre serviços
- Executa os endpoints mock na sequência (tipo Postman Collection Runner)
- As caixinhas do diagrama mudam de cor em tempo real: 🟡 executando → 🟢 sucesso / 🔴 erro
- Mostra request/response de cada step no painel lateral
- Suporta execução automática ou step-by-step

## Como rodar

Basta abrir o `index.html` no browser. Para evitar problemas de CORS com `file://`, use um server local:

```bash
# Com Python
python -m http.server 8080

# Com Node.js
npx serve .

# Com VS Code
# Instale a extensão "Live Server" e clique "Go Live"
```

Depois acesse `http://localhost:8080`

## Estrutura

```
├── index.html                 # Página principal
├── css/
│   └── style.css              # Estilos (dark theme)
├── js/
│   ├── app.js                 # Lógica principal (conecta tudo)
│   ├── flow-executor.js       # Engine que percorre os steps do flow
│   ├── mock-server.js         # Intercepta fetch() com respostas mock
│   └── flows/                 # Definições de flows
│       ├── auth-flow.js       # 🔐 Login → Token → Recurso → Logout
│       ├── order-flow.js      # 📦 Pedido → Pagamento → Notificação
│       └── user-crud-flow.js  # 👤 CRUD completo de usuário
├── diagrams/
│   └── integration-map.md     # Mapa geral (doc estático)
└── README.md
```

## Flows disponíveis

| Flow | Steps | Descrição |
|------|-------|-----------|
| 🔐 Auth Flow | 5 | Login → Obter perfil → Refresh token → Listar users → Logout |
| 📦 Order Flow | 7 | Login → Criar pedido → Pagamento → Atualizar status → Notificar |
| 👤 User CRUD | 7 | Login → Listar → Criar → Buscar → Atualizar → Deletar → Verificar |

## Como criar um novo flow

Crie um arquivo em `js/flows/meu-flow.js`:

```js
const MeuFlow = {
    id: 'meu-flow',
    name: '🆕 Meu Flow',
    description: 'Descrição do flow',
    variables: { baseUrl: 'http://mock' },
    diagram: `graph TD
        A[Step 1] --> B[Step 2]
        B --> C[Step 3]`,
    steps: [
        {
            id: 'A',                          // Deve bater com o nó do diagrama
            name: 'Step 1',
            method: 'GET',
            url: '{{baseUrl}}/endpoint',
            extract: { varName: 'response.field' }, // Extrai variáveis para próximos steps
            validate: { status: 200 }
        },
        // ...mais steps
    ]
};
```

Depois adicione o `<script>` no `index.html` e o objeto no array `FLOWS` em `app.js`.

## Mock Server

O mock server intercepta `fetch()` no browser. Para adicionar novos endpoints, edite `js/mock-server.js`:

```js
MockServer.register('GET', '/meu-endpoint/:id', (ctx) => {
    return {
        status: 200,
        body: { id: ctx.params.id, data: 'mock response' }
    };
});
```
