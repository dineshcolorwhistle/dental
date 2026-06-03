# Dental Lab Management System — Project Instructions

> **Document Purpose:** This is the master specification for building the Dental Lab Management System. Development will proceed **phase-by-phase**; each phase must be fully completed and reviewed before the next begins.

---

## 1. Project Overview

The **Dental Lab Management System** is a modern, SaaS-ready operational workflow platform for dental laboratories. It manages end-to-end lab processes — from work-order intake through technician workflows, quality checks, and delivery coordination — with real-time production tracking across multiple branches and tenants.

### Core Value Propositions

- **Operational Efficiency** — Digitize and streamline every step of dental lab production.
- **Real-Time Visibility** — Live dashboards, instant notifications, and workflow tracking.
- **Multi-Branch Scalability** — Branch-level data isolation with centralized oversight.
- **SaaS Expansion** — Multi-tenant architecture ready for commercial deployment.

---

## 2. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| **Frontend** | React + TypeScript (Vite) | SPA with role-based dashboards, responsive design |
| **Backend** | NestJS (TypeScript) | Modular, REST-first, event-driven architecture |
| **Database** | PostgreSQL | Multi-tenant relational schema, Prisma ORM |
| **Cache & Queue** | Redis + BullMQ | Notifications, background jobs, scheduled tasks |
| **Real-Time** | Socket.IO | Live dashboard sync, technician queue updates, notifications |
| **API Docs** | Swagger / OpenAPI | Auto-generated from NestJS decorators |
| **Deployment** | VPS (Nginx reverse proxy) | Initial target; containerization as future enhancement |

---

## 3. Architecture

### 3.1 Multi-Tenant SaaS Structure

```
Platform (Super Admin)
  └── Tenant (Lab Owner Organization)
        └── Branch(es)
              └── Users (Admin, Technician, Delivery, etc.)
                    └── Work Orders
```

Each tenant operates under a **subdomain** (e.g., `smilelab.dental.com`, `brightlab.dental.com`). Data is fully isolated per tenant.

### 3.2 Post-Production & Tenant-Controlled Releases

The platform supports tenant-controlled releases without requiring separate deployments. This is achieved via a robust **Feature Flag** system:
- **`tenant_settings.features` JSON column**: Stores boolean flags for each module (e.g., `{"qrWorkflow": true, "deliveryModule": false, "doctorPortal": false}`).
- **Super Admin Control**: The Super Admin can toggle these features on a per-tenant basis from the master dashboard.
- **Frontend & Backend Enforcement**: The frontend conditionally renders UI based on these flags, and the backend validates access. This allows rolling out major new features (like the Doctor Portal) to beta tenants first, before enabling them globally.

### 3.3 Backend Architecture Pattern

```
Controller → Service → Repository (Prisma) → PostgreSQL
                ↓
         Event Emitter → BullMQ Queue → Redis Pub/Sub → Socket.IO → React UI
```

### 3.3 Frontend Architecture Pattern

```
Pages → Layouts → Components → Hooks/Services → API Layer (Axios)
```

---

## 4. User Roles & Permissions

| # | Role | Scope | Key Responsibilities |
|---|---|---|---|
| 1 | **Super Admin** | Platform-wide | Manage tenants, system monitoring, global settings, SaaS analytics |
| 2 | **Owner** | Tenant-wide | Financial analytics, branch performance, technician productivity, reports & insights |
| 3 | **Administrator** | Branch-level | Create work orders, assign technicians, configure workflows, manage doctors/delivery staff/work types |
| 4 | **Technician** | Assigned work | View queue, start/complete processes, update progress, track assigned jobs |
| 5 | **Delivery Person** | Assigned deliveries | Pickup tracking, delivery status updates, completion confirmation |
| 6 | **Doctor** *(Phase 2)* | Client portal | Create work orders, track progress, view delivery updates, invoice history |

### Permission System

- **RBAC** (Role-Based Access Control) with granular permissions per module.
- **Tenant-aware** — all queries scoped to the authenticated tenant.
- **Branch-aware** — Admins/Technicians/Delivery staff see only their branch data (Owners see all branches).

---

## 5. Core Modules

### 5.1 Authentication & Authorization
- JWT-based authentication with refresh token rotation.
- Role-based route guards (backend) and route protection (frontend).
- Tenant resolution via subdomain or header.
- Password reset flow via email.

### 5.2 Tenant Management *(Super Admin only)*
- Create/edit/deactivate tenants.
- Subdomain provisioning.
- Tenant-level settings and configuration.

### 5.3 Branch Management
- CRUD operations for branches within a tenant.
- Branch-level data isolation for work orders, staff, and analytics.
- Branch performance dashboards.

