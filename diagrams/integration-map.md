# Mapa de Integrações

Visão geral de todos os serviços, bancos de dados, filas e APIs externas.

```mermaid
graph LR
    subgraph Cliente
        WEB[🌐 Web App]
        MOB[📱 Mobile App]
    end

    subgraph API Gateway
        GW[🔀 API Gateway<br/>localhost:3000]
    end

    subgraph Serviços
        AUTH[🔐 Auth Service<br/>localhost:3001]
        USER[👤 User Service<br/>localhost:3002]
        ORDER[📦 Order Service<br/>localhost:3003]
        PAY[💳 Payment Service<br/>localhost:3004]
        NOTIF[📧 Notification Service<br/>localhost:3005]
    end

    subgraph Banco Relacional
        PG_USERS[(🐘 PostgreSQL<br/>Users)]
        PG_ORDERS[(🐘 PostgreSQL<br/>Orders)]
        PG_PAY[(🐘 PostgreSQL<br/>Payments)]
    end

    subgraph Banco NoSQL
        MONGO[(🍃 MongoDB<br/>Event Logs)]
        REDIS[(⚡ Redis<br/>Cache)]
    end

    subgraph Filas
        RABBIT[📨 RabbitMQ<br/>order.events]
        DLQ[💀 Dead Letter<br/>Queue]
    end

    subgraph APIs Externas
        CEP_API[🌍 ViaCEP API]
        SHIPPING[🚚 Shipping API]
        EXCHANGE[💱 Exchange Rate API]
        CREDIT[📊 Credit Score API]
        SMTP[📮 SMTP Server]
        PAY_GW[🏦 Payment Gateway]
    end

    WEB --> GW
    MOB --> GW

    GW --> AUTH
    GW --> USER
    GW --> ORDER

    AUTH --> PG_USERS
    AUTH --> REDIS

    USER --> PG_USERS
    USER --> REDIS
    USER --> AUTH

    ORDER --> PG_ORDERS
    ORDER --> PAY
    ORDER --> USER
    ORDER --> RABBIT
    ORDER --> MONGO
    ORDER --> CEP_API
    ORDER --> SHIPPING
    ORDER --> EXCHANGE

    PAY --> PG_PAY
    PAY --> PAY_GW
    PAY --> CREDIT
    PAY --> RABBIT

    RABBIT --> NOTIF
    RABBIT --> MONGO
    RABBIT -.->|falha| DLQ
    DLQ -.->|retry| RABBIT

    NOTIF --> SMTP
    NOTIF --> REDIS

    style AUTH fill:#e1f5fe,stroke:#0288d1
    style USER fill:#e8f5e9,stroke:#388e3c
    style ORDER fill:#fff3e0,stroke:#f57c00
    style PAY fill:#fce4ec,stroke:#c62828
    style NOTIF fill:#f3e5f5,stroke:#7b1fa2
    style GW fill:#fffde7,stroke:#f9a825

    style PG_USERS fill:#336791,stroke:#58a6ff,color:#fff
    style PG_ORDERS fill:#336791,stroke:#58a6ff,color:#fff
    style PG_PAY fill:#336791,stroke:#58a6ff,color:#fff
    style MONGO fill:#4db33d,stroke:#3fb950,color:#fff
    style REDIS fill:#dc382d,stroke:#f85149,color:#fff

    style RABBIT fill:#ff6600,stroke:#ff8c00,color:#fff
    style DLQ fill:#6e40c9,stroke:#bc8cff,color:#fff

    style CEP_API fill:#0891b2,stroke:#22d3ee,color:#fff
    style SHIPPING fill:#0891b2,stroke:#22d3ee,color:#fff
    style EXCHANGE fill:#0891b2,stroke:#22d3ee,color:#fff
    style CREDIT fill:#0891b2,stroke:#22d3ee,color:#fff
```

## Endpoints por Serviço

| Serviço | Base URL | Endpoints |
|---------|----------|-----------|
| Auth | `localhost:3001` | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` |
| User | `localhost:3002` | `GET /users`, `POST /users`, `GET /users/:id`, `PUT /users/:id`, `DELETE /users/:id` |
| Order | `localhost:3003` | `POST /orders`, `GET /orders/:id`, `GET /orders/user/:userId`, `PUT /orders/:id/status` |
| Payment | `localhost:3004` | `POST /payments`, `GET /payments/:id`, `POST /payments/:id/refund` |
| Notification | `localhost:3005` | `POST /notifications/email`, `POST /notifications/push` |

## Bancos de Dados

| Banco | Tipo | Uso |
|-------|------|-----|
| 🐘 PostgreSQL | Relacional | Users, Orders, Payments (ACID, transactions) |
| 🍃 MongoDB | NoSQL Documento | Event logs, audit trail, analytics |
| ⚡ Redis | NoSQL Key-Value | Cache, sessions, rate limiting |

## Filas

| Fila | Exchange | Routing Key | Consumer |
|------|----------|-------------|----------|
| order.processing | order.events | order.created | Order Worker |
| order.fulfillment | order.events | order.confirmed | Fulfillment Worker |
| DLQ | dlx.order | # | DLQ Processor |

## APIs Externas

| API | Endpoint Mock | Descrição |
|-----|---------------|-----------|
| ViaCEP | `POST /external/cep` | Busca endereço por CEP |
| Shipping | `POST /external/shipping/calculate` | Calcula opções de frete |
| Exchange Rate | `POST /external/exchange-rate` | Cotação de moedas |
| Credit Score | `POST /external/credit-score` | Score de crédito |
