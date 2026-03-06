# Studyflash Support Platform

An internal support platform MVP for Studyflash, built to centralize, triage, and respond to multilingual customer support tickets with AI assistance.

## Features

- **AI-Powered Triage** - Queue-based ticket triage with Semi-Auto and Full Auto modes, confidence-based auto-send/auto-close, and prefetch pipelining for instant ticket loading
- **Ticket Management** - View, filter, search, and manage 100+ support tickets with status tracking, priority levels, and category classification
- **Team Assignment** - Assign tickets to team members, track workload distribution, configurable default assignees per category
- **AI Categorization** - Automatic ticket classification using Claude Haiku (category, priority, language detection, English summary, confidence score)
- **AI Response Drafting** - Generate contextual response drafts in the customer's language using Claude Sonnet, with dual-language editing
- **Translation** - Automatic and one-click translation of customer messages (German, Dutch, French, Italian, etc.) to English
- **Response Templates** - Category-specific canned response templates for common ticket types
- **Outlook Integration** - Full Microsoft Graph API architecture for bidirectional email sync (runs in mock mode by default, real integration behind env toggle)
- **Data Enrichment** - Sentry error tracking, PostHog session data, and user database panels (mock data with clear API integration points)
- **Dashboard** - Statistics overview with category distribution charts, language breakdown, and recent ticket activity
- **Collapsible Sidebar** - Persistent sidebar that collapses to icon-only mode for more screen space
- **Dark Mode** - Toggle between light and dark themes

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, React 19) |
| UI | shadcn/ui + Tailwind CSS v4 |
| Database | PostgreSQL 16 + Prisma ORM |
| AI | Anthropic Claude (Haiku 4.5 + Sonnet 4.5) |
| Email | Microsoft Graph API (mocked) |
| Charts | Recharts |
| Runtime | Docker Compose |

## Quick Start

### Prerequisites

- [Node.js 22+](https://nodejs.org/)
- [Docker](https://www.docker.com/products/docker-desktop/)
- [Anthropic API Key](https://console.anthropic.com/) (optional, for AI features)

### Setup

1. **Clone and install dependencies**
   ```bash
   git clone <repo-url>
   cd studyflash-support
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env and add your ANTHROPIC_API_KEY (optional)
   ```

3. **Start PostgreSQL**
   ```bash
   docker compose up -d
   ```

4. **Run database migrations and seed**
   ```bash
   npx prisma generate
   npx prisma migrate dev
   npm run db:seed
   ```

5. **Start the app**
   ```bash
   npm run dev
   ```

6. **Open** http://localhost:3000

> **Demo Mode:** The platform works fully without any API keys. Outlook integration runs in mock mode with simulated emails, and AI features (categorization, drafting, translation) show clear "not configured" messages. Add your `ANTHROPIC_API_KEY` to `.env` to enable AI-powered features.

## Project Structure

```
src/
  app/
    (platform)/              # Main app pages
      dashboard/             # Stats overview with charts
      triage/                # AI-powered ticket triage queue
      tickets/               # Ticket list + detail views
      settings/              # Team, integration & triage config
    api/
      tickets/               # CRUD + assignment + messages
      ai/                    # Categorize, draft, translate
      outlook/               # Email sync + webhook
      enrichment/            # Sentry, PostHog, user data
      dashboard/             # Dashboard analytics
      team-members/          # Team member listing
  components/
    ui/                      # shadcn/ui components
    layout/                  # Collapsible sidebar + header
    templates/               # Template selector component
  lib/
    ai/                      # Anthropic Claude integration
    outlook/                 # Microsoft Graph client + mock
    settings.ts              # Settings management + sensitive categories
    constants.ts             # Status/priority colors, language labels
    db.ts                    # Prisma client
    utils.ts                 # Utility functions
prisma/
  schema.prisma              # Database models
  seed.ts                    # Import 100+ sample tickets
tickets/                     # Sample ticket data files
docs/                        # Architecture & detailed documentation
```

## Documentation

Detailed documentation is available in the [docs/](docs/) folder:

- [Architecture Overview](docs/architecture.md) - System design, database schema, and design decisions
- [AI Pipeline](docs/ai-pipeline.md) - Categorization, drafting, and translation details
- [Triage System](docs/triage-system.md) - Queue, auto-modes, pipelining, and templates
- [API Reference](docs/api-reference.md) - All API endpoints with request/response formats

## AI Pipeline

### Categorization (Claude Haiku 4.5)
Single API call per ticket that returns:
- Category (18 predefined categories)
- Priority (LOW/MEDIUM/HIGH/URGENT)
- Language detection (ISO 639-1)
- English summary
- Confidence score (0.0-1.0)
- Suggested assignee role

**Why Haiku:** Categorization is high-volume and low-stakes. Haiku provides fast, cost-efficient classification at ~$0.25/M input tokens — 12x cheaper than Sonnet — while maintaining sufficient accuracy for triage decisions.

### Response Drafting (Claude Sonnet 4.5)
- Generates responses in the customer's language
- Considers full conversation history
- Category-aware tone and content
- Dual-language editor: edit in English, auto-syncs to target language

**Why Sonnet:** Response drafts are customer-facing and low-volume. The quality difference justifies the higher cost, and the human-in-the-loop review mitigates any remaining risk.

## Triage System

The triage page provides a queue-based workflow for processing open tickets:

| Mode | Behavior |
|------|----------|
| **Semi-Auto** | AI categorizes and drafts; agent reviews and clicks Send |
| **Full Auto** | AI categorizes, drafts, and auto-sends/closes based on confidence thresholds |

Key features:
- **Prefetch pipelining** - Next ticket is fully prepared in the background while the agent reviews the current one
- **Sensitive category protection** - Cancellations, refunds, and billing tickets always require human review
- **Auto-close** - Garbage and misunderstanding tickets can be auto-closed above a confidence threshold
- **Response templates** - Category-specific canned responses for common ticket types

See [docs/triage-system.md](docs/triage-system.md) for full details.

## Outlook Integration Architecture

The platform includes a fully architected Microsoft Graph API integration that:
- Polls for new emails via `GET /users/{mailbox}/messages`
- Creates tickets from new conversations
- Appends messages to existing threads via `conversationId`
- Sends replies using `POST /messages/{id}/reply` (maintains thread parity)
- Supports webhook subscriptions for real-time notifications

**Mock mode (default):** Simulated email data with "Sync from Outlook" button
**Real mode:** Set `OUTLOOK_ENABLED=true` with Azure AD credentials

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Next.js (full-stack)** | API routes collocated with pages reduce infrastructure complexity. Single deployment, shared types between frontend and backend. |
| **Haiku for categorization, Sonnet for drafting** | Cost optimization: categorization is high-volume/low-stakes (cheap model), drafting is low-volume/customer-facing (quality model). |
| **Mock mode for external integrations** | The architecture for Outlook, Sentry, and PostHog is fully built. Real integration is configuration (API keys + Azure AD setup), not engineering. Mock mode enables demo without external dependencies. |
| **No authentication** | Internal tool MVP for a small team. Network-level access control is sufficient initially. Production path: NextAuth.js with Azure AD SSO. |
| **shadcn/ui** | Components are copied into the project (no runtime dependency). Full control over styling, tree-shakeable, consistent design system. |
| **Prefetch pipelining** | In Full Auto mode, preparing the next ticket while the agent reviews the current one eliminates wait time between tickets. |
| **Sensitive category blocklist** | Cancellations, refunds, and billing tickets are hardcoded to require human review — never auto-sent or auto-closed regardless of confidence. |

## Scripts

```bash
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build
npm run start        # Start production server
npm run db:seed      # Seed 100+ sample tickets
npm run db:migrate   # Run Prisma migrations
npm run db:reset     # Reset database and re-run migrations
npm run db:studio    # Open Prisma Studio GUI
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | No | Enables AI categorization + drafting |
| `OUTLOOK_ENABLED` | No | Set to "true" for real Outlook sync |
| `AZURE_TENANT_ID` | No | Azure AD tenant ID |
| `AZURE_CLIENT_ID` | No | Azure AD app client ID |
| `AZURE_CLIENT_SECRET` | No | Azure AD app client secret |
| `OUTLOOK_SHARED_MAILBOX` | No | Shared mailbox email address |

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Port 5432 in use | Stop other PostgreSQL instances or change the port in `docker-compose.yml` and `DATABASE_URL` |
| Prisma generate fails | Run `npm install` first, then `npx prisma generate` |
| AI features return 503 | Add `ANTHROPIC_API_KEY` to your `.env` file |
| Seed data missing | Run `npm run db:seed` (safe to run multiple times — it resets data) |
| Docker not starting | Ensure Docker Desktop is running before `docker compose up -d` |
| Hydration errors | Clear browser localStorage and hard refresh |
