# Architecture Overview

## System Architecture

Studyflash Support is a full-stack Next.js 15 application using the App Router pattern. All backend logic lives in API routes collocated with the frontend, deployed as a single service.

```
                    ┌─────────────────────────────────┐
                    │         Next.js App              │
                    │  ┌───────────┐  ┌────────────┐  │
 Browser ──────────►│  │  Pages    │  │ API Routes │  │
                    │  │ (React)   │  │ (Node.js)  │  │
                    │  └───────────┘  └─────┬──────┘  │
                    └───────────────────────┼─────────┘
                                            │
                    ┌───────────────────────┼─────────────────────┐
                    │                       │                     │
               ┌────▼────┐          ┌──────▼──────┐      ┌──────▼──────┐
               │PostgreSQL│          │  Anthropic  │      │  Microsoft  │
               │ (Prisma) │          │  Claude API │      │  Graph API  │
               └──────────┘          └─────────────┘      └─────────────┘
                                     Haiku + Sonnet        (Mock mode)
```

## Database Schema

### Models

**TeamMember**
| Field | Type | Notes |
|-------|------|-------|
| id | String (CUID) | Primary key |
| name | String | |
| email | String | Unique |
| role | String | "admin", "support", or "engineering" |
| avatarUrl | String? | Optional |

**Ticket**
| Field | Type | Notes |
|-------|------|-------|
| id | String (CUID) | Primary key |
| externalId | String? | Unique, from ticket filename (e.g., "0001") |
| subject | String | First 80 chars of body |
| status | Enum | OPEN, IN_PROGRESS, WAITING_ON_CUSTOMER, RESOLVED, CLOSED, AUTO_CLOSED |
| priority | Enum | LOW, MEDIUM, HIGH, URGENT |
| category | Enum? | 18 categories (see below) |
| tags | String[] | Metadata tags |
| customerEmail | String? | |
| customerName | String? | |
| language | String? | ISO 639-1 code |
| translatedSubject | String? | |
| aiSummary | String? | English summary from AI |
| aiConfidence | Float? | 0.0 - 1.0 |
| aiSuggestedAssignee | String? | "support", "admin", or "engineering" |
| outlookMessageId | String? | For email threading |
| outlookConversationId | String? | For email threading |
| source | String? | "WEB" or "MOBILE" |
| assigneeId | String? | FK to TeamMember |

**Message**
| Field | Type | Notes |
|-------|------|-------|
| id | String (CUID) | Primary key |
| body | String | Message content |
| bodyTranslated | String? | English translation |
| source | Enum | INBOUND_EMAIL, OUTBOUND_EMAIL, OUTBOUND_OUTLOOK, INTERNAL_NOTE, AI_DRAFT |
| senderEmail | String? | |
| senderName | String? | |
| teamMemberId | String? | FK to TeamMember |
| outlookMessageId | String? | Unique, for deduplication |
| ticketId | String | FK to Ticket (cascade delete) |

**Enrichment**
| Field | Type | Notes |
|-------|------|-------|
| id | String (CUID) | Primary key |
| ticketId | String | FK to Ticket (cascade delete) |
| type | String | "sentry", "posthog", "userData" |
| data | JSON | Provider-specific data |
| fetchedAt | DateTime | |

### Ticket Categories (18)

| Category | Description |
|----------|-------------|
| SUBSCRIPTION_CANCELLATION | User wants to cancel subscription |
| REFUND_REQUEST | User requesting a refund |
| FLASHCARD_ISSUES | Problems with flashcard creation/study |
| ACCOUNT_ISSUES | Login, password, account access |
| BILLING_INVOICE | Invoice or payment questions |
| CONTENT_UPLOAD | Issues uploading study materials |
| TECHNICAL_ERRORS | Bugs, crashes, errors |
| LANGUAGE_ISSUES | Problems with language/translation features |
| DATA_LOSS | Lost flashcards, decks, or progress |
| QUIZ_ISSUES | Quiz generation or taking problems |
| PODCAST_ISSUES | Podcast player issues |
| MINDMAP_ISSUES | Mind map generation problems |
| MOCK_EXAM_ISSUES | Mock exam feature problems |
| SUMMARY_ISSUES | Summary generation problems |
| GENERAL_HOW_TO | How to use the platform |
| MISUNDERSTANDING | Not a real support request |
| GARBAGE | Spam or irrelevant content |
| OTHER | Doesn't fit other categories |

### Database Indexes

- `status` - Filter tickets by status
- `category` - Filter tickets by category
- `assigneeId` - Filter tickets by assignee
- `createdAt` - Sort tickets by date

## Frontend Architecture

### Layout

The platform uses a `(platform)` route group with a shared layout:

```
┌──────┬──────────────────────────────────┐
│      │         Header                   │
│ Side │  (theme toggle, user selector)   │
│ bar  ├──────────────────────────────────┤
│      │                                  │
│ Nav  │         Main Content             │
│      │      (page-specific)             │
│      │                                  │
│      │                                  │
│ ──── │                                  │
│ Mock │                                  │
│ Coll │                                  │
└──────┴──────────────────────────────────┘
```

- **Sidebar** - Collapsible navigation (Dashboard, Triage, Tickets, Settings). Collapse state persisted in localStorage.
- **Header** - Theme toggle (light/dark), team member selector ("Acting as" dropdown).

### Pages

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/dashboard` | Stats cards, recent tickets, category bar chart, language pie chart |
| Triage | `/triage` | Queue-based ticket processing with Semi-Auto and Full Auto modes |
| Tickets | `/tickets` | Filterable ticket table with search, pagination, bulk categorize |
| Ticket Detail | `/tickets/[id]` | Full ticket view with messages, reply editor, enrichment sidebar |
| Settings | `/settings` | Team, AI config, triage thresholds, templates, default assignees |

### State Management

The application uses React state (useState/useCallback/useRef) without external state management:

- **Settings** - Stored in localStorage, loaded via `loadSettings()` from `src/lib/settings.ts`
- **Sidebar collapse** - localStorage key `sidebar-collapsed`
- **Current user** - localStorage key `currentUserId`
- **Draft replies** - localStorage keys `draft-{id}`, `draft-en-{id}`, `draft-lang-{id}`

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Next.js full-stack** | API routes collocated with pages. Single deployment, shared TypeScript types. |
| **No external state management** | Internal tool with limited concurrent state. React useState + localStorage is sufficient. |
| **localStorage for settings** | Avoids database complexity for per-user preferences. Adequate for a small team MVP. |
| **No authentication** | Internal tool for a small team. Network-level access control suffices. Production path: NextAuth.js + Azure AD SSO. |
| **shadcn/ui** | Components copied into the project (no runtime dependency). Full control, tree-shakeable. |
| **Prisma ORM** | Type-safe database access, auto-generated types, migration management. |
| **Docker Compose (DB only)** | PostgreSQL runs in Docker; app runs natively for fast iteration. Full Docker deployment available via Dockerfile. |
| **Mock mode for external services** | Architecture for Outlook, Sentry, PostHog is fully built. Real integration is configuration, not engineering. |

## Deployment

### Docker (Production)

The included Dockerfile builds a standalone Next.js production image:

```bash
docker build -t studyflash-support .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e ANTHROPIC_API_KEY="..." \
  studyflash-support
```

### Development

```bash
docker compose up -d     # Start PostgreSQL
npm run dev              # Start Next.js dev server (Turbopack)
```
