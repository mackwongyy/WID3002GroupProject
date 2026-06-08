# Smart Customer Feedback Analysis System
WID3002: Natural Language Processing


Universiti Malaya, Academic Year 2025/2026, Semester 2

Group Members
- Wong Yoong Yee
- Chai Jie Sheng
- Allison Low Jia Wen
- Lim Xin Ying

This is a prototype for an NLP-enabled customer feedback ticketing application, developed for the group project of the course WID3002: Natural Language Processing, at Universiti Malaya.

- Role-based login and signup
- Customer dashboard for managing tickets
- Chat-based ticket interactions
- Model output after every user message
- Admin dashboard with operational analytics
- User-level analytics for category, urgency, sentiment, key phrases and routed departments
- Human-in-the-loop validation
- PostgreSQL storage for structured data
- Pinecone-compatible vector search for semantic similarity and recurring issue detection
- Python FastAPI NLP service using either demo heuristics or HuggingFace models

## Repository Structure

```text
smart-feedback-system/
├── frontend/       # Next.js + React dashboard application
├── backend/        # Node.js + Express + Prisma API server
├── nlp-service/    # Python FastAPI NLP and Pinecone service
├── docs/           # Architecture and API documentation
├── docker-compose.yml
└── .env.example
```

## Architecture Summary

```text
Customer/Admin Browser
        ↓
Next.js Frontend
        ↓
Node.js Backend API
        ↓
PostgreSQL Database
        ↓
Python NLP Service
        ↓
Pinecone Vector DB
```

The backend owns authentication, authorisation, tickets, chat histories, validations and analytics. The NLP service owns category classification, urgency detection, sentiment analysis, key phrase extraction, department routing, embedding generation and Pinecone similarity search.

## Quick Start with Docker

1. Copy the environment file:

```bash
cp .env.example .env
```

2. Start PostgreSQL, backend, NLP service and frontend:

```bash
docker compose up --build
```

3. Open the application:

```text
Frontend:    http://localhost:3000
Backend API: http://localhost:4000/health
NLP API:     http://localhost:8000/health
```

4. Seed demo users:

```bash
docker compose exec backend npm run db:seed
```

Demo accounts:

```text
Customer
Email: customer@example.com
Password: password123

Admin
Email: admin@example.com
Password: password123
```

## Local Development Without Docker

### Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

### NLP Service

