# Smart Customer Feedback Analysis System

WID3002: Natural Language Processing  
Universiti Malaya, Academic Year 2025/2026, Semester 2

## Group Members

- Wong Yoong Yee
- Chai Jie Sheng
- Allison Low Jia Wen
- Lim Xin Ying

## 1. Project Overview

The Smart Customer Feedback Analysis System is a full-stack NLP-enabled ticketing platform. It allows customers to submit feedback through a chat-style ticket interface. Each message is analysed by an NLP service to predict category, urgency, sentiment, key phrases, routed department, semantic similarity metadata, and analysis status. Admin users can review the ticket history, validate model outputs, retry failed analysis, and remove incorrect or unwanted chat interactions from the validation page.

This README is the single consolidated project documentation file. It replaces separate patch notes and scattered implementation summaries.

## 2. Core Features

### Customer Features

- Customer signup and login
- Create, rename, reorder, submit, and soft-delete tickets
- Add chat messages while tickets are still in progress
- View model-generated output for every chat message
- View submitted ticket history after submission

### Admin Features

- Admin login and protected admin dashboard
- Overall dashboard summary
- User list and user-level analytics
- Category, urgency, sentiment, department, key phrase, validation, and analysis-status breakdowns
- Ticket history inspection
- Human-in-the-loop validation using `Mark as Validated`
- Retry failed NLP analysis
- Remove individual chat interactions from the admin validation page
- Backend-persisted validation records

## 3. High-Level Architecture

```text
Customer/Admin Browser
        ↓
Next.js Frontend
        ↓
Node.js + Express Backend API
        ↓
PostgreSQL + Prisma
        ↓
Python FastAPI NLP Service
        ↓
Optional Pinecone Vector Search
```

The backend owns authentication, role-based access control, tickets, interactions, admin validation, retry analysis, deletion controls, and analytics. The NLP service owns text classification, urgency detection, sentiment analysis, key phrase extraction, department routing, and optional vector search.

## 4. Repository Structure

```text
WID3002GroupProject/
├── backend/        # Express API, Prisma, PostgreSQL integration
├── frontend/       # Next.js dashboard application
├── nlp-service/    # FastAPI NLP service
├── README.md       # Single consolidated project documentation
├── docker-compose.yml
└── .env.example
```

## 5. Current NLP Model Stack

The project has shifted from the previous Mesolitica/Malaysian-Llama + Mack LoRA setup to the Qwen-based model stack:

```text
Base model:
Qwen/Qwen3-1.7B

LoRA adapter:
jieshengchai/qwen3-malaysia-cs-lora-5000-v2
```

Local development should still use `NLP_MODE=demo` because loading the Qwen model and LoRA adapter is better suited for GPU environments such as Colab, RunPod, or a CUDA server.

Recommended local mode:

```env
NLP_MODE=demo
```

Recommended GPU mode:

```env
NLP_MODE=qwen-lora
LLM_MODEL_NAME=Qwen/Qwen3-1.7B
LLM_ADAPTER_PATH=jieshengchai/qwen3-malaysia-cs-lora-5000-v2
LLM_ENABLE_THINKING=false
LLM_DEVICE=cuda
LLM_TORCH_DTYPE=float16
```

`LLM_ENABLE_THINKING=false` is used because this system expects strict JSON classification output rather than free-form reasoning text.

## 6. Environment Files

Do not commit real `.env` files with secrets. Commit only `.env.example` files.

### Root `.env.example`

Used mainly for Docker Compose and shared environment reference.

New / updated model variables:

```env
# NEW / UPDATED - Qwen model stack replacing the earlier Mesolitica/Mack LoRA setup.
LLM_MODEL_NAME=Qwen/Qwen3-1.7B
LLM_ADAPTER_PATH=jieshengchai/qwen3-malaysia-cs-lora-5000-v2
LLM_ENABLE_THINKING=false
```

### Backend `backend/.env.example`

```env
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://mackwongyy@localhost:5432/smart_feedback?schema=public
JWT_SECRET=change-this-secret-in-development-123456
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3000
NLP_SERVICE_URL=http://127.0.0.1:8000
NLP_TIMEOUT_MS=15000
```

### Frontend `frontend/.env.example`

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

### NLP Service `nlp-service/.env.example`

```env
NLP_MODE=demo

# NEW / UPDATED - Qwen base model and friend's LoRA adapter.
LLM_MODEL_NAME=Qwen/Qwen3-1.7B
LLM_ADAPTER_PATH=jieshengchai/qwen3-malaysia-cs-lora-5000-v2
LLM_ENABLE_THINKING=false

LLM_DEVICE=auto
LLM_TORCH_DTYPE=auto
LLM_MAX_INPUT_TOKENS=1024
LLM_MAX_NEW_TOKENS=128
LLM_TEMPERATURE=0.0
```

## 7. Local Development Setup

### 7.1 Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

Expected success signs:

```text
Environment variables loaded from .env
Datasource "db": PostgreSQL database "smart_feedback"
Seed completed.
Backend API listening on port 4000
```

### 7.2 NLP Service

```bash
cd nlp-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Test:

```bash
curl http://127.0.0.1:8000/health
```

### 7.3 Frontend

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Avoid using `192.168.x.x` unless you also update `CORS_ORIGIN`, `NEXT_PUBLIC_API_BASE_URL`, and `allowedDevOrigins`.

## 8. Demo Accounts

After seeding:

```text
Customer
Email: customer@example.com
Password: password123