### 5.4 User Management
- Invite and manage users per branch.
- Role assignment with permission inheritance.
- Technician profiles with skill/process permissions.
- Delivery personnel profiles.

### 5.5 Doctor Management
- CRUD for doctor/clinic records.
- Contact information and communication preferences.
- Invitation system for Phase 2 doctor portal.

### 5.6 Work Type Management
- Define work categories (e.g., Crown, Bridge, Implant, Denture).
- Configure process templates per work type.
- Set default workflow sequences and estimated durations.

### 5.7 Process Management
- Define workflow stages (e.g., Scanning → Design → Milling → Finishing → QC).
- Configure stage sequencing and dependencies.
- Assign default technicians per stage.
- Set estimated durations per stage.

### 5.8 Work Order Management *(Core Engine)*

This is the central operational module.

**Creation:**
- Admin enters: doctor, patient details, work type, specs (color, shade, units), amount, priority, planned delivery date.
- System auto-generates: folio number, QR code, and loads the process workflow.

**Lifecycle:**
```
Created → Assigned → In Progress → Ready → Delivered
```

**Features:**
- Real-time status tracking.
- QR code for instant work-order access.
- Process-level progress with timestamps.
- Technician sequencing and handoff.
- Delivery coordination.

### 5.9 Notification System

| Trigger Event | Action |
|---|---|
| Work Order Created | Notify first technician in sequence |
| Process Completed | Notify next technician |
| Final Stage Completed | Notify admin + owner dashboard |
| Delivery Assigned | Notify delivery staff |
| Delayed Work (SLA breach) | Escalation alert to admin |

**Channels:** In-app notifications, Email. *(WhatsApp — future enhancement.)*

### 5.10 QR Workflow
- Each work order gets a unique QR code at creation.
- Scanning the QR opens the work order's current status view.
- Technicians can scan to quickly start/complete their assigned process.

### 5.11 Real-Time Dashboard
- Live operational monitoring: active WOs, technician activity, delayed jobs, delivery tracking.
- Branch workload distribution.
- Production metrics and KPIs.
- WebSocket-powered instant updates.

---

## 6. Detailed Work Order Workflow

This is the step-by-step operational flow — the heart of the system:

### Step 1 — Admin Creates Work Order
Admin enters all details (doctor, patient, work type, specs, priority, dates). System generates folio number, QR code, and loads the predefined process sequence for the selected work type.

### Step 2 — Process Workflow Initialization
Based on the work type, the system loads the process template. Example for "Zirconia Crown":
```
Scanning → Design → Milling → Finishing → Quality Check
```
Each process has: default technician, estimated duration, execution order.

### Step 3 — First Technician Queued
The first technician in the sequence receives a queue item + real-time notification. Their dashboard updates instantly.

### Step 4 — Technician Starts Process
Technician clicks **"Start"**. System validates that the previous stage (if any) is completed, records the start timestamp, and broadcasts a real-time update.

### Step 5 — Technician Completes Process
Technician clicks **"Complete"**. System records end timestamp, calculates duration, updates status, and triggers the next stage.

### Step 6 — Next Technician Notified
System automatically assigns the next technician, pushes a real-time notification, and updates the live queue.

### Step 7 — Final Stage Completion
When the last process completes, the system marks the work order as **"Ready"**, notifies the admin, updates the owner dashboard, and prepares the delivery workflow.

### Step 8 — Delivery
Delivery personnel receive assigned deliveries, update pickup/transit status, and mark as **"Delivered"**. This is the terminal state.

### Workflow Rules
- **Strict sequential execution** — a technician **cannot** start their process until the preceding process is completed.
- **No stage skipping** — the system enforces the defined order.
- **Audit trail** — every start/complete action is timestamped and logged.

---

## 7. Database Schema (Reference)

### Tenant & Auth Tables
| Table | Purpose |
|---|---|
| `tenants` | Tenant organizations |
| `tenant_settings` | Per-tenant configuration |
| `users` | All user accounts (tenant-scoped) |
| `roles` | Role definitions |
| `permissions` | Granular permissions |
| `role_permissions` | Role ↔ Permission mapping |

### Operational Tables
| Table | Purpose |
|---|---|
| `branches` | Branches per tenant |
| `doctors` | Doctor/clinic records |
| `technicians` | Technician profiles (extends users) |
| `delivery_personnel` | Delivery staff profiles (extends users) |
| `work_types` | Work categories |
| `processes` | Process/stage definitions |
| `work_type_processes` | Work type ↔ Process mapping with order |
| `work_orders` | Work order records |
| `work_order_processes` | Per-WO process instances with status/timestamps |

