This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Job Matcher (Adzuna)

Jobs are pulled from the Adzuna API once a day into the `adzuna_*` tables; the app never calls Adzuna at request time.

1. Get a free App ID and App Key at [developer.adzuna.com](https://developer.adzuna.com/signup) and set `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` and `CRON_SECRET` (see `.env.example`).
2. Run `supabase/migrations/20260928000000_job_matching.sql` in the Supabase SQL editor (it enables `pgvector`).
3. Manual runs (app must be running):

```bash
node scripts/ingest-jobs.mjs --dry-run          # fetch one page, print mapped jobs, write nothing
node scripts/ingest-jobs.mjs --max-calls 10     # real run capped at 10 Adzuna calls
node scripts/ingest-jobs.mjs --url https://your-deployment.example
```

The daily run is a Vercel Cron (`vercel.json`, 18:00 UTC). Each run is logged in `adzuna_ingest_runs`. Adzuna call limits are enforced in `adzuna_api_usage` and a run stops, never retries, when a daily/weekly/monthly budget is used up. If Adzuna access ever ends, `delete from public.adzuna_jobs; delete from public.adzuna_categories;` removes all Adzuna data (interactions and matches cascade).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
