# Jerboa Circle

Jerboa Circle is a public event poster archive for an independent literary and artistic circle, with the private member tools preserved behind `/members`.

## What changed

- No Supabase setup is required.
- Data saves immediately in the browser with `localStorage`.
- Backup and transfer use the built-in sync code export/import flow.
- The app is ready for simple Vercel deployment.
- Shared sync requires `JERBOA_SYNC_KEY` in Vercel.
- Keeper access is role-based and verified by the server; no admin password is bundled into the public app.
- Public poster archive lives at `/`.
- Individual records live at `/archive/:id`.
- Internal member tools live at `/members`.

## Local development

```bash
npm install
npm run dev
```

Use Vercel's local runtime when testing the shared sync API:

```bash
npm run dev:vercel
```

## Build

```bash
npm run build
```

Run the full pre-deploy check:

```bash
npm run check
```

The check includes a static route smoke test and a performance budget so large new assets are caught before deploy.

## Deploy on Vercel

Import this repository in Vercel and use the default Vite settings:

- Build command: `npm run build`
- Output directory: `dist`

Recommended environment variables:

- `JERBOA_SYNC_KEY`: legacy/shared write key for member and archive sync.
- `JERBOA_AUTH_SECRET`: signing secret for temporary role sessions.
- `JERBOA_ADMIN_KEY`: owner key that can authenticate either role.
- `JERBOA_MEMBER_ADMIN_KEY`: key for `/members` admin tools.
- `JERBOA_ARCHIVE_EDITOR_KEY`: key for archive keeper/editor tools.
- `JERBOA_ANALYTICS_DISABLED=true`: optional kill switch for product analytics.

Product analytics only records operational signals such as public archive searches, record opens, joins/cancels, habit status changes, and sync failures. It does not send names, comments, uploaded media, or private reflection text.