### Tracking & Logs
| Table | Purpose |
|---|---|
| `notifications` | In-app notification records |
| `audit_logs` | System-wide audit trail |
| `qr_scans` | QR scan history |
| `delivery_logs` | Delivery status history |
| `status_history` | Work order status transitions |
| `process_logs` | Process-level action logs |

---

## 8. Development Standards

### Backend
- TypeScript **strict mode** enabled.
- All inputs validated via **DTOs** (class-validator).
- **Modular architecture** — one NestJS module per domain (auth, tenants, branches, work-orders, etc.).
- **Repository pattern** via Prisma.
- **Swagger/OpenAPI** docs auto-generated.
- **Event-driven** processing for workflow transitions.
- Consistent error handling with proper HTTP status codes.

### Frontend
- **Reusable component library** — buttons, forms, modals, tables, etc.
- **Role-based layouts** — different dashboard views per role.
- **Centralized API layer** — Axios instance with interceptors for auth/tenant headers.
- **State management** — React Context or Zustand (to be decided in Phase 1).
- **Real-time updates** — Socket.IO client integration.
- **Responsive design** — mobile-friendly operational interface.

### General
- **CRITICAL RULE — DATABASE INTEGRITY:** DO NOT reset the database (`prisma migrate reset`, `db push --force-reset`), drop tables, or run any destructive database operations without obtaining explicit, written approval from the USER. All existing development database records and details must be strictly preserved.
- Git-based version control with feature branching.
- Environment-based configuration (`.env` files).
- Consistent naming conventions (camelCase TS, snake_case DB).
- Comprehensive error logging.
- **Testing Scripts:** Do not commit temporary test/scratch scripts (e.g., `test*.js`, `inspect*.js`, `get-token.js`) to the repository. If you create temporary files for testing, they must be removed immediately after the test is completed.
- **Browser Testing Credentials:** If testing in the browser, always check the active, correct credentials defined in Section 13 (Login Credential) of this file rather than assuming default/fallback logins.

---

## 9. Development Phases

### Phase 1 — Core Platform & Work Order Flow
> **Goal:** Set up the full project foundation, authentication with RBAC, Lab Admin operational modules (doctors, work types, processes), the complete Work Order engine, and Technician workflow — delivering a functional end-to-end production loop.

#### Phase 1A — Project Setup & Authentication

| # | Task | Details |
|---|---|---|
| 1.1 | Project Initialization | Initialize NestJS backend + React (Vite) frontend. Set up Prisma, PostgreSQL connection, Redis connection. Configure ESLint, Prettier, TypeScript strict mode. |
| 1.2 | Database Schema (Core) | Design and migrate core tables: tenants, users, roles, permissions, branches, doctors, work_types, processes, work_orders, work_order_processes. |
| 1.3 | Authentication Module | JWT auth with refresh tokens, login/logout, password reset, tenant-aware middleware. |
| 1.4 | Authorization (RBAC) | Role-based guards, permission decorators, route protection for all roles. |
| 1.5 | Frontend Foundation | App shell, routing, auth pages (login, reset password), role-based layout system, API layer setup (Axios with interceptors). |

#### Phase 1B — Lab Admin Modules

| # | Task | Details |
|---|---|---|
| 1.6 | Tenant Management | Super Admin: CRUD tenants, subdomain provisioning, tenant settings. |
| 1.7 | Branch Management | CRUD branches within a tenant. Branch-scoped data filtering. |
| 1.8 | User Management | Invite users, assign roles, manage profiles. Technician and delivery personnel profile extensions. |
| 1.9 | Doctor Management | CRUD doctors/clinics. Contact info, communication preferences. |
| 1.10 | Work Type Management | CRUD work types (Crown, Bridge, Implant, Denture, etc.). Define categories and base configurations. |
| 1.11 | Process Management | CRUD processes/stages (Scanning, Design, Milling, Finishing, QC, etc.). Configure sequencing, default technicians, estimated durations. |
| 1.12 | Work Type ↔ Process Linking | Map processes to work types with ordering. Default workflow templates per work type. |

#### Phase 1C — Work Order Engine & Technician Workflow

| # | Task | Details |
|---|---|---|
| 1.13 | Work Order Creation | Full creation form: doctor selection, patient details, work type, specs (color, shade, units), amount, priority, planned delivery date. Auto-generate folio number and load process workflow. |
| 1.14 | Work Order Listing & Filtering | List view with status filters, search, branch filter, date range, pagination. |
| 1.15 | Work Order Detail View | Full WO detail with process timeline, status indicators, action buttons. |
| 1.16 | Workflow Engine (Backend) | Event-driven process transitions. Strict sequential validation. Auto-assignment of next technician on process completion. |
| 1.17 | Technician Queue & Dashboard | Technician view: assigned jobs queue, Start/Complete process actions, job progress tracking. |
| 1.18 | Admin Dashboard | Lab Admin operational overview: active WOs, today's queue, work order status summary, branch summary. |
| 1.19 | Super Admin Dashboard | Tenant list, basic system monitoring, tenant creation flow. |

