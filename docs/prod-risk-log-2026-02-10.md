# Prod Risk Log (2026-02-10)

## Context
This note captures known production risks introduced/observed during the latest refactor and hardening pass.
Status: postponed for follow-up.

## Risks

1. Shared-IP auth throttling risk (`/api/v2/auth`)
- Current limiter key is based on `req.ip`.
- Limit is `20 requests / minute` per key.
- If app is behind reverse proxy/LB and `trust proxy` is not configured correctly, multiple users may collapse into one IP key.
- Failure mode: legitimate users get HTTP `429` on auth under moderate peak.
- Can manifest as early as ~21 auth requests/min total from a shared proxy IP.

2. In-memory limiter map growth
- Limiter buckets are stored in process memory (`Map`).
- No explicit TTL sweep/cleanup for expired keys.
- With many unique keys over uptime, memory usage may grow and increase GC pressure.

3. Partial integration confidence in sandbox
- HTTP integration tests were added, but in current sandbox they are skipped when socket listen is blocked (`EPERM`).
- Unit and route-level tests pass, but full network path is not fully validated in this environment.

## Follow-up plan (when resumed)

1. Add safe proxy handling
- Configure `app.set('trust proxy', ...)` via env.
- Validate real client IP extraction in production logs.

2. Make rate limits configurable
- Move window/limits to env vars with conservative defaults.
- Allow quick rollback/tuning without code changes.

3. Add limiter bucket cleanup
- Periodic sweep of expired entries (or lazy cleanup strategy).
- Add test(s) verifying cleanup behavior.

4. Production rollout safety
- Canary rollout.
- Monitor auth/add `429` rates, p95 latency, memory footprint for first hours.

## Owner note
Do not remove this file until all items above are closed and verified in production.
