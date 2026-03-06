# API Reference

All API routes are under `/api/` and return JSON responses.

## Tickets

### List Tickets
```
GET /api/tickets
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status (OPEN, IN_PROGRESS, etc.) |
| category | string | Filter by category |
| priority | string | Filter by priority |
| assigneeId | string | Filter by assigned team member |
| search | string | Search subject, externalId, or aiSummary |
| customerEmail | string | Filter by customer email |
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20) |

**Response:**
```json
{
  "tickets": [
    {
      "id": "clx...",
      "externalId": "0001",
      "subject": "Ich möchte mein Abo kündigen",
      "status": "OPEN",
      "priority": "HIGH",
      "category": "SUBSCRIPTION_CANCELLATION",
      "language": "de",
      "aiSummary": "User wants to cancel subscription",
      "aiConfidence": 0.95,
      "customerEmail": "user@example.com",
      "assignee": { "id": "...", "name": "Linus Baumberger" },
      "createdAt": "2026-03-01T10:00:00Z",
      "_count": { "messages": 3 }
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

### Get Ticket Detail
```
GET /api/tickets/{id}
```

Returns full ticket with messages, enrichments, and assignee. Messages are ordered by creation date ascending.

### Update Ticket
```
PATCH /api/tickets/{id}
```

**Allowed Fields:**

| Field | Type |
|-------|------|
| status | string |
| priority | string |
| category | string |
| tags | string[] |
| language | string |
| translatedSubject | string |
| aiSummary | string |
| aiConfidence | number |
| aiSuggestedAssignee | string |
| assigneeId | string |

Fields not in this whitelist are silently ignored.

**Response:** Updated ticket object with assignee.

### Add Message
```
POST /api/tickets/{id}/messages
```

**Request Body:**
```json
{
  "body": "Thank you for contacting us...",
  "source": "OUTBOUND_EMAIL",
  "teamMemberId": "clx...",
  "senderName": "Linus Baumberger",
  "senderEmail": "linus@studyflash.ch"
}
```

Source values: `OUTBOUND_EMAIL`, `INTERNAL_NOTE`

When source is `OUTBOUND_EMAIL`, the ticket status is automatically updated to `WAITING_ON_CUSTOMER`.

### Get Messages
```
GET /api/tickets/{id}/messages
```

Returns all messages for a ticket, ordered by creation date ascending.

### Assign Ticket
```
POST /api/tickets/{id}/assign
```

**Request Body:**
```json
{
  "assigneeId": "clx..."
}
```

Pass `null` for `assigneeId` to unassign. Sets ticket status to `IN_PROGRESS` when assigning, `OPEN` when unassigning.

---

## AI

### Categorize Ticket
```
POST /api/ai/categorize
```

**Request Body:**
```json
{
  "ticketId": "clx..."
}
```

Categorizes a single ticket using Claude Haiku. Updates the ticket with category, priority, language, summary, confidence, and suggested assignee. Auto-assigns to default team member if configured.

**Response:** The categorization result.

**Error:** Returns 503 if `ANTHROPIC_API_KEY` is not configured.

### Batch Categorize
```
POST /api/ai/categorize-batch
```

No request body. Finds up to 20 uncategorized tickets and categorizes them sequentially.

**Response:**
```json
{
  "categorized": 15,
  "errors": 2
}
```

### Generate Draft
```
POST /api/ai/draft
```

**Request Body:**
```json
{
  "ticketId": "clx..."
}
```

Generates an AI response draft using Claude Sonnet based on the ticket's conversation history.

**Response:**
```json
{
  "draft": "Vielen Dank für Ihre Nachricht..."
}
```

### Translate Text
```
POST /api/ai/translate
```

**Request Body:**
```json
{
  "text": "Ich möchte mein Abo kündigen",
  "targetLanguage": "en",
  "messageId": "clx...",
  "ticketId": "clx..."
}
```

`messageId` and `ticketId` are optional. When provided, the translation is saved to the message's `bodyTranslated` field.

**Response:**
```json
{
  "translated": "I would like to cancel my subscription"
}
```

---

## Outlook

### Sync Emails
```
POST /api/outlook/sync
```

No request body. Syncs emails from the configured Outlook shared mailbox.

- **Mock mode** (default): Imports 3 demo emails
- **Real mode** (`OUTLOOK_ENABLED=true`): Fetches from Microsoft Graph API

**Response:**
```json
{
  "created": 3,
  "updated": 0,
  "total": 3,
  "mock": true
}
```

### Webhook
```
POST /api/outlook/webhook
```

Microsoft Graph subscription endpoint. Handles:
- Subscription validation (responds with `validationToken`)
- Change notifications for new emails

---

## Enrichment

### Get Enrichment Data
```
GET /api/enrichment/{ticketId}
```

Returns mock enrichment data for a ticket's customer:

**Response:**
```json
{
  "sentry": [
    {
      "title": "TypeError: Cannot read property 'flashcards' of undefined",
      "count": 12,
      "lastSeen": "2 hours ago",
      "level": "error"
    }
  ],
  "posthog": {
    "sessions": [...],
    "lastActive": "2026-03-01",
    "totalSessions": 47,
    "featureFlags": { "new-quiz-mode": true },
    "events": [...]
  },
  "userData": {
    "plan": "monthly",
    "signupDate": "2025-09-15",
    "deckCount": 15,
    "cardCount": 234,
    "studySessions": 67
  }
}
```

---

## Dashboard

### Get Dashboard Data
```
GET /api/dashboard
```

**Response:**
```json
{
  "stats": {
    "total": 105,
    "open": 42,
    "inProgress": 12,
    "resolved": 38,
    "autoClosed": 13
  },
  "categoryDistribution": [
    { "category": "FLASHCARD_ISSUES", "_count": { "category": 15 } }
  ],
  "languageDistribution": [
    { "language": "de", "_count": { "language": 45 } }
  ],
  "recentTickets": [...],
  "assigneeWorkload": [
    { "assigneeId": "clx...", "_count": { "assigneeId": 8 }, "assignee": { "name": "Linus" } }
  ]
}
```

---

## Team Members

### List Team Members
```
GET /api/team-members
```

Returns all team members sorted by name.

**Response:**
```json
[
  {
    "id": "clx...",
    "name": "Linus Baumberger",
    "email": "linus@studyflash.ch",
    "role": "support"
  }
]
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Description of what went wrong"
}
```

| Status | Meaning |
|--------|---------|
| 400 | Invalid request (bad JSON, missing fields, no valid fields) |
| 404 | Resource not found |
| 500 | Internal server error |
| 503 | Service unavailable (AI key not configured) |
