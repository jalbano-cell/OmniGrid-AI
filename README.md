# OmniGrid AI — Internal Sales Outreach Platform

An internal tool that finds leads, audits their websites, drafts personalized outreach, and books discovery calls — with every email gated behind a manual Approval Queue.

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · Framer Motion · Prisma · PostgreSQL (Neon) · Recharts

## Getting started

```bash
npm install
cp .env.example .env   # if you haven't already — fill in the keys below
npx prisma db push     # syncs the schema to your Postgres database
npm run dev
```

Visit `http://localhost:3000`. You'll be asked for a password first (see below) — the app otherwise works with **zero configuration**, every page renders with clean empty states, but three integrations need setup before they do real work.

## Login screen

The whole app sits behind a single shared password (`src/middleware.ts` + `src/lib/auth/session.ts`) — there are no individual user accounts, just one password for the team.

1. Set `APP_PASSWORD` in `.env` to whatever you want people to type in at `/login`.
2. Set `AUTH_SECRET` to a long random string (used to sign the session cookie): `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Changing this later invalidates all existing sessions.

Sessions last 30 days and are stored in an httpOnly cookie — there's no user table, so there's nothing to reset if someone forgets the password other than telling them the value of `APP_PASSWORD`.

## Configuring the integrations

### 1. Web search (Lead Finder)

Lead discovery calls the [Tavily](https://tavily.com) Search API — a real, working search, not a mock. (Google's Custom Search API no longer supports whole-web search for newly created search engines, so this app uses Tavily instead.)

1. Sign up at https://tavily.com and copy an API key from the dashboard.
2. Put it in `TAVILY_API_KEY`. Free tier: 1,000 searches/month.

Without this, the Leads page shows a clear "not configured" banner instead of pretending to find businesses. Note: Tavily returns up to 20 results per query with no pagination, so very large lead requests (30+) may return fewer results than asked for after directory/social links are filtered out — the search runs a couple of query variants to help fill the gap.

### 2. Google (Gmail send + Calendar create)

1. In https://console.cloud.google.com/apis/credentials, create/select a project and enable the **Gmail API** and **Google Calendar API**.
2. Configure the OAuth consent screen (Internal if you're on Google Workspace, otherwise External + add yourself as a test user).
3. Create an **OAuth client ID** (type: Web application) with this redirect URI:
   `http://localhost:3000/api/auth/google/callback`
