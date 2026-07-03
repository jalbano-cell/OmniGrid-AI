# Importing the OmniGrid AI base into Airtable

Airtable doesn't have a self-service file format for importing a fully-typed
multi-table base in one shot — CSV import (below) is the standard path, but
it only gets you as far as column headers with guessed types. There's also
an API option that gets you the *exact* schema (correct single-select
choices, real date fields) with no manual fixing — see the bottom of this
file.

## Option A — CSV import (5 minutes, manual type fixes)

1. In Airtable, create a new **base** (name it whatever you want, e.g. "OmniGrid AI CRM").
2. For each of the 4 CSV files in this folder, in the base: **Add or import → CSV file** → select the file. Airtable will create a new table named after the file with one example row.
3. **Delete the example row** in each table once it's created (it's placeholder data, not a real lead).
4. Rename each table to match exactly (Airtable names it after the filename, so this should already be right): `Leads`, `Audits`, `Outreach`, `Meetings`.
5. Fix field types CSV import gets wrong — this is the manual part:
   - **Leads**: set `status` to **Single select** with options `New, Audited, Contacted, Replied, Interested, Closed`. Set `score` to **Number**. Set `lastContacted` and `createdAt` to **Date**.
   - **Audits**: set `uiUxScore`, `seoScore`, `performanceScore`, `conversionScore`, `overallScore` to **Number**. Set `summary`, `opportunities`, `rawAnalysis` to **Long text**. Set `createdAt` to **Date**.
   - **Outreach**: set `status` to **Single select** with options `Draft, Pending Approval, Sent, Rejected, Replied`. Set `body` to **Long text**. Set `sentAt`, `createdAt` to **Date**.
   - **Meetings**: set `status` to **Single select** with options `Scheduled, Completed, Cancelled`. Set `datetime` to **Date** (include a time field). Set `createdAt` to **Date**.
6. Grab the base ID from the base's API docs page (Help → API documentation, or `https://airtable.com/api/appXXXXXXXX` — starts with `app`) and put it in `AIRTABLE_BASE_ID`.

## Option B — Let Claude create it exactly right via the API (recommended)

Airtable's Web API can create a base with the correct field types (including single-select options) in one call — no manual fixing afterward. If you'd rather do this:

1. Create a Personal Access Token at https://airtable.com/create/tokens with scopes `data.records:read`, `data.records:write`, **`schema.bases:write`**.
2. Find your workspace ID: open any base in Airtable, click the workspace name in the top-left, and look at the URL — it's the `wspXXXXXXXX` part.
3. Give me the token and workspace ID, and I'll call Airtable's `POST /v0/meta/bases` endpoint to create the base with all 4 tables and exact field types in one shot, then hand you back the base ID.

(I won't ask you to paste the token anywhere but directly to me in chat, and it only needs to be used once for the creation call — you can revoke it afterward if you'd rather not leave it active.)
