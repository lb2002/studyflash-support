# Triage System

The triage page (`/triage`) provides a queue-based workflow for processing open support tickets. It is the primary interface for support agents handling incoming tickets.

## Queue

Open tickets are loaded into a queue, sorted by:
1. Priority (URGENT > HIGH > MEDIUM > LOW)
2. Creation date (oldest first)

The agent progresses through the queue one ticket at a time. A progress bar shows position in the queue.

### Language Filter
A toggle button filters the queue to English-only tickets or all languages. Useful for agents who only handle English correspondence.

## Triage Modes

### Semi-Auto Mode
The default mode. For each ticket:
1. AI categorizes the ticket (category, priority, language, summary, confidence)
2. AI generates a draft response in the customer's language
3. Inbound messages are translated to English (if not EN/DE)
4. Enrichment data is fetched (Sentry, PostHog, user data)
5. Agent reviews the draft, edits if needed, and clicks **Send** or **Skip**

The agent has full control. Nothing is sent automatically.

### Full Auto Mode
Automated processing based on confidence thresholds:

1. Steps 1-4 from Semi-Auto run automatically
2. The system evaluates the ticket:
   - **Auto-close candidates** (GARBAGE, MISUNDERSTANDING categories): If confidence >= auto-close threshold (default 75%), the ticket is auto-closed after a 2-second delay
   - **Sensitive categories** (SUBSCRIPTION_CANCELLATION, REFUND_REQUEST, BILLING_INVOICE): Always skipped — these require human review
   - **Normal tickets**: If confidence >= auto-send threshold (default 80%) and a draft exists, the reply is auto-sent after a 2-second delay
   - **Low confidence**: Ticket is skipped (logged as "skipped-low-confidence")
   - **Errors**: Ticket is skipped (logged as "skipped-error")

The 2-second delay before auto-actions allows the agent to intervene by clicking "Stop Auto".

### Auto-Triage Log
During Full Auto mode, a real-time log panel shows each action taken:
- Ticket ID and subject
- Action: "auto-sent", "auto-closed", "skipped-low-confidence", "skipped-error"
- Confidence score percentage
- Timestamp

## Preparation Pipeline

Each ticket goes through a 4-step preparation pipeline with status indicators:

| Step | Status | Description |
|------|--------|-------------|
| Categorize | loading/done/error | AI categorization via Claude Haiku |
| Draft | loading/done/error | AI response draft via Claude Sonnet |
| Translate | loading/done/error | Translate non-EN/DE messages to English |
| Enrich | loading/done/error | Fetch Sentry/PostHog/user data |

Steps run concurrently where possible (translation + categorization start together; drafting starts after categorization).

## Prefetch Pipelining

To eliminate wait time between tickets in Full Auto mode, the system prefetches and fully prepares the next ticket while the agent reviews (or auto-processes) the current one.

### How It Works
1. After the current ticket's preparation completes, `triggerPrefetch()` starts preparing the next ticket in the queue
2. The prefetch runs the full pipeline: categorize, draft, translate, enrich
3. Results are stored in a `prefetchCacheRef` (React ref, not state — avoids re-renders)
4. When the agent advances to the next ticket, the cached result is applied instantly
5. A fresh status check ensures the ticket is still OPEN (it may have been processed via another tab)

### Fallback
If the prefetch fails or the ticket's status changed, the system falls back to the normal preparation pipeline.

## Sensitive Categories

Three categories are hardcoded as sensitive and never auto-sent or auto-closed:

- `SUBSCRIPTION_CANCELLATION`
- `REFUND_REQUEST`
- `BILLING_INVOICE`

These involve money or account changes and always require human review, regardless of AI confidence. In Full Auto mode, these tickets are skipped with a log entry.

## Auto-Close

Tickets in auto-close categories (configurable in Settings, default: GARBAGE, MISUNDERSTANDING) are handled differently:

1. No draft is generated (skip drafting step)
2. The ticket shows an "Auto-Close" button instead of "Send"
3. In Full Auto mode, the ticket is auto-closed if confidence meets the threshold
4. The ticket status is set to `AUTO_CLOSED`

## Response Templates

Category-specific canned responses can be configured in Settings and used during triage:

1. Agent clicks the template dropdown next to "Categorize" and "Draft" buttons
2. Available templates are filtered by the ticket's current category
3. Selecting a template replaces the draft text
4. Templates are stored in localStorage settings

## Draft Editing

### Single Language
For English or German tickets, a simple textarea editor is shown.

### Dual-Language (Split Editor)
For other languages (Dutch, French, Italian, etc.):
- **Left pane**: English version (editable)
- **Right pane**: Target language version (editable, auto-synced)
- Editing English auto-translates to target language after 1.5s debounce
- Agent can also edit the target language directly

### Edit Toggle
By default, the draft is shown as read-only. Click "Edit" to enable editing. This prevents accidental modifications.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` | Skip (review later) |
| `2` | Toggle edit mode |
| `Enter` | Send reply / Auto-close |

## Enrichment Sidebar

The right panel shows contextual data for the current ticket:

### Sentry Errors
- Recent error titles affecting the customer
- Error count and last seen time
- Error severity level

### PostHog Analytics
- Recent session recordings (duration, date)
- Total session count and last active date
- Feature flags enabled for the user
- Recent events (deck_created, flashcard_studied, etc.)

### User Data
- Subscription plan (free/monthly/yearly)
- Signup date, last login
- Deck count, card count, study sessions
- Language, country, platform

## Configuration

All triage thresholds are configurable in the Settings page:

| Setting | Default | Description |
|---------|---------|-------------|
| Auto-Send Confidence Threshold | 80% | Minimum AI confidence to auto-send in Full Auto mode |
| Auto-Close Confidence Threshold | 75% | Minimum AI confidence to auto-close in Full Auto mode |
| Auto-Close Categories | GARBAGE, MISUNDERSTANDING | Categories eligible for auto-close |
| Default Assignee Map | (empty) | Auto-assign tickets by category to specific team members |
