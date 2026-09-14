# SupportPilot — AI-Powered Customer Support Platform

SupportPilot is an enterprise-grade AI-powered customer support platform featuring unified company onboarding, intelligent ticket routing, multi-role authentication, and a real-time **Platform Administrator Dashboard**.

---

## 🔑 Platform Administrator Credentials

| Role | Email | Password | Access Level |
|---|---|---|---|
| **Platform Admin** | `admin@supportpilot.com` | `Admin@SupportPilot2026!` | Complete Platform Oversight (`/admin/dashboard`) |

> [!IMPORTANT]
> **Role-Based Access Control (RBAC)**
> Only users with the `Platform Admin` role can access `/admin/dashboard` and `/api/admin/*` endpoints. Attempts by Company Admins, Support Agents, or Customers to access the Platform Admin portal will be blocked with **HTTP 403 Forbidden**.

---

## 🚀 Quick Start

### 1. Backend Server Setup
```bash
cd server
npm install
npm run dev
```
- Runs on: `http://localhost:5000` (or `http://127.0.0.1:5000`)
- Health Check: `http://localhost:5000/api/auth/me`

### 2. Frontend Client Setup
```bash
cd client
npm install
npm run dev
```
- Runs on: `http://localhost:5173`

---

## 🛡️ Role-Based Portals

1. **Platform Administrator** (`/admin/dashboard`):
   - Real-time KPI statistics (Total Companies, Active, Suspended, Pending Approval, Total Users, Company Admins, Support Agents, Monthly Growth).
   - Platform Growth Registration volume charts.
   - Company status breakdown & entity distribution.
   - Recent company registrations management.
   - Live system infrastructure health monitoring (API Gateway, Database, Webhooks, AI Nodes).
   - Platform activity feed.
2. **Company Administrator** (`/company/dashboard`):
   - Company ticket management, agent assignments, FAQs, and AI settings.
3. **Authentication Portal** (`/login`):
   - Email/password individual and company sign-in.
   - Google OAuth 2.0 single sign-on.
   - Self-service password recovery with email delivery.

