# SupportPilot: AI-Powered Customer Support Platform

SupportPilot is a **multi-tenant customer support platform**. A Platform Administrator onboards companies, though companies can also register themselves. Each company invites its own support agents, publishes FAQ articles, and gets an **AI assistant** that answers customers first. Anything the AI can't solve becomes a **ticket assigned to a human agent**. There are four roles, and each has its own portal and dashboard.

> **Course:** EC4307 Web Application Development: Mini Project  ·  **Student:** EG/2023/5827
> **Repository:** https://github.com/skr2rathishan-oss/Ai-powered-Customer-Support-Platform

---

## 📑 Contents

1. [Key Features](#-key-features)
2. [Tech Stack](#-tech-stack)
3. [Architecture](#-architecture)
4. [Demo Accounts](#-demo-accounts)
5. [AI-First Support Flow](#-ai-first-support-flow)
6. [Getting Started](#-getting-started)
7. [CRUD Operations](#-crud-operations)
8. [Validation and Security](#-validation-and-security)
9. [Database Design](#-database-design)
10. [REST API](#-rest-api)
11. [Testing](#-testing)
12. [Project Structure](#-project-structure)
13. [Screenshots](#-screenshots)
14. [Documentation and Deliverables](#-documentation-and-deliverables)

---

## ✨ Key Features

- **Four role-based portals:** Platform Admin, Company Admin, Support Agent and Customer. Each has its own dashboard, and the server checks the role on every request.
- **Multi-tenancy:** every company's tickets, agents, FAQs, chats and orders are isolated by `company_id` in every query.
- **AI assistant first, human second:** the assistant answers from the company's published FAQs and the customer's own orders. When it can't help, it hands the chat to the least-busy agent as a ticket.
- **Ticket management:** create, assign, prioritise, change status, reply to the customer and add internal notes.
- **FAQ knowledge base** with full CRUD and a publish toggle. Published articles feed both the AI and the customer help center.
- **Order lookup:** customers see their orders, and the AI can answer "Where is my order?" with live status and tracking details.
- **Dashboards with analytics:** ticket activity charts, status breakdown, agent workload, AI resolution rate, and platform KPIs and growth.
- **Authentication:** email and password sign-in for individual and company accounts, Google OAuth 2.0, self-service password reset by email, and JWT in an HTTP-only cookie.
- **Platform settings:** maintenance mode, password policy, self-registration toggle and diagnostics, saved in the database.
- **Responsive UI** that works from 390 px phones up to wide desktop screens.

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript 5.9, Vite 7, Tailwind CSS v4, React Router v8 |
| Backend | Node.js 20+, Express 5 (CommonJS), layered as routes → validation → controllers → services → models |
| Database | MySQL 8 / **TiDB Cloud** (primary, raw SQL through `mysql2`, no ORM); MongoDB (optional, diagnostics only) |
| Auth | JSON Web Tokens, bcrypt password hashing, Passport Google OAuth 2.0, Nodemailer (Gmail SMTP) |
| AI | NVIDIA Nemotron (`nvidia/nemotron-3-ultra-550b-a55b`) through NVIDIA's OpenAI-compatible API |
| Security | Helmet, CORS allowlist, `express-rate-limit`, 10 kB JSON body limit, parameterised SQL |
| Testing | Node built-in test runner (`node --test`), Playwright end-to-end tests, ESLint, TypeScript type checks |

---

## 🏗️ Architecture

```mermaid
flowchart LR
    U[Browser<br/>React SPA :5173] -->|fetch + JWT| API[Express API :5000]
    API --> MW[Middleware<br/>helmet · CORS · rate limit<br/>authenticate · requireRole]
    MW --> R[Routes] --> V[Validators] --> C[Controllers] --> S[Services] --> M[Models]
    M -->|parameterised SQL| DB[(MySQL / TiDB Cloud)]
    S -->|chat replies| AI[NVIDIA Nemotron API]
    S -->|reset emails| SMTP[Gmail SMTP]
    API -.->|diagnostics| MG[(MongoDB, optional)]
```

- **Server.** `server/index.js` connects to the databases and starts listening. `src/app.js` exports `createApp(dependencies)`, which builds the Express app without connecting to any database.
  - Routes, controllers and services are factories that receive their dependencies. This lets API tests inject mock models and run without a database.
- **Errors.** Services throw `AppError(message, status, code, errors[])`. A central error handler returns `{ success: false, message, code, errors }`, and successful responses use `{ success: true, data }`.
- **Client.** All requests go through `apiRequest()` in `client/src/services/apiClient.ts`. Every route path is defined in `client/src/router/routes.ts`. Each portal sits behind a route guard that confirms the session with `GET /api/auth/me`.

---

## 🔑 Demo Accounts

`npm run seed:demo` creates these accounts (see [Getting Started](#-getting-started)). All of them except the Platform Admin belong to the demo company **Acme Demo Co**.

| Role | Email | Password | Sign in at | Lands on |
|---|---|---|---|---|
| **Platform Admin** | `admin@supportpilot.com` | `Admin@SupportPilot2026!` | `/login` (Individual) | `/admin/dashboard` |
| **Company Admin** | `owner@acme.example` | `CompanyAdmin@2026!` | `/login/company` (Company) | `/company/dashboard` |
| **Support Agent** | `sam.agent@acme.example` | `Agent@2026!` | `/login` (Individual) | `/agent/dashboard` |
| **Support Agent** | `riya.agent@acme.example` | `Agent@2026!` | `/login` (Individual) | `/agent/dashboard` |
| **Customer** | `casey@customer.example` | `Customer@2026!` | `/login` (Individual) | `/support` |

> [!NOTE]
> The Company Admin can also sign in on the Company tab with the company's business email, `support@acme.example`.
> The demo emails use the reserved `.example` domain, so password-reset emails sent to them never reach a real person.

> [!IMPORTANT]
> **Role-Based Access Control (RBAC).** Each portal checks the signed-in user's role on the server. For example, only `Platform Admin` users can reach `/admin/*` and `/api/admin/*`. Anyone else gets **HTTP 403 Forbidden**, and the client shows an "Access Restricted" page with a link back to their own workspace.

### What each role can do

| Role | Portal | Main features |
|---|---|---|
| **Platform Admin** | `/admin/dashboard`, `/admin/companies`, `/admin/settings` | Platform KPIs and growth charts; onboard, search, filter, sort, update status and delete companies; platform settings and diagnostics |
| **Company Admin** | `/company/dashboard`, `/company/tickets`, `/company/agents`, `/company/faqs`, `/company/ai-settings` | Ticket analytics and agent workload; manage tickets (create, assign, change status and priority, reply); invite and activate or deactivate agents; full FAQ CRUD with publish toggle; AI assistant settings |
| **Support Agent** | `/agent/dashboard`, `/agent/tickets` | Assigned work sorted by priority; ticket queue with filters and search; reply to customers, add internal notes, update ticket status |
| **Customer** | `/support`, `/support/chat`, `/support/tickets`, `/support/help` | Chat with the AI assistant; dashboard of their own tickets and orders; raise new tickets and follow replies; help center with published FAQs |
| **Everyone** | `/login`, `/login/company`, `/register`, `/company/register`, `/reset-password` | Email and password sign-in, Google sign-in, customer and company self-registration, password reset by email |

### Sample data

Acme Demo Co is set up as an **online clothing store**, and the seed fills every dashboard:

- **FAQs** for the AI assistant: delivery times, shipping costs, order tracking, changing or cancelling an order, returns, size exchanges, refunds, damaged items, sizing, garment care and payment methods.
- **Tickets** about clothing orders (a size exchange, a refund and an address change), plus an **enabled AI assistant**.
- **5 orders for Casey**, the demo customer. Each order lists its items, sizes, colours and prices in LKR:

| Order | Status | Items |
|---|---|---|
| `AC-10533` | Processing | Floral Wrap Summer Dress (S, Blue) |
| `AC-10517` | Shipped, tracking `AX7731942LK` | Denim Trucker Jacket (L, Indigo), 2 × Graphic Cotton T-Shirt (L, Black) |
| `AC-10482` | Delivered | 2 × Classic Oxford Shirt (M, White), Slim Fit Chinos (32, Beige) |
| `AC-10455` | Cancelled | Canvas Low-Top Sneakers (42, White) |
| `AC-10391` | Returned | Wool Blend Crew Sweater (M, Grey) |

Sign in as Casey and try these questions: *"Where is my order?"*, *"What did I order last time?"*, *"Can I return the jacket from AC-10517?"* and *"I want to exchange my chinos for a 34"*. The assistant hands the last one to an agent as a ticket.

---

## 🤖 AI-First Support Flow

```mermaid
flowchart TD
    A[Customer opens Ask AI] --> B[Assistant reads published FAQs<br/>+ customer's orders]
    B --> C{Confident answer<br/>and no human needed?}
    C -->|Yes| D[Answer shown]
    D --> E{Customer: That solved it?}
    E -->|Yes| F[Chat resolved by AI ✔]
    E -->|Asks again| B
    C -->|No / too many low-confidence answers| G[Ticket created automatically]
    H[Customer clicks Talk to a person] --> G
    G --> I[Assigned to the active agent<br/>with the fewest open tickets]
```

1. A customer opens **Ask AI** (`/support/chat`) and chats with the company's assistant.
2. The assistant answers from the company's **published FAQs** and the **customer's own orders**, using each order's status, items, tracking number and delivery date.
   - With `NVIDIA_API_KEY` set, NVIDIA Nemotron writes each answer and reports how confident it is and whether a person is needed.
   - Without a key, or if the model's reply can't be used, the assistant falls back to keyword matching against the FAQs and orders.
3. The chat is handed to a person in any of these cases:
   - the AI decides a human is needed (changing or cancelling an order, exchanges, refunds, bugs, an upset customer);
   - the customer clicks **Talk to a person**;
   - the AI gives too many low-confidence answers. The company admin sets the threshold and the number of attempts in **AI Settings**.
4. At handoff, a **ticket is created automatically**. It holds the full conversation and a suggested subject and priority, and it is **assigned to the active agent with the fewest open tickets**.
5. When an answer helps, the customer clicks **That solved it**. The company dashboard's **AI resolution rate** is the share of finished chats that the assistant solved without a human.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js 20** or newer, with npm
- A **MySQL-compatible database**: MySQL 8 locally, or a free TiDB Cloud cluster
- **MongoDB is optional.** It only feeds the admin diagnostics page, and the server starts without it.

### 1. Clone
```bash
git clone https://github.com/skr2rathishan-oss/Ai-powered-Customer-Support-Platform.git
cd Ai-powered-Customer-Support-Platform
```
The client and the server are separate npm projects. Run `npm install` in each one.

### 2. Backend
```bash
cd server
npm install
cp .env.example .env      # fill in your MySQL details and a JWT_SECRET of 32+ characters
npm run seed:demo         # creates the demo accounts and sample data (safe to run again)
npm run dev               # http://localhost:5000
```
- **No migrations are needed.** On startup the server creates any missing tables, columns and foreign keys.
- **TiDB Cloud** needs `MYSQL_CA_PATH=../certificates/isrgrootx1.pem` (relative to `server/`). Download the ISRG Root X1 certificate from [letsencrypt.org/certs/isrgrootx1.pem](https://letsencrypt.org/certs/isrgrootx1.pem) into `certificates/`.
- **Health check:** `http://localhost:5000/health`
- **Seeding again** resets the demo accounts to the passwords above. It never changes the password of an existing Platform Admin.

### 3. Frontend
```bash
cd client
npm install
npm run dev               # http://localhost:5173
```
The client calls `http://localhost:5000` by default. To use another API address, set `VITE_API_BASE_URL` in `client/.env`.

### Environment variables (`server/.env`)

| Variable | Required | Purpose |
|---|---|---|
| `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` | ✅ | MySQL / TiDB connection |
| `MYSQL_CA_PATH` | TiDB only | CA certificate for TLS |
| `JWT_SECRET` | ✅ | Signs session tokens (32+ characters) |
| `JWT_EXPIRES_IN`, `JWT_COOKIE_*` | | Session length and cookie options |
| `CLIENT_ORIGIN` | | Frontend URL allowed by CORS (default `http://localhost:5173`) |
| `MONGODB_URI` | | Optional diagnostics database |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | | Google sign-in (the button is hidden when these are not set) |
| `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | | Gmail app password for password-reset emails (`npm run test:smtp` checks them) |
| `NVIDIA_API_KEY` | | Turns on the AI model. Get a key at [build.nvidia.com](https://build.nvidia.com) |
| `NVIDIA_MODEL`, `NVIDIA_ENABLE_THINKING` | | Choose another model, or turn on reasoning mode (better on hard questions, but about 15 s per reply instead of about 2 s) |

> [!CAUTION]
> `.env` is git-ignored. Never commit API keys, database passwords or the JWT secret.

---

## ✅ CRUD Operations

Every operation below writes to the MySQL database and is checked on both the client and the server.

| Entity | Create | Read | Update | Delete | Who |
|---|---|---|---|---|---|
| **Companies** | Onboarding form or self-registration | Directory with search, filter, sort and pagination | Change status (Active, Pending, Suspended) | Delete company and its data in one transaction | Platform Admin |
| **FAQs** | New article form | List, search, category filter; help center | Edit, publish or unpublish | Delete with confirmation | Company Admin |
| **Tickets** | Customer, company admin, or automatically from AI chat | Queues, filters, detail page | Status, priority, assignee | Closed, not removed, to keep history | Admin, Agent, Customer |
| **Ticket replies** | Public reply or internal note | Conversation thread | n/a | n/a | Admin, Agent, Customer |
| **Agents** | Invite by email | List with workload | Edit, activate or deactivate | Deactivate to keep ticket history | Company Admin |
| **AI settings** | Created with defaults | Settings page | Name, tone, greeting, threshold, instructions | n/a | Company Admin |
| **Chat sessions** | Opening Ask AI | Chat history | Resolve or escalate | Cascade with the company | Customer |
| **Platform settings** | Defaults | Settings page | Save all sections | n/a | Platform Admin |

---

## 🔒 Validation and Security

**Validation.** Every request body is checked on the server by a validator in `server/src/validators/` before it reaches a controller. Forms also check input on the client, so users see field-level errors before they submit.

| Rule | Example |
|---|---|
| Email format | RFC-style pattern, no double dots, max 255 characters |
| Password strength | 8–128 characters with upper and lower case letters, a number and a symbol. The minimum length can be raised in platform settings |
| Field lengths | FAQ question 5–300 characters; agent name ≤ 50; assistant name ≤ 40; greeting ≤ 300; custom instructions ≤ 1000 |
| Enums | Ticket status and priority, company status, and agent status are checked against fixed lists |
| Numeric ranges | AI confidence threshold 0–100; escalate after 1–10 failed answers |
| IDs | Route parameters must be positive integers |

Invalid input returns **HTTP 400** with an `errors[]` array listing each field and its message.

**Security**
- Passwords are hashed with **bcrypt** (12 rounds). Reset tokens are stored only as hashes and expire.
- The **JWT** is sent in an HTTP-only cookie and also as a Bearer token, and both are checked by `authenticate` middleware.
- **Role guards** (`requireRole`, `requireAccountType`) protect every portal API, and every query is scoped to the user's own company.
- **Rate limiting** on registration, forgot-password and reset-password: 10 requests per 15 minutes.
- **Helmet** security headers, a strict **CORS allowlist**, a **10 kB** request body limit, and parameterised SQL (no string-built queries).

---

## 🗄️ Database Design

The primary database is MySQL (TiDB Cloud in production).
- **Schema file.** The full schema, with every key, index and foreign key, is in [`docs/database/schema.sql`](docs/database/schema.sql).
- **Foreign keys.** Every line in the diagram below is a foreign key enforced by the database, and the server adds any missing key at startup. Every query is also scoped by `company_id`.
- **Re-export.** To export the live schema from TiDB again, run `cd server && npm run db:schema`.

```mermaid
erDiagram
    roles ||--o{ users : "role_id"
    companies |o--o{ users : "company_id"
    companies ||--o{ company_admins : "company_id"
    users ||--o| company_admins : "admin_id"
    users ||--o{ password_reset_tokens : "user_id"
    companies ||--o{ tickets : "company_id"
    users |o--o{ tickets : "customer_id"
    users |o--o{ tickets : "assigned_agent_id"
    tickets ||--o{ ticket_replies : "ticket_id"
    users |o--o{ ticket_replies : "author_id"
    companies ||--o{ faqs : "company_id"
    companies ||--o| company_ai_settings : "company_id"
    companies ||--o{ chat_sessions : "company_id"
    users ||--o{ chat_sessions : "customer_id"
    tickets |o--o| chat_sessions : "ticket_id"
    chat_sessions ||--o{ chat_messages : "session_id"
    companies ||--o{ orders : "company_id"
    users ||--o{ orders : "customer_id"
    orders ||--|{ order_items : "order_id"

    roles {
        int role_id PK
        varchar role_name UK
    }
    companies {
        int company_id PK
        varchar company_name
        varchar industry
        varchar business_email UK
        enum status
        timestamp registration_date
    }
    users {
        int user_id PK
        int role_id FK
        int company_id FK
        varchar email UK
        varchar password_hash
        enum account_status
    }
    company_admins {
        int admin_id PK,FK
        int company_id FK
        timestamp appointed_at
    }
    password_reset_tokens {
        int reset_id PK
        int user_id FK
        varchar token_hash
        datetime expires_at
        tinyint used
    }
    tickets {
        int ticket_id PK
        int company_id FK
        int customer_id FK
        int assigned_agent_id FK
        varchar subject
        text description
        enum status
        enum priority
    }
    ticket_replies {
        int reply_id PK
        int ticket_id FK
        int author_id FK
        varchar author_role
        tinyint is_internal
        text body
    }
    faqs {
        int faq_id PK
        int company_id FK
        varchar question
        text answer
        varchar category
        tinyint is_published
    }
    company_ai_settings {
        int settings_id PK
        int company_id FK,UK
        tinyint enabled
        tinyint confidence_threshold
        tinyint escalate_after_failures
    }
    chat_sessions {
        int session_id PK
        int company_id FK
        int customer_id FK
        int ticket_id FK
        enum status
        tinyint failed_answers
    }
    chat_messages {
        int message_id PK
        int session_id FK
        enum sender
        text body
        tinyint confidence
    }
    orders {
        int order_id PK
        int company_id FK
        int customer_id FK
        varchar order_number UK
        enum status
        decimal total_amount
        varchar tracking_number
        date estimated_delivery
    }
    order_items {
        int item_id PK
        int order_id FK
        varchar product_name
        varchar size
        varchar color
        smallint quantity
        decimal unit_price
    }
```

Rendered diagrams for the report: [conceptual ERD](docs/database/erd-conceptual.png) (Chen notation) and [physical ERD](docs/database/erd-physical.png) (crow's foot, generated from the TiDB schema). A `platform_settings` table, which is not shown, stores the platform settings as JSON.

**Integrity rules**
- Deleting a company runs in **one transaction** that removes its dependent data first.
- Child rows such as chat messages and order items **cascade** with their parent.
- Deleting a ticket only clears the link from its chat (`ON DELETE SET NULL`).

---

## 🔌 REST API

Base URL: `http://localhost:5000`. Every endpoint except auth, public and health needs a signed-in user with the right role.

| Area | Endpoints |
|---|---|
| **Auth** `/api/auth` | `POST /sign-in`, `POST /sign-out`, `GET /me`, `POST /company/register`, `POST /customer/register`, `POST /forgot-password`, `POST /verify-reset-token`, `POST /reset-password`, `GET /providers`, `GET /google`, `GET /google/callback` |
| **Platform Admin** `/api/admin` | `GET /dashboard`, `GET /companies`, `POST /companies`, `GET /companies/:id`, `PATCH /companies/:id/status`, `DELETE /companies/:id`, `GET /settings`, `PUT /settings`, `POST /settings/test-email`, `GET /diagnostics` |
| **Company tickets** `/api/company/tickets` | `GET /`, `POST /`, `GET /stats`, `GET /assignable-agents`, `GET /:ticketId`, `PATCH /:ticketId`, `GET /:ticketId/replies`, `POST /:ticketId/replies` |
| **Company agents** `/api/company/agents` | `GET /`, `POST /`, `PATCH /:agentId`, `POST /:agentId/resend-invite` |
| **Company FAQs** `/api/company/faqs` | `GET /`, `POST /`, `PATCH /:faqId`, `DELETE /:faqId` |
| **AI settings** `/api/company/ai-settings` | `GET /`, `PUT /` |
| **Company** `/api/company` | `GET /me` |
| **Agent portal** `/api/agent` | `GET /me`, `GET /tickets`, `GET /tickets/:ticketId`, `PATCH /tickets/:ticketId`, `POST /tickets/:ticketId/replies` |
| **Customer portal** `/api/customer` | `GET /me`, `GET /faqs`, `GET /orders`, `GET /tickets`, `POST /tickets`, `GET /tickets/:ticketId`, `POST /tickets/:ticketId/replies` |
| **AI chat** `/api/customer/chat` | `POST /sessions`, `GET /sessions/:sessionId`, `POST /sessions/:sessionId/messages`, `POST /sessions/:sessionId/escalate`, `POST /sessions/:sessionId/resolve` |
| **Public** `/api/public` | `GET /companies`, `GET /platform` |
| **Health** | `GET /health` |

---

## 🧪 Testing

```bash
cd server && npm test                 # 525 API, service, model and validator tests (no database needed)
cd server && npm run test:db          # real database connectivity check
cd client && npm run build            # TypeScript type-check and production build
cd client && npm run lint             # ESLint
cd client && E2E_SERVER_COMMAND="npm run mock" npx playwright test   # browser tests against the mock backend
```

| Suite | What it covers |
|---|---|
| **Server unit and API tests** (`server/test/`) | 18 API suites built on `createApp()` with mock models, plus model, service, validator and utility tests: auth, password reset, Google OAuth, RBAC, companies, tickets, replies, agents, FAQs, AI settings, chat escalation, orders and the AI responder |
| **End-to-end tests** (`client/e2e/`) | 17 Playwright specs: landing page, sign-in and form validation, Google redirect, admin dashboard and onboarding, company portal, agents, FAQs, AI settings, agent queue, customer portal, AI chat and handoff |

The browser tests start their own mock API on port 5000 and the client on port 5173, so stop your dev servers before running them. To refresh the screenshots below, run `cd client && CAPTURE_SCREENSHOTS=1 E2E_SERVER_COMMAND="npm run mock" npx playwright test screenshots`.

---

## 📁 Project Structure

```
Customer_Support_Platform/
├── client/                     React + Vite + TypeScript SPA
│   ├── src/
│   │   ├── pages/              Route pages: landing, auth, admin, company, agent, customer, legal
│   │   ├── components/         UI building blocks grouped by area
│   │   ├── router/             routes.ts (all paths) and index.tsx (route tree and guards)
│   │   ├── services/           apiClient.ts and per-area API wrappers
│   │   ├── validation/         Client-side form validation
│   │   └── types/              Shared TypeScript types
│   └── e2e/                    Playwright specs
├── server/                     Express 5 REST API
│   ├── index.js                Connects the databases and starts the server
│   ├── src/
│   │   ├── app.js              createApp(): middleware, routers, error handler
│   │   ├── config/             Database connection and schema setup, Passport, OAuth
│   │   ├── routes/             Endpoint definitions
│   │   ├── validators/         Request validation
│   │   ├── controllers/        HTTP request and response handling
│   │   ├── services/           Business logic, AI responder, email
│   │   ├── models/             Raw SQL queries
│   │   ├── middleware/         Authentication, roles, validation, errors, maintenance mode
│   │   └── utils/              AppError, asyncHandler, tokens, cookies
│   ├── scripts/                seed-demo-accounts, mock-server, export-schema, test-smtp
│   └── test/                   Node test runner suites
├── docs/
│   └── database/               schema.sql and ERD diagrams
└── certificates/               CA certificate for TiDB Cloud TLS (git-ignored, download it yourself)
```

---

## 📸 Screenshots

Screenshots of every portal are in the submitted project report. They cover the landing page, sign-in, the admin dashboard and company directory, the onboarding form validation, the company dashboard, FAQ management, tickets, agents, AI settings, the customer AI chat and handoff, the agent dashboard and queue, and the mobile layout.

To generate them locally into `docs/screenshots/`, run the screenshot spec shown in [Testing](#-testing).

---

## 📚 Documentation and Deliverables

| Item | Location |
|---|---|
| Setup and usage guide | This README |
| Database schema (DDL) | [`docs/database/schema.sql`](docs/database/schema.sql) |
| ER diagrams | [`docs/database/erd-conceptual.png`](docs/database/erd-conceptual.png), [`docs/database/erd-physical.png`](docs/database/erd-physical.png) |
| Authentication design | [`server/AUTHENTICATION.md`](server/AUTHENTICATION.md) |
| Project report, screenshots and demo video | Submitted separately |

**Version control.** Features were built on separate branches and merged into `main`, with descriptive commit messages throughout the project history.
