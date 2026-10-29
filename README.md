# SupportPilot — AI-Powered Customer Support Platform

SupportPilot is a multi-tenant customer support platform. Companies are onboarded by a Platform Administrator (or register themselves), invite support agents, publish FAQ articles for their AI assistant, and handle customer tickets. Every role has its own portal and dashboard.

---

## 🔑 Demo Accounts

All accounts belong to the demo company **Acme Demo Co** (except the Platform Admin) and are created by `npm run seed:demo` (see [Quick Start](#-quick-start)).

| Role | Email | Password | Sign in at | Lands on |
|---|---|---|---|---|
| **Platform Admin** | `admin@supportpilot.com` | `Admin@SupportPilot2026!` | `/login` (Individual) | `/admin/dashboard` |
| **Company Admin** | `owner@acme.example` | `CompanyAdmin@2026!` | `/login/company` (Company) | `/company/dashboard` |
| **Support Agent** | `sam.agent@acme.example` | `Agent@2026!` | `/login` (Individual) | `/agent/dashboard` |
| **Support Agent** | `riya.agent@acme.example` | `Agent@2026!` | `/login` (Individual) | `/agent/dashboard` |
| **Customer** | `casey@customer.example` | `Customer@2026!` | `/login` (Individual) | `/support` |

> [!NOTE]
> The Company Admin can also sign in with the company's business email, `support@acme.example`, on the Company tab.
> Demo emails use the reserved `.example` domain, so password-reset emails sent to them are never delivered to a real person.

> [!IMPORTANT]
> **Role-Based Access Control (RBAC)**
> Each portal checks the signed-in user's role on the server. For example, only `Platform Admin` users can reach `/admin/*` and `/api/admin/*`; anyone else receives **HTTP 403 Forbidden**, and the client shows an "Access Restricted" page with a link back to their own workspace.

### What each account can do

| Role | Main features |
|---|---|
| **Platform Admin** | Platform KPIs and growth charts, onboard companies (Create), search/filter/sort the company directory (Read), change company status (Update), delete companies (Delete), platform settings and diagnostics |
| **Company Admin** | Dashboard with ticket analytics and agent workload; manage tickets (create, assign, change status/priority, reply); invite and activate/deactivate agents; full FAQ CRUD with publish toggle; AI assistant settings |
| **Support Agent** | Dashboard of assigned work sorted by priority; ticket queue with filters and search; reply to customers, add internal notes, update ticket status |
| **Customer** | Chat with the AI assistant first; dashboard of their own tickets; raise new tickets; follow replies on their tickets; help center with published FAQs |

The seed also adds sample data for Acme Demo Co (6 tickets, 4 FAQs and an enabled AI assistant) so every dashboard has something to show.

---

## 🤖 AI-First Support Flow

1. A customer opens **Ask AI** (`/support/chat`) and chats with the company's assistant.
2. The assistant answers from the company's **published FAQs**. With `NVIDIA_API_KEY` set, NVIDIA Nemotron (`nvidia/nemotron-3-ultra-550b-a55b`, through NVIDIA's API) writes each answer and reports how confident it is and whether a person is needed. Without a key, or if the model's reply can't be used, the assistant matches the question against the FAQs instead.
3. The chat is handed to a person when:
   - the AI decides a human is needed (account changes, refunds, bugs, an upset customer), or
   - the customer clicks **Talk to a person**, or
   - the AI gives low-confidence answers too many times. The company admin sets the confidence threshold and the number of attempts in **AI Settings**.
4. On handoff a **ticket is created automatically** with the full conversation, a suggested subject and priority, and is **assigned to the active support agent with the fewest open tickets**. The agent sees it in their queue and replies on the ticket.
5. If the answer helped, the customer clicks **That solved it**. The company dashboard's **AI resolution rate** is the share of finished chats the assistant solved without a human.

To use the AI model, add your NVIDIA API key (from build.nvidia.com) to `server/.env` and restart the server:
```
NVIDIA_API_KEY=nvapi-...
# Optional: use a different model from NVIDIA's catalog
# NVIDIA_MODEL=nvidia/nemotron-3-ultra-550b-a55b
# Reasoning mode: better on hard questions but ~15s per reply instead of ~2s
# NVIDIA_ENABLE_THINKING=false
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20 or newer
- A MySQL-compatible database (MySQL 8 or TiDB Cloud)
- MongoDB is optional: it only feeds the admin diagnostics page, and the server starts without it

### 1. Backend
```bash
cd server
npm install
cp .env.example .env      # then fill in your MySQL details and a JWT_SECRET of 32+ characters
npm run seed:demo         # creates the demo accounts above (safe to run again)
npm run dev               # http://localhost:5000
```
- On startup the server creates any missing tables and columns automatically.
- For TiDB Cloud, set `MYSQL_CA_PATH=../certificates/isrgrootx1.pem` (relative to `server/`).
- Health check: `http://localhost:5000/health`
- Running `npm run seed:demo` again resets the demo accounts to the passwords above. It does not change an existing Platform Admin password.

### 2. Frontend
```bash
cd client
npm install
npm run dev               # http://localhost:5173
```
The client calls `http://localhost:5000` by default. Set `VITE_API_BASE_URL` in `client/.env` to use a different API address.

---

## 🧪 Tests

```bash
cd server && npm test                 # API, service, model and validator tests (no database needed)
cd client && npm run build            # type-check and production build
cd client && npm run lint
cd client && E2E_SERVER_COMMAND="npm run mock" npx playwright test   # browser tests against the mock backend
```
The browser tests start their own mock API on port 5000 and the client on port 5173, so stop your dev servers before running them.

---

## 🛡️ Role-Based Portals

1. **Platform Administrator** (`/admin/dashboard`, `/admin/companies`, `/admin/settings`)
2. **Company Administrator** (`/company/dashboard`, `/company/tickets`, `/company/agents`, `/company/faqs`, `/company/ai-settings`)
3. **Support Agent** (`/agent/dashboard`, `/agent/tickets`)
4. **Customer** (`/support`, `/support/tickets`, `/support/tickets/new`, `/support/help`)
5. **Authentication** (`/login`, `/login/company`, `/register`, `/company/register`)
   - Email/password sign-in for individual and company accounts
   - Google OAuth 2.0 sign-in for existing accounts
   - Self-service password reset by email