Admin
Email: admin@example.com
Password: password123
```

## 9. Important API Endpoints

### Auth

```http
POST /api/auth/signup
POST /api/auth/login
GET  /api/auth/me
```

### Customer

```http
GET    /api/customer/tickets
POST   /api/customer/tickets
PATCH  /api/customer/tickets/:ticketId
DELETE /api/customer/tickets/:ticketId
GET    /api/customer/tickets/:ticketId/messages
POST   /api/customer/tickets/:ticketId/messages
POST   /api/customer/tickets/:ticketId/submit
```

### Admin

```http
GET    /api/admin/summary
GET    /api/admin/users
GET    /api/admin/tickets
GET    /api/admin/users/:userId/analytics
GET    /api/admin/tickets/:ticketId/history
PATCH  /api/admin/interactions/:interactionId/validate
POST   /api/admin/interactions/:interactionId/reanalyse
DELETE /api/admin/interactions/:interactionId
```

## 10. Admin Chat Removal Feature

Admins can remove individual chat interactions from the validation page:

```text
Admin Dashboard
→ User Analytics
→ Select Ticket
→ Ticket History & Validation
→ Remove Chat
```

The frontend shows a confirmation dialog before deletion. The backend endpoint is:

```http
DELETE /api/admin/interactions/:interactionId
```

This is an admin-only action. It permanently deletes the selected interaction from `ticket_interactions`. Related records are removed through Prisma/PostgreSQL cascading relations, including:

- `admin_validations`
- `analysis_runs`
- `ticket_vectors`

No Prisma schema migration is required for this feature because the existing schema already uses cascading relations from interaction-linked records.

## 11. Human-in-the-Loop Validation

The validation endpoint is:

```http
PATCH /api/admin/interactions/:interactionId/validate
```

The backend writes validation records into `admin_validations`. If the same admin validates the same interaction again, the existing validation record is updated rather than duplicated.

Stored validation fields include:

- corrected category
- corrected urgency
- corrected sentiment
- corrected department
- notes
- admin ID
- validation timestamp

## 12. Analysis Retry and Failure Safety

The backend stores customer messages even if the NLP service fails. Failed analysis is recorded with:

```text
analysisStatus = FAILED
analysisError = error message
```

Admins can retry analysis through:

```http
POST /api/admin/interactions/:interactionId/reanalyse
```

This supports a more resilient architecture where customer ticket creation is not blocked by temporary NLP service issues.

## 13. Database Models

Main Prisma models:

```text
User
Ticket
TicketInteraction
AnalysisRun
AdminValidation
TicketVector
```

`TicketInteraction` is the central model for message-level NLP output. Each interaction stores:

- user text
- model JSON output
- predicted category
- urgency
- sentiment
- department
- key phrases
- model name and version
- prompt version
- analysis status
- analysis error

## 14. Frontend Pages

```text
/
login
signup
customer dashboard
admin dashboard
admin user analytics
```

The admin user analytics page is the main validation page. It includes:

- user snapshot
- user-level model analytics
- ticket list
- ticket history
- validation button
- retry analysis button
- remove chat button

## 15. Recommended Runtime Modes

### Local Laptop

```env
NLP_MODE=demo
```

Use this for normal frontend/backend testing.

### GPU / Colab / RunPod

```env
NLP_MODE=qwen-lora
LLM_DEVICE=cuda
LLM_TORCH_DTYPE=float16
```

Use this to test the Qwen base model with the LoRA adapter.

## 16. Troubleshooting

### Backend says `DATABASE_URL` missing

Create `backend/.env` from `backend/.env.example`.

### PostgreSQL user denied access

Use your local PostgreSQL username in `DATABASE_URL`, for example:

```env
DATABASE_URL=postgresql://mackwongyy@localhost:5432/smart_feedback?schema=public
```

### Frontend says `Failed to fetch`

Make sure:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
CORS_ORIGIN=http://localhost:3000
```

Open the app at:

```text
http://localhost:3000
```

### NLP service says port 8000 already in use

```bash
lsof -ti :8000 | xargs kill -9
```

Then restart the service.

### Next.js dependency conflict

Use modern Next.js for the App Router project. The frontend should not use `next@9`.

```bash
cd frontend
rm -rf node_modules .next package-lock.json
npm install
npm run dev
```

Node 20 LTS is recommended.

## 17. Security and Git Hygiene

Do not commit:

```text
backend/.env
frontend/.env
frontend/.env.local
nlp-service/.env
node_modules/
.venv/
.next/
```

Commit only `.env.example` files.

Rotate any API keys that were accidentally shared or committed.

## 18. Current Implementation Status

Implemented:

- customer ticket workflow
- admin dashboard
- user analytics
- validation persistence
- retry analysis
- admin chat removal
- Qwen model configuration
- LoRA adapter configuration
- local demo NLP mode
- PostgreSQL/Prisma persistence
- optional Pinecone vector-search configuration

Recommended future enhancements:

- soft-delete/audit table for removed chat interactions
- semantic graph visualisation
- RAG analyst panel with cited ticket evidence
- batch evaluation dashboard
- production deployment profile
