# 🦷 Dental Lab Management System

A modern, SaaS-ready operational workflow platform for dental laboratories — managing end-to-end lab processes from work-order intake through technician workflows, quality checks, and delivery coordination with real-time production tracking.

---

## ✨ Key Features

- **Multi-Tenant SaaS Architecture** — Subdomain-based tenant isolation with branch-level data separation.
- **Real-Time Workflow Engine** — Event-driven process orchestration with strict sequential validation.
- **Role-Based Dashboards** — Tailored views for Super Admins, Owners, Admins, Technicians, and Delivery staff.
- **Live Production Tracking** — WebSocket-powered dashboards with instant status updates.
- **QR Code Integration** — Scan-to-access work orders for fast technician interactions.
- **Notification System** — In-app and email notifications for workflow events and escalations.
- **Delivery Coordination** — End-to-end delivery tracking from pickup to completion.
- **Analytics & Reporting** — Branch performance, technician productivity, and operational metrics.

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript (Vite) |
| Backend | NestJS (TypeScript) |
| Database | PostgreSQL (Prisma ORM) |
| Cache & Queue | Redis + BullMQ |
| Real-Time | Socket.IO |
| API Docs | Swagger / OpenAPI |
| Deployment | VPS with Nginx reverse proxy |

---

## 📐 Architecture Overview

```
Platform (Super Admin)
  └── Tenant (Lab Owner Organization)
        └── Branch(es)
              └── Users (by Role)
                    └── Work Orders → Processes → Delivery
```

### Work Order Lifecycle

```
Created → Assigned → In Progress → Ready → Delivered
```

### Event Flow

```
User Action → NestJS Event → BullMQ Queue → Redis Pub/Sub → Socket.IO → React UI
```

---

## 👥 User Roles

| Role | Scope | Description |
|---|---|---|
| Super Admin | Platform | Tenant management, system monitoring, global settings |
| Owner | Tenant | Financial analytics, branch oversight, reports |
| Administrator | Branch | Work order management, staff coordination, workflow config |
| Technician | Assigned Work | Process execution, queue management |
| Delivery Person | Assigned Deliveries | Pickup/delivery tracking |
| Doctor *(Phase 2)* | Client Portal | Work order submission, progress tracking |

---

## 🚀 Development Phases

| Phase | Focus | Status |
|---|---|---|
| **Phase 1** | Core Platform & Work Order Flow — Project setup, auth/RBAC, admin modules (doctors, work types, processes), work order engine, technician workflow | 🔲 Not Started |
| **Phase 2** | Real-Time & Notifications — Socket.IO integration, live dashboards, notification system, QR workflow | 🔲 Not Started |
| **Phase 3** | Delivery & Analytics — Delivery module, owner dashboard, reporting, UX polish | 🔲 Not Started |
| **Phase 4** | SaaS & Advanced *(Future)* — Doctor portal, billing, mobile app, AI | 🔲 Not Started |

> See [Instructions.md](./Instructions.md) for the full specification and detailed phase breakdown.

---

## 📁 Project Structure

```
dental/
├── backend/                # NestJS API server
│   ├── src/
│   │   ├── modules/        # Feature modules (auth, tenants, work-orders, etc.)
│   │   ├── common/         # Shared utilities, guards, decorators
│   │   ├── config/         # Configuration files
│   │   └── prisma/         # Prisma schema and migrations
│   └── package.json
├── frontend/               # React SPA (Vite)
│   ├── src/
│   │   ├── pages/          # Page components
│   │   ├── components/     # Reusable UI components
│   │   ├── layouts/        # Role-based layout wrappers
│   │   ├── services/       # API service layer
│   │   ├── hooks/          # Custom React hooks
│   │   └── context/        # React Context providers
│   └── package.json
├── Instructions.md         # Full project specification
└── README.md               # This file
```

---

## 🛠️ Getting Started

### Prerequisites

- **Node.js** ≥ 18.x
- **PostgreSQL** ≥ 15.x
- **Redis** ≥ 7.x
- **npm** or **yarn**

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd dental

# Backend setup
cd backend
cp .env.example .env        # Configure database, Redis, JWT secrets
npm install
npx prisma migrate dev      # Run database migrations
npm run start:dev           # Start backend dev server

# Frontend setup (in a new terminal)
cd frontend
cp .env.example .env        # Configure API base URL
npm install
npm run dev                 # Start frontend dev server
```

---

## 📄 Documentation

- **[Instructions.md](./Instructions.md)** — Complete project specification, module details, workflow rules, database schema, and phase-by-phase development plan.

---

## 📝 License

Private — All rights reserved.

## Database Setup
cd backend
npm run db:push
npm run seed

## To Run The Project
### Backend
cd c:\dental\backend
npm run start:dev

### Frontend
cd c:\dental\frontend
npm run dev