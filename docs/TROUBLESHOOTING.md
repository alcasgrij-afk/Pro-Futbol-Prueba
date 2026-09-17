# Troubleshooting Guide — Profutbol Antigua

## Startup Issues

### "Error inesperado" on login

**Root Cause:** The API is not fully initialized when you try to log in. This usually means:
1. Redis or PostgreSQL containers aren't healthy yet
2. The NestJS API started before the database was ready
3. Port conflicts prevented services from binding correctly

**Solution:**
```bash
# Stop everything cleanly
npm run stop
taskkill //F //IM node.exe  # Windows: kill all Node processes
pkill -f node               # macOS/Linux: kill all Node processes

# Restart with proper orchestration
npm run startup
npm run dev
```

**What `npm run startup` does to prevent this:**
- ✅ Checks ports 3000/3001 are free (kills conflicts if found)
- ✅ Starts Docker containers and waits for health checks
- ✅ Waits 2 extra seconds for full initialization
- ✅ Runs Prisma migrations
- ✅ Seeds the database
- ✅ Verifies all services are healthy before returning

### Port 3000 or 3001 already in use

**Symptom:**
```
Port 3000 is in use by an unknown process, using available port 3001 instead.
```

**Root Cause:** A previous `npm run dev` wasn't cleanly killed, leaving orphaned processes.

**Solution:**
```bash
# Windows
netstat -ano | findstr ":3000"
netstat -ano | findstr ":3001"
taskkill //F //PID <PID>

# macOS/Linux
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

Or use the startup script which checks this automatically:
```bash
npm run startup  # Will detect port conflicts and guide you
```

### PostgreSQL or Redis not responding

**Symptom:**
```
ECONNREFUSED ::1:5432
ECONNREFUSED 127.0.0.1:6379
```

**Root Cause:** Docker containers didn't start or aren't healthy yet.

**Solution:**
```bash
# Check container status
docker ps

# If containers aren't running
docker compose up -d

# If containers are running but not healthy
docker compose restart postgres redis

# Wait for health
docker compose exec postgres pg_isready -U profutbol
docker compose exec redis redis-cli ping
```

### `.next` poisoning error

**Symptom:**
```
Error: Cannot find module './383.js'
Require stack: ...
```

**Root Cause:** You ran `npm run build` while `npm run dev` was running. Both share `apps/web/.next` and the build corrupted the dev cache.

**Solution:**
```bash
# Kill dev server
# (Press Ctrl+C or use Task Manager on Windows)

# Clean the poisoned .next directory
rm -rf apps/web/.next

# Restart dev
npm run dev
```

**Prevention:** The root `package.json` already has a guard (`check:no-dev`) that prevents `npm run build` when dev is running. Don't skip it with `--ignore-scripts`.

### Database migrations fail

**Symptom:**
```
P3009: migrate found failed migration
```

**Root Cause:** A previous migration was interrupted.

**Solution:**
```bash
# Mark failed migration as rolled back
cd apps/api
npx prisma migrate resolve --rolled-back <migration-name>

# Re-run migrations
npm run prisma:migrate -- --name retry
```

### Seed script fails: "Unique constraint failed"

**Root Cause:** Database already has seed data.

**Solution:**
This is **not an error** — the seed script is idempotent. If the admin user and canchas already exist, the script skips them. You can safely ignore this.

To truly reset:
```bash
docker compose down -v  # WARNING: deletes ALL data
npm run setup
```

## Development Issues

### Hot reload not working

**Symptom:** Changes to files don't trigger a rebuild.

**Solution:**
- **API (NestJS):** Restart `npm run dev:api`
- **Web (Next.js):** Check the terminal for TypeScript errors that broke the build

### TypeScript errors but build succeeds

**Symptom:** `tsc --noEmit` shows errors but `next build` works.

**Root Cause:** Next.js ignores some TypeScript strictness for speed.

**Solution:** Fix the `tsc --noEmit` errors — they'll bite you in production or when a coworker pulls.

### API responds 404 for a valid route

**Symptom:** `curl http://localhost:3001/api/health` returns 404.

**Root Cause:** The NestJS API binds to `/` (root path), not `/api`.

**Solution:**
```bash
curl http://localhost:3001/health        # Correct
curl http://localhost:3001/api/health    # Wrong (adds /api prefix)
```

Check the terminal logs for `[RouterExplorer] Mapped {/health, GET} route` to confirm.

### "Session store down" error in chat

**Root Cause:** Redis isn't running or the API can't connect to it.

**Solution:**
```bash
docker compose exec redis redis-cli ping
# Should return: PONG

# If not, restart Redis
docker compose restart redis
```

## Production Deployment Issues

### Prisma client not generated

**Symptom:**
```
Error: Cannot find module '@prisma/client'
```

**Root Cause:** Fresh clone or production build didn't run `prisma generate`.

**Solution:**
Add to `package.json` (apps/api):
```json
{
  "scripts": {
    "postinstall": "prisma generate"
  }
}
```

### JWT "invalid signature" after restart

**Root Cause:** `JWT_ACCESS_SECRET` changed (or defaulted to a placeholder).

**Solution:**
- Generate stable secrets: `openssl rand -base64 48`
- Set them in `apps/api/.env` **before** the first deployment
- **Never** change them in production (invalidates all sessions)

### Payment redirect fails

**Symptom:** User completes payment but gets stuck on payment gateway page.

**Root Cause:** `PAYMENT_RETURN_URL` is not set or points to `localhost`.

**Solution:**
Set in `apps/api/.env`:
```bash
PAYMENT_RETURN_URL=https://yourdomain.com/pago/resultado
```

## How to Get Help

1. **Check the logs:**
   ```bash
   # API logs (NestJS)
   docker compose logs api -f
   
   # Web logs (Next.js)
   # Look at the terminal where `npm run dev:web` is running
   ```

2. **Verify all services are healthy:**
   ```bash
   npm run startup:verify
   ```

3. **Check environment variables:**
   ```bash
   cat apps/api/.env | grep -v PASSWORD
   ```

4. **Run the test suite:**
   ```bash
   npm run test
   ```
   If tests pass but dev fails, it's an environment issue (Docker, ports, env vars).

5. **Still stuck?** Open an issue with:
   - The exact error message
   - Output of `npm run startup:verify`
   - Output of `docker ps`
   - Your OS and Node version (`node -v`)
