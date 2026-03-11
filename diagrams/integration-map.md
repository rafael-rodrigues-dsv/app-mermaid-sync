# Mapa de Integrações

Visão geral de todos os serviços e suas dependências.

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

    subgraph Dados
        DB_USER[(🗄️ Users DB)]
        DB_ORDER[(🗄️ Orders DB)]
        CACHE[(⚡ Redis Cache)]
        QUEUE[📨 Message Queue]
    end

    subgraph Externo
        SMTP[📮 SMTP Server]
        PAY_GW[🏦 Payment Gateway]
    end

    WEB --> GW
    MOB --> GW

    GW --> AUTH
    GW --> USER
    GW --> ORDER

    AUTH --> DB_USER
    AUTH --> CACHE

    USER --> DB_USER
    USER --> AUTH

    ORDER --> DB_ORDER
    ORDER --> PAY
    ORDER --> USER

    PAY --> PAY_GW
    PAY --> QUEUE

    QUEUE --> NOTIF
    NOTIF --> SMTP

    style AUTH fill:#e1f5fe,stroke:#0288d1
    style USER fill:#e8f5e9,stroke:#388e3c
    style ORDER fill:#fff3e0,stroke:#f57c00
    style PAY fill:#fce4ec,stroke:#c62828
    style NOTIF fill:#f3e5f5,stroke:#7b1fa2
    style GW fill:#fffde7,stroke:#f9a825
```

## Endpoints por Serviço

| Serviço | Base URL | Endpoints |
|---------|----------|-----------|
| Auth | `localhost:3001` | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` |
| User | `localhost:3002` | `GET /users`, `POST /users`, `GET /users/:id`, `PUT /users/:id`, `DELETE /users/:id` |
| Order | `localhost:3003` | `POST /orders`, `GET /orders/:id`, `GET /orders/user/:userId`, `PUT /orders/:id/status` |
| Payment | `localhost:3004` | `POST /payments`, `GET /payments/:id`, `POST /payments/:id/refund` |
| Notification | `localhost:3005` | `POST /notifications/email`, `POST /notifications/push` |