### Phase 2 — Real-Time, Notifications & QR
> **Goal:** Add real-time capabilities, notification system, background job processing, and QR code workflow.

| # | Task | Details |
|---|---|---|
| 2.1 | Real-Time Infrastructure | Socket.IO server setup, room management (per tenant/branch), event broadcasting. |
| 2.2 | Real-Time Dashboard Updates | Live WO status changes, technician activity feed, delayed job alerts across all dashboards. |
| 2.3 | Notification System | In-app notifications: creation, storage, read/unread, real-time delivery. Email notifications for critical events. |
| 2.4 | BullMQ Job Processing | Background job queues for notifications, email sending, scheduled tasks. |
| 2.5 | QR Code Workflow | QR generation at WO creation. Scan-to-view current status. Scan-to-update for technicians. |

### Phase 3 — Delivery, Analytics & Polish
> **Goal:** Complete the delivery module, add analytics/reporting, owner dashboard, and polish the UX.

| # | Task | Details |
|---|---|---|
| 3.1 | Delivery Management | Assign deliveries, pickup/transit/delivered status flow, delivery personnel dashboard. |
| 3.2 | Owner Dashboard | Financial overview, branch performance comparison, technician productivity metrics. |
| 3.3 | Reporting & Analytics | Work order reports, production metrics, turnaround time analysis, exportable reports. |
| 3.4 | Audit Logging | Comprehensive audit trail for all critical actions. |
| 3.5 | UX Polish | Loading states, error handling UX, empty states, responsive refinements, micro-animations. |
| 3.6 | Performance Optimization | Query optimization, caching strategy, lazy loading, bundle optimization. |

### Phase 4 — SaaS & Advanced Features *(Future)*
> **Goal:** Full SaaS commercialization and advanced capabilities.

| # | Task | Details |
|---|---|---|
| 4.1 | Doctor Portal | Doctor login, WO submission, progress tracking, invoice history. |
| 4.2 | Subscription & Billing | Plan management, usage tracking, billing integration. |
| 4.3 | Custom Domain Mapping | Tenant custom domains with SSL provisioning. |
| 4.4 | Multi-Language Support | i18n framework, translation management. |
| 4.5 | Mobile Companion App | React Native app for technicians and delivery staff. |
| 4.6 | AI Workflow Optimization | Predictive workload analytics, smart technician assignment. |

---

## 10. Tenant Provisioning Flow

When a Super Admin creates a new tenant:

```
1. Create Tenant record
2. Generate & register subdomain
3. Create Owner user account
4. Create default Branch
5. Initialize tenant settings (defaults)
6. Send credentials via email
```

---

## 11. Deployment Architecture (Initial)

```
                    ┌─────────────┐
   Internet ───────►│    Nginx    │
                    │ (Rev Proxy) │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼                         ▼
     ┌─────────────┐          ┌─────────────┐
     │   React SPA │          │  NestJS API  │
     │  (Static)   │          │  (Node.js)   │
     └─────────────┘          └──────┬───────┘
                                     │
                          ┌──────────┼──────────┐
                          ▼                     ▼
                   ┌────────────┐        ┌───────────┐
                   │ PostgreSQL │        │   Redis   │
                   └────────────┘        └───────────┘
```

---

## 12. Key Design Decisions (To Confirm Per Phase)

These decisions should be finalized at the start of each phase:

- [ ] **State Management:** React Context vs. Zustand vs. Redux Toolkit
- [ ] **Form Handling:** React Hook Form vs. Formik
- [ ] **UI Component Library:** Custom components vs. Ant Design vs. Shadcn/UI vs. MUI
- [ ] **Table Component:** Custom vs. TanStack Table
- [ ] **Date Handling:** date-fns vs. dayjs
- [ ] **Prisma vs. TypeORM:** Confirm ORM choice (Prisma recommended)
- [ ] **Testing Strategy:** Jest + React Testing Library (unit), Playwright (E2E)
- [ ] **Monorepo vs. Separate Repos:** Single repo with workspaces vs. separate frontend/backend repos

---

## 13. Login Credential

Super admin:
 admin@dental.com
 Admin@123456

Owner:
 dinesh02121990@gmail.com
 Dinesh@#12312

admin:
 dinesh.colorwhistle@gmail.com
 Dinesh@#12312

Technician:
 dinesh@colorwhistle.com
 Dinesh@#12312
------

*This document is the single source of truth for the Dental Lab Management System. It will be updated as decisions are made and phases are completed.*