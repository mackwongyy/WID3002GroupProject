# API Design

Base URL:

```text
http://localhost:4000
```

All protected endpoints require:

```http
Authorization: Bearer <token>
```

## Authentication

### Signup

```http
POST /api/auth/signup
```

Request:

```json
{
  "name": "Customer User",
  "email": "customer@example.com",
  "password": "password123"
}
```

### Login

```http
POST /api/auth/login
```

Request:

```json
{
  "email": "customer@example.com",
  "password": "password123"
}
```

Response:

```json
{
  "token": "jwt-token",
  "user": {
    "id": "uuid",
    "name": "Customer User",
    "email": "customer@example.com",
    "role": "CUSTOMER"
  },
  "redirect_to": "/dashboard"
}
```

### Current User

```http
GET /api/auth/me
```

## Customer Ticket APIs

### Get Tickets

```http
GET /api/customer/tickets
```

### Create Ticket

```http
POST /api/customer/tickets
```

Request:

```json
{
  "ticket_name": "Double charge issue"
}
```

### Rename Ticket

```http
PATCH /api/customer/tickets/{ticketId}
```

Request:

```json
{
  "ticket_name": "Payment refund issue"
}
```

### Reorder Tickets

```http
PATCH /api/customer/tickets/reorder
```

Request:

```json
{
  "ordered_ticket_ids": ["uuid-1", "uuid-2"]
}
```

### Soft Delete Ticket

```http
DELETE /api/customer/tickets/{ticketId}
```

### Send Message

```http
POST /api/customer/tickets/{ticketId}/messages
```

Request:

```json
{
  "text": "I was charged twice and refund has not arrived."
}
```

Response:

```json
{
  "interaction_id": "uuid",
  "step_number": 1,
  "user_text": "I was charged twice and refund has not arrived.",
  "model_output": {
    "category": "Payment Issue",
    "urgency": "High",
    "urgency_colour": "Red",
    "sentiment": "Negative",
    "key_phrases": ["charged twice", "refund"],
    "department": "Finance Department"
  }
}
```

### Get Chat History

```http
GET /api/customer/tickets/{ticketId}/messages
```

### Submit Ticket

```http
POST /api/customer/tickets/{ticketId}/submit
```

## Admin APIs

### Dashboard Summary

```http
GET /api/admin/summary
```

### List Tickets

```http
GET /api/admin/tickets?user_id=&department=&status=&urgency=
```

### User Analytics

```http
GET /api/admin/users/{userId}/analytics
```

### Ticket History

```http
GET /api/admin/tickets/{ticketId}/history
```

### Validate Interaction

```http
PATCH /api/admin/interactions/{interactionId}/validate
```

Request:

```json
{
  "corrected_category": "Payment Issue",
  "corrected_urgency": "High",
  "corrected_sentiment": "Negative",
  "corrected_department": "Finance Department",
  "notes": "Model output validated."
}
```

## NLP Service APIs

The NLP API is internal and called by the backend.

### Analyse Text

```http
POST /analyse
```

Request:

```json
{
  "interaction_id": "uuid",
  "ticket_id": "uuid",
  "user_id": "uuid",
  "text": "I kena charged twice but refund belum masuk."
}
```

Response:

```json
{
  "category": "Payment Issue",
  "urgency": "High",
  "urgency_colour": "Red",
  "sentiment": "Negative",
  "key_phrases": ["charged twice", "refund belum masuk"],
  "department": "Finance Department",
  "confidence": {
    "category": 0.88,
    "urgency": 0.82,
    "sentiment": 0.91
  },
  "similar_tickets": []
}
```


## Admin Analysis Retry

### POST `/api/admin/interactions/:interactionId/reanalyse`

Retries NLP analysis for an existing ticket interaction. This is useful when the NLP service was temporarily unavailable and the interaction was saved with `analysisStatus = FAILED`.

Authentication: Admin only.

Response:

```json
{
  "analysis_status": "SUCCESS",
  "interaction": {
    "id": "...",
    "analysisStatus": "SUCCESS",
    "analysisError": null
  }
}
```

If retry fails, the response still returns the interaction and stores the failure in `analysis_runs`:

```json
{
  "analysis_status": "FAILED",
  "error": "Unable to reach NLP service..."
}
```

## Backend Health Check

### GET `/api/health`

Returns backend dependency health for PostgreSQL and NLP service.

```json
{
  "status": "ok",
  "service": "backend",
  "checks": {
    "database": { "status": "ok", "latency_ms": 4 },
    "nlp_service": { "status": "ok", "latency_ms": 12 }
  }
}
```