```bash
cd nlp-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Environment Modes

The NLP service runs in `demo` mode by default. This keeps the project runnable on normal laptops without downloading the 3B Llama model. For model-based inference, switch to `NLP_MODE=llama`.

```env
NLP_MODE=demo
```

For Malaysian Llama inference, set:

```env
NLP_MODE=llama
LLM_MODEL_NAME=mesolitica/Malaysian-Llama-3.2-3B-Instruct
LLM_DEVICE=auto
LLM_TORCH_DTYPE=auto
LLM_MAX_INPUT_TOKENS=2048
LLM_MAX_NEW_TOKENS=256
LLM_TEMPERATURE=0.0
```

This uses the instruction-tuned Malaysian Llama model through a strict JSON prompt, so the backend still receives a stable structured output for category, urgency, sentiment, key phrases and department routing.

For Pinecone semantic search, set:

```env
PINECONE_API_KEY=your_key
PINECONE_INDEX_NAME=customer-feedback-bge-m3
PINECONE_NAMESPACE=ticket-interactions
EMBEDDING_DIMENSION=1024
```

When Pinecone is not configured, the service returns analysis outputs without vector search.

## Key Design Decisions

### 1. Separate classification and embedding models

Classification/extraction tasks and semantic similarity tasks are separated:

- mesolitica/Malaysian-Llama-3.2-3B-Instruct for prompt-based structured classification of category, urgency, sentiment and key phrases
- BGE-M3-style multilingual embedding model for Pinecone search and clustering

This is more maintainable than forcing one model to perform all tasks.

### 2. Department routing is rule-based

Departments are mapped from predicted categories because departments are business rules, not purely linguistic classes.

### 3. Every chat turn is auditable

Each user message and model output is stored as one `ticket_interaction`. Admins can validate or correct model outputs later.

### 4. Submitted tickets are read-only

Once a ticket is submitted, the user cannot add more chat messages. However, the ticket name remains editable for usability.

## Main Features

### Customer

- Signup and login
- Create a ticket with a ticket name
- View ticket list
- Rename ticket
- Reorder tickets
- Soft delete tickets
- Chat with NLP model while ticket is `IN_PROGRESS`
- Submit ticket
- View submitted chat history

### Admin

- View overall dashboard summary
- View department/status/urgency/sentiment/category statistics
- View top key phrases
- Filter tickets by user, status, department or urgency
- Open user analytics page
- Review full ticket history
- Validate or correct model outputs


## Admin Validation Persistence and Dashboard Updates

The admin dashboard includes a backend-persisted human validation workflow for model outputs. This supports human-in-the-loop review of ticket interactions and makes each admin validation auditable.

### Backend validation flow

The validation endpoint is:

```http
PATCH /api/admin/interactions/:interactionId/validate
```

When an admin validates an interaction, the backend writes the result to the `admin_validations` table. If the same admin validates the same interaction again, the existing validation row is updated instead of creating duplicate rows.

The response includes:

- `validation`
- `interaction_id`
- `ticket_id`
- `is_validated`
- `validated_at`

The admin summary API also includes a `validation_summary` with:

- `total_interactions`
- `validated_interactions`
- `pending_interactions`
- `validation_records`

User-level admin analytics also include per-user validation coverage, and ticket listings include the latest interaction validation status.

### Admin dashboard layout

The main admin dashboard is organised into clearer sections:

- Snapshot
- Model Output Analytics
- Users
- Latest Tickets

The user-level admin analytics page is organised into:

- User Snapshot
- User-level Model Analytics
- Tickets
- Ticket History & Validation

Each interaction shows whether it is still pending review or already validated, along with the validating admin, validation timestamp, and validation notes where available.

### Mark as Validated behaviour

The `Mark as Validated` button now:

- calls the backend validation API
- persists the validation result in PostgreSQL
- shows a loading state while the request is in progress
- refreshes ticket history and user analytics after saving
- changes to a disabled `Validated` state once saved

No Prisma migration is required for this feature because the project already includes the `AdminValidation` model/table.

To verify persistence directly in PostgreSQL, run:

```sql
SELECT * FROM admin_validations ORDER BY "validatedAt" DESC LIMIT 10;
```

## Documentation

- `docs/ARCHITECTURE.md`
- `docs/API.md`
- `docs/SEQUENCE_DIAGRAMS.md`
- `docs/ACTIVITY_DIAGRAMS.md`
- `docs/MODEL_MIGRATION.md`

## Notes for Further Fine-Tuning

Full LoRA fine-tuning can be done in the future using the scripts in `nlp-service/training/`, while the demo mode allows the complete system flow to be tested immediately.


## Industry-Grade Reliability Improvements

This version adds a more production-like reliability layer around NLP analysis and admin review.

### Backend
- Added request ID middleware and request ID propagation in error responses.
- Added `/api/health` for database and NLP-service dependency checks.
- Added `NLP_TIMEOUT_MS` configuration and timeout protection for NLP calls.
- Added resilient NLP fallback behaviour so customer messages are saved even if NLP fails.
- Added `analysisStatus` and `analysisError` fields to ticket interactions.
- Added `AnalysisRun` audit table for model output history and retry attempts.
- Added admin retry endpoint: `POST /api/admin/interactions/:interactionId/reanalyse`.
- Extended admin summary/user analytics with analysis-status breakdown.

### Frontend
- Added analysis-status visibility for customer ticket history.
- Added analysis-status and analysis-error visibility in admin ticket review.
- Added Retry Analysis button for failed NLP analysis.
- Added analysis-status counts to admin dashboards.

### DevOps / Setup
- Added service-level `.env.example` files.
- Added Prisma migration for analysis-status and analysis-runs.
- Updated Docker Compose to use `prisma migrate deploy`.
- Added backend environment validation script: `npm run check:env`.

### NLP service
- Made `/health` lightweight through lazy pipeline loading.
- Skips embedding model loading when Pinecone is not configured.
- Keeps vector search failure from breaking analysis output.

### Resilient NLP Analysis

Customer messages are now persisted even when the NLP service is unavailable, slow, or returns an error. Instead of failing the whole ticket-message request, the backend stores the interaction with:

```text
analysisStatus = SUCCESS | PENDING | FAILED
analysisError = error message when analysis fails
```

When analysis fails, the backend uses a safe fallback model output:

```text
category: General Enquiry
urgency: Low
sentiment: Neutral
department: Customer Service Department
modelName: analysis-failed-fallback
```

This keeps the ticketing system usable even when the AI layer is degraded.

### Analysis Run Audit Trail

A new `analysis_runs` table stores each analysis attempt for every ticket interaction. This provides an audit history for:

- successful NLP outputs
- failed NLP calls
- retry attempts
- model name, model version and prompt version
- raw output/error message

This makes the system easier to debug and more suitable for model comparison and future retraining.

### Admin Retry Workflow

Admins can now retry failed NLP analysis from the user-level admin ticket history page through:

```http
POST /api/admin/interactions/:interactionId/reanalyse
```

If the retry succeeds, the interaction is updated with the latest model output. If it fails, the failure is saved in both `ticket_interactions` and `analysis_runs`.

### Health and Observability

The backend now exposes a deeper health endpoint:

```http
GET /api/health
```

It checks:

- backend availability
- PostgreSQL connectivity
- NLP service availability
- latency per dependency

Every backend response also includes an `x-request-id` header. Error responses include the same request ID, making debugging easier across browser, backend and logs.

### Environment Setup

Each service now includes its own safe `.env.example`:

```text
backend/.env.example
frontend/.env.example
nlp-service/.env.example
```

Do not commit real `.env` files. Use the examples as templates.

### Database Migration

This version adds a Prisma migration:

```text
backend/prisma/migrations/20260601120000_iteration/
```

Run:

```bash
cd backend
npx prisma generate
npx prisma migrate dev
npm run db:seed
```

For Docker deployment, `docker compose up --build` now runs `prisma migrate deploy` instead of pushing the schema directly.
