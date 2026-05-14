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
LLM_MAX_INPUT_TOKENS=1024
LLM_MAX_NEW_TOKENS=128
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

## Documentation

- `docs/ARCHITECTURE.md`
- `docs/API.md`
- `docs/SEQUENCE_DIAGRAMS.md`
- `docs/ACTIVITY_DIAGRAMS.md`
- `docs/MODEL_MIGRATION.md`

## Notes for Further Fine-Tuning

Full LoRA fine-tuning can be done in the future using the scripts in `nlp-service/training/`, while the demo mode allows the complete system flow to be tested immediately.