4. Put the client ID/secret in `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
5. In the running app, go to **Settings → Integrations → Connect Google** and complete the consent flow.

Until this is connected, Approve and "Schedule discovery call" fail with a clear error instead of silently doing nothing.

### 3. Claude (optional — better email phrasing)

Set `ANTHROPIC_API_KEY` to have outreach drafts written by Claude instead of the built-in template writer. Both paths are constrained to only reference the specific audit findings for that business — neither can invent an issue that wasn't actually found. If the key is missing or the API call fails for any reason, it falls back to the deterministic template automatically.

### 4. Airtable (optional — synced CRM mirror)

**Postgres remains the database the app actually runs on.** Airtable is kept as a synced read/write mirror so the team can view and manage the pipeline in Airtable's own UI (filter by score, drag between statuses, etc.) without touching the app. Nothing in the app ever reads from Airtable to decide what to do next — it's a one-way-authoritative sync, Postgres → Airtable, with a couple of Airtable-only read views for convenience.

1. Create a Personal Access Token at https://airtable.com/create/tokens with scopes `data.records:read`, `data.records:write`, `schema.bases:read`, scoped to the base you'll use.
2. Create a base with exactly these 4 tables (names and field names matter — the integration writes to these literal strings). Full field list is in `.env.example`:
   - **Leads** — businessName, website, email, phone, industry, location, score, status (single select: New, Audited, Contacted, Replied, Interested, Closed), lastContacted, createdAt
   - **Audits** — leadId, uiUxScore, seoScore, performanceScore, conversionScore, overallScore, summary, opportunities, rawAnalysis, createdAt
   - **Outreach** — leadId, subject, body, status (single select: Draft, Pending Approval, Sent, Rejected, Replied), sentAt, createdAt
   - **Meetings** — leadId, title, datetime, status (single select: Scheduled, Completed, Cancelled), calendarEventId, createdAt
3. Copy the base ID (starts with `app...`, found on the base's API docs page) into `AIRTABLE_BASE_ID`, and the token into `AIRTABLE_API_KEY`.
4. Already have leads/audits/outreach/meetings in Postgres from before Airtable was configured? Run `npm run sync:airtable` once to backfill everything (safe to re-run — it's idempotent, matching existing Airtable records by website/name rather than creating duplicates).

Without these two env vars, every workflow (lead discovery, audits, outreach, meetings) runs exactly as before — the Airtable write is just skipped. See **Airtable sync details** below for what triggers each write, retry behavior, and the `/airtable-crm` view.

## How the safety model works

- **Nothing is ever sent automatically.** Every draft lands in the Outreach Queue in `DRAFTED` status. `gmail_send()` is only ever invoked from `approveAndSendOutreach()` (`src/lib/services/approvalWorkflow.ts`), which itself only runs when a human clicks Approve and confirms the dialog.
- **No fabricated data.** Website audits (`src/lib/audit/engine.ts`) are computed from the site's actual fetched HTML — every strength/weakness string is generated from a real, deterministic check. Outreach emails only reference that audit's findings.
- **No duplicate emails.** Businesses are deduped by website URL at discovery time; approving a second email to an already-contacted business is blocked unless explicitly marked as a follow-up. The Airtable mirror is deduped the same way (find-by-website-or-name before ever creating).
- **Daily limits.** Settings enforces a daily research limit (new leads/day) and a daily email approval limit, both configurable.
- **Full audit trail.** Every tool call, search, audit, generated email, approval action, Airtable sync, and error is written to `LogEntry` and viewable at `/logs`.

## Airtable sync details

All Airtable reads/writes go through `src/lib/services/airtable.ts` — nowhere else in the codebase talks to Airtable directly. What triggers a write:

| Event | Airtable write |
|---|---|
| Lead discovered | Find-or-create in **Leads** (by website/name) |
| Audit generated | Create in **Audits**; update **Leads**.status → "Audited", .score |
| Outreach drafted | Create in **Outreach** with status "Pending Approval" |
| Email sent (Approve clicked) | **Outreach**.status → "Sent", .sentAt; **Leads**.status → "Contacted", .lastContacted |
| Draft rejected | **Outreach**.status → "Rejected" |
| Reply marked | **Outreach**.status → "Replied"; **Leads**.status → "Replied" |
| Meeting scheduled | Create in **Meetings**; **Leads**.status → "Interested" |

**Failure handling**: every write retries once on failure. If it still fails, the failure is logged (`/logs`, type `AIRTABLE_SYNC`) and the payload is saved to the `AirtableSyncQueue` Postgres table instead of being dropped — nothing in the app ever crashes or blocks because Airtable is slow/down. Replay queued writes anytime with `npm run sync:airtable` (it drains the queue first, then re-verifies every record).

**`/airtable-crm`** in the app reads live from Airtable (not Postgres) with the three filters requested for the CRM view: Leads by score > 80, Leads by status = New, and Outreach by status = Pending Approval. It's a verification view, not the primary UI — the existing Leads/Outreach Queue/CRM pages (backed by Postgres) remain how you actually work the pipeline day to day.

## Adding a new AI tool

Tools live in `src/lib/tools/` behind a shared `ToolDefinition<Input, Output>` interface (`src/lib/tools/types.ts`). To add one:

1. Implement the interface in its own file (see `webSearch.ts` / `gmailSend.ts` / `calCreate.ts` for the pattern — validate config, call the API, log the result via `logEvent`/`logError`, return `{ ok, data, error }`).
2. Register it in `src/lib/tools/registry.ts`.

Nothing else in the app needs to know about specific tools.

## Project structure

```
src/
  app/
    (dashboard)/        # Overview, Leads, Audits, Outreach, Emails, Calendar, Analytics, Airtable CRM, Settings, Logs, CRM
    actions/             # Server Actions — thin wrappers that call lib/services and revalidate paths
    api/                 # OAuth callback + lightweight search endpoint
  components/
    ui/                  # shadcn/ui primitives
    layout/              # Sidebar, TopBar, Command Palette
    leads/ audits/ outreach/ crm/ analytics/ calendar/ settings/ logs/  shared/
  lib/
    tools/               # web_search, gmail_send, cal_create + registry
    google/               # OAuth client + token storage
    audit/                # HTML fetcher + heuristic scoring engine
    services/             # Business logic: lead discovery, outreach generation, approval workflow, stats, logging, Airtable sync
    db/                   # Prisma client singleton
prisma/
  schema.prisma
scripts/
  syncExistingDataToAirtable.ts  # backfill/replay script — npm run sync:airtable
```

## Scripts

- `npm run dev` — start the dev server
- `npm run build` / `npm start` — production build + serve
- `npm run db:push` — sync the Prisma schema to the database
- `npm run db:studio` — open Prisma Studio to browse data
- `npm run sync:airtable` — backfill existing Postgres data into Airtable and replay any queued failed syncs
