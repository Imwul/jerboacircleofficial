# Jerboa Circle

Jerboa Circle is a public event poster archive for an independent literary and artistic circle, with the private member tools preserved behind `/members`.

## What changed

- No Supabase setup is required.
- Data saves immediately in the browser with `localStorage`.
- Backup and transfer use the built-in sync code export/import flow.
- The app is ready for simple Vercel deployment.
- Public poster archive lives at `/`.
- Individual records live at `/archive/:id`.
- Internal member tools live at `/members`.

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
