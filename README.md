# Jerboa Circle

Jerboa Circle is a small club calendar, member, coin, and habit tracker built as a static React app.

## What changed

- No Supabase setup is required.
- Data saves immediately in the browser with `localStorage`.
- Backup and transfer use the built-in sync code export/import flow.
- The app is ready for simple Vercel deployment.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy on Vercel

Import this repository in Vercel and use the default Vite settings:

- Build command: `npm run build`
- Output directory: `dist`
