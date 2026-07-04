# Deployment

Each tier deploys independently. Recommended free-tier-friendly targets:

| Tier | Target | Notes |
|------|--------|-------|
| Web (Next.js) | **Vercel** | Zero-config; set `NEXT_PUBLIC_API_URL` |
| API (NestJS) | **Render** / Railway | Docker deploy; runs migrations on boot |
| AI service (FastAPI) | **Render** | Docker deploy |
| Postgres | **Neon** | Serverless Postgres; copy the pooled URL |
| Redis | **Upstash** | Serverless Redis (BullMQ + AI cache) |
| Vectors | **Pinecone** | Create an index matching `PINECONE_INDEX` |
| Files | **Cloudinary** | Set `STORAGE_DRIVER=cloudinary` + `CLOUDINARY_URL` |

## Order of operations
1. **Provision data services** — Neon (Postgres), Upstash (Redis), Pinecone
   (index), Cloudinary. Collect their connection strings/keys.
2. **Deploy the AI service** (Render, Docker = `services/ai-service/Dockerfile`).
   Env: `OPENAI_API_KEY`, `PINECONE_API_KEY`, `PINECONE_INDEX`, `AI_REDIS_URL`,
   `SERVICE_API_KEY`. Note its public URL.
3. **Deploy the API** (Render, Docker = `apps/api/Dockerfile`). Env: `DATABASE_URL`
   (Neon), `REDIS_URL` (Upstash), `AI_SERVICE_URL` (from step 2), `AI_SERVICE_KEY`,
   `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `STORAGE_DRIVER=cloudinary`,
   `CLOUDINARY_URL`, `CORS_ORIGINS` (your web URL). Migrations run automatically
   on boot (`prisma migrate deploy`). Then run the seed once for base roles.
4. **Deploy the web app** (Vercel, root `apps/web`). Env: `NEXT_PUBLIC_API_URL`
   (your API URL). Redeploy after changing it — it's inlined at build time.

## Environment variables (reference)
See each service's `.env.example`:
- `apps/api/.env.example`
- `services/ai-service/.env.example`
- `apps/web/.env.example`

## Production checklist
- [ ] Strong, unique `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (32+ chars)
- [ ] `SERVICE_API_KEY` set on **both** API and AI service (identical)
- [ ] `CORS_ORIGINS` restricted to your web origin
- [ ] `STORAGE_DRIVER=cloudinary` (local disk won't persist on ephemeral hosts)
- [ ] Pinecone index dimension matches the embedding model
      (`text-embedding-3-large` → 3072)
- [ ] Seed roles once: `npm run db:seed`
- [ ] CI green (see `.github/workflows/ci.yml`)
