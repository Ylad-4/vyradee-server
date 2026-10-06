# VyraDee Social API

Fastify + TypeScript + Prisma API for the VyraDee creator workflow.

## Setup

```bash
cp .env.example .env
npm install
npm run setup
npm run dev
```

In `.env`, replace:

- `SUPABASE_DB_PASSWORD`
- `JWT_SECRET`
- the three `CLOUDINARY_*` values
- `GEMINI_API_KEY`

The setup command safely constructs the Supabase pooler URLs, generates Prisma, synchronizes the schema, and validates TypeScript.

Health check: `http://localhost:4000/api/health`

## API

- `/api/auth` — register, login, current user
- `/api/workspaces` — current creator workspace
- `/api/brand-profile` — Brand Brain
- `/api/content` — content, analysis, variants, and approvals
- `/api/content/:id/analyze` — Gemini video/image analysis and platform variants
- `/api/media/upload-signature` — secure Cloudinary upload authorization
- `/api/social-accounts` — social account metadata
- `/api/schedules` — scheduled publication records
- `/api/analytics/overview` — observed performance totals

The API stores workflow records and media references. It never returns password hashes or social account token references.

## Media and AI flow

1. The app requests a signed upload.
2. The app uploads media directly to Cloudinary.
3. The API stores the Cloudinary URL and metadata in Supabase.
4. Gemini analyzes the media automatically.
5. The saved Brand Brain guides the generated captions, CTA, hashtags, tone, audience, and publishing rules.
6. The creator edits and approves platform variants in Content Studio.

Cloudinary and Gemini secrets stay on the server. Never put them in the Expo `.env`.
