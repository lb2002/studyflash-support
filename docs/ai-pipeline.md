# AI Pipeline

The platform uses Anthropic Claude for three AI operations: categorization, response drafting, and translation. Each uses a different model optimized for its use case.

## Model Selection

| Operation | Model | Rationale |
|-----------|-------|-----------|
| Categorization | Claude Haiku 4.5 | High-volume, structured output. Fast and cheap (~$0.25/M input tokens). |
| Drafting | Claude Sonnet 4.5 | Customer-facing text. Quality justifies higher cost. |
| Translation | Claude Haiku 4.5 | Mechanical task, fast turnaround needed. |

## Categorization

**Endpoint:** `POST /api/ai/categorize`
**Model:** `claude-haiku-4-5-20251001`
**File:** `src/lib/ai/categorize.ts`

### Input
The full ticket body text is sent to Claude with a system prompt that defines:
- 18 valid categories
- 4 priority levels with guidelines (URGENT = data loss/payment; LOW = spam/feedback)
- Expected output format (JSON)

### Output
A single JSON object with:

```json
{
  "category": "FLASHCARD_ISSUES",
  "priority": "MEDIUM",
  "language": "de",
  "summary_en": "User cannot create flashcards from PDF uploads",
  "confidence": 0.92,
  "suggested_assignee_role": "engineering"
}
```

### Processing
1. AI returns JSON (markdown fences stripped if present)
2. Result is parsed and stored on the ticket record
3. If an `aiSuggestedAssignee` role matches a default assignee mapping, the ticket is auto-assigned

### Batch Categorization
**Endpoint:** `POST /api/ai/categorize-batch`

Processes up to 20 uncategorized tickets in sequence. Used by the "Categorize All" button on the tickets list page.

## Response Drafting

**Endpoint:** `POST /api/ai/draft`
**Model:** `claude-sonnet-4-5-20250929`
**File:** `src/lib/ai/draft.ts`

### Input
- Full conversation history (all inbound and outbound messages)
- Ticket category (if categorized)
- Detected customer language

### System Prompt Guidelines
- Reply in the customer's language
- Be warm, empathetic, and helpful
- Keep responses concise but thorough
- Category-specific instructions (cancellation process, refund acknowledgment, technical troubleshooting)
- Sign off as "The Studyflash Team"

### Dual-Language Editing
When the draft is in a non-English language:
1. Draft is translated to English via the translate endpoint
2. UI shows side-by-side editors: English (left) and target language (right)
3. Edits to the English version auto-sync to the target language after a 1.5s debounce
4. Agent can also edit the target language directly

### Draft Storage
Drafts are saved to localStorage (`draft-{ticketId}`, `draft-en-{ticketId}`, `draft-lang-{ticketId}`) so they persist across page navigations.

## Translation

**Endpoint:** `POST /api/ai/translate`
**Model:** `claude-haiku-4-5-20251001`
**File:** `src/lib/ai/translate.ts`

### Use Cases

1. **Inbound message translation** - Customer messages in non-English/non-German languages are auto-translated to English on ticket load
2. **Draft sync** - English edits are translated to the target language for the customer
3. **Subject translation** - Ticket subjects can be translated for the ticket list

### Persistence
When `messageId` and `ticketId` are provided, the translation is saved to the message's `bodyTranslated` field in the database.

## Error Handling

All three AI modules include:
- Null checks on the API response (`message.content[0]` existence and type verification)
- Graceful fallback to empty string if response is unexpected
- JSON parse error handling in categorization (throws descriptive error)
- API key validation at the route level (returns 503 if `ANTHROPIC_API_KEY` is not set)

## Cost Considerations

| Operation | Model | Approx. Cost | Volume |
|-----------|-------|-------------|--------|
| Categorize | Haiku 4.5 | ~$0.001/ticket | Every ticket (once) |
| Draft | Sonnet 4.5 | ~$0.01/draft | Every ticket in triage |
| Translate | Haiku 4.5 | ~$0.001/translation | Non-EN/DE messages + draft sync |

For a support team processing ~100 tickets/day, estimated daily AI cost is under $2.
