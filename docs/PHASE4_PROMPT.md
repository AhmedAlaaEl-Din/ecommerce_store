# Unattended task: E-commerce store, Phase 4 (Postgres, Docker, nginx, Linux-ready)

You are working alone while I am away. Work in E:\ecommerce_store on my personal Windows 11 laptop. Make decisions yourself using the rules below. Do not ask questions; log blockers in docs/PHASE4_REPORT.md under "Blocked" and continue. The only reasons to stop are in section 0.4 and section 1.

First, copy this file to docs/PHASE4_PROMPT.md and commit it.

## 0. Session discipline (read first, every session)

### 0.1 Resume
If docs/NEXT_SESSION.md exists: read it, then docs/PROGRESS_PHASE4.md, check `git status` and `git log --oneline -5`, and continue from the first unticked item. Otherwise create docs/PROGRESS_PHASE4.md from section 11.

### 0.2 Continuous handoff (so a usage-limit cut-off loses nothing)
After EVERY checklist item: tick it, make a short local commit, and OVERWRITE docs/NEXT_SESSION.md (max 40 lines) with: items done, next item, the exact first command to run, decisions made, gotchas, files to read first, anything Blocked. Commit it together with the item.

### 0.3 Token rules (save usage without lowering quality)
1. Quiet output: send long output to var/logs/<name>.log (git-ignored) and show only the last 15 lines, or the failing lines (`grep -n -B2 -A8 "FAIL\|Error"`). Never print full test, build, install or Docker build logs.
2. Search before reading: use grep or ls to locate, read line ranges, never re-read a file you already read in this session, and use `git diff --stat` instead of full diffs.
3. Run targeted tests per item. Run the full `npm run verify` only at items marked ★ and at the end.
4. Use subagents only for the review in section 10, with a narrow brief and a reply limit of 40 lines, saved to docs/reviews/.
5. Look at screenshots only when a task needs it, at most 10 images per round.
6. No extra features, no refactors outside this scope, short commit messages, short notes.
7. Never skip a required test, check or review to save tokens. If saving tokens would reduce correctness, stop and hand off (0.4) instead.

### 0.4 Stop and hand off
Stop working, and tell me to start a fresh session, when ANY of these is true:
- you finished 7 checklist items in this session;
- you have made about 120 tool calls in this session, or you feel the conversation is getting long;
- you see a "context nearly full", compaction or usage-limit notice;
- the same problem failed twice (log it under Blocked, move to the next item, or stop if nothing else can proceed).

Before stopping: make sure NEXT_SESSION.md is current and committed. Then print exactly this as your last output:

`SESSION LIMIT: I stopped on purpose to save usage. Nothing is lost. Open a new terminal in E:\ecommerce_store, run claude, and paste: Continue Phase 4: read docs/NEXT_SESSION.md and docs/PHASE4_PROMPT.md, then resume.`

When everything is finished, print `PHASE 4 DONE` instead.

## 1. Preflight (cheap, do first)
- Run `docker --version`, `docker compose version` and `docker info`.
- If Docker is missing or the engine is not running: write docs/HOW_TO_INSTALL_DOCKER.md (Docker Desktop with the WSL 2 backend on Windows 11, one action per step, with what I should see), write NEXT_SESSION.md saying "install Docker, then re-run", print `DOCKER MISSING`, and STOP. Do not do work you cannot test.
- Check whether phase-3 is merged: `git merge-base --is-ancestor phase-3 main`. If yes, create `phase-4` from `main`. If not, create it from `phase-3`.

## 2. Hard rules
1. Never git push, merge, rebase, add remotes or create PRs. Local commits on `phase-4` only.
2. Everything stays on this laptop. Never use ssh, scp, sftp or rsync. No remote Docker contexts, no `docker login`, no `docker push`. The only network use allowed is pulling official public base images (node, postgres, nginx) and npm packages at build time. No real server, domain or IP anywhere; use `shop.example.com` and `192.0.2.10` placeholders.
3. Never print the contents of .env, .env.stack, .env.production or credentials files. Generate secrets with openssl or node into git-ignored files and never echo them.
4. Publish ports on 127.0.0.1 only. Postgres is never published to the host in the production-like stack. No port-forwarding, tunnels, `--privileged`, host networking, or docker.sock mounts.
5. Do not touch other Docker containers, images or volumes on my machine. Use the compose project name `nilegoods`, clean up only with `docker compose -p nilegoods down`, and never run any prune command.
6. Demo data only. No live Stripe calls: keep the mock provider, and keep refusing live keys.
7. No secrets in git. No Valeo material anywhere.
8. Use the latest stable or LTS versions at install time and pin images by an explicit tag, never `latest`. Do not pin from memory. Record all versions in the report.
9. Phases 1 to 3 behaviour and tests must keep passing. Adapt tests where needed and never skip them.

## 3. Postgres everywhere
- Switch Prisma to PostgreSQL for dev, test and production, using the setup recommended for the installed Prisma version (use a driver adapter if required). Remove the SQLite packages and files.
- All data is demo data, so reset prisma/migrations to ONE fresh Postgres baseline migration and note that in the report. Keep `db:seed` and `db:seed:history` idempotent.
- Fix every SQLite-specific behaviour: case-insensitive search, sorting and collation, raw SQL, dates and counters.
- Add the indexes the real queries need (orders by status and createdAt, products by slug, category and isActive, stock movements by product, audit log by createdAt, sessions by expiry) and a DB CHECK constraint `stock >= 0`. List them in the report with one line of reasoning each.
- Re-run the "two buyers, last item" race test against Postgres with real concurrent connections. Exactly one must win and stock must never go negative.
- `compose.dev.yml` runs Postgres only, published on 127.0.0.1:5432 (dev only). Tests use a separate database `nilegoods_test` that is created automatically. Short aliases: `npm run db:up` and `npm run db:down`. `npm run verify` must work from a clean checkout after `npm run db:up`.

## 4. Container images
- Multi-stage Dockerfile: deps, build (Next standalone output), runtime. Use Debian-slim Node LTS (not Alpine, to avoid native-module trouble with argon2 and sharp). Run as a non-root user, use an init process, include a HEALTHCHECK, copy no .env files, and keep dev dependencies out. Write a strict .dockerignore.
- One image, three commands: `web` (default), `migrate` (one-shot `prisma migrate deploy`) and `worker`. The worker loops: every 5 minutes it releases expired reservations (the `orders:expire` logic), and daily it prunes idle carts and expired admin sessions. The interval is configurable by env var for tests.
- Endpoints: `/api/health` (liveness, no DB) and `/api/ready` (checks the DB). Neither exposes versions, paths or secrets.
- Add `.gitattributes` so shell scripts, the Dockerfile and nginx configs are checked out with LF line endings (this is a Windows trap).
- Trusted proxy: add a `TRUST_PROXY` env var. Only when it is true may the app use `X-Real-IP` and `X-Forwarded-For`, and only from nginx. The rate limiter, login lockout and audit log must use the real client IP through this path. A spoofed header from outside must be ignored. Add tests.

## 5. Compose stack (production-like, local)
`compose.yml`, project `nilegoods`:
- **db:** Postgres on an internal network only, with a named volume, a healthcheck, and the password from the env file.
- **migrate:** one-shot, waits for the healthy db.
- **web:** waits for migrate to complete.
- **worker:** same image.
- **nginx:** the only service with published ports, 127.0.0.1:8080 (redirects to HTTPS) and 127.0.0.1:8443. Use an unprivileged nginx image with high ports inside the container.

Hardening on web, worker and nginx: `read_only: true` with tmpfs for /tmp and the needed cache dirs, `cap_drop: [ALL]`, `no-new-privileges`, memory and CPU limits, `restart: unless-stopped`, json-file log rotation (10m x 3), and separate frontend and backend networks.

Volumes: `pgdata`, `uploads` (web writes, nginx reads read-only) and `outbox` (the email files).

Env: `.env.production.example` is committed with placeholders only and every variable documented. `npm run stack:init` creates the git-ignored `.env.stack` with random secrets, a self-signed certificate for `localhost` in deploy/certs/ (git-ignored), and a demo admin whose password goes only into var/stack-credentials.txt. Short aliases: `stack:init`, `stack:up`, `stack:down`, `stack:test`, `stack:backup`, `stack:restore`.

## 6. nginx
- HTTP to HTTPS redirect, HTTP/2, TLS 1.2+ with modern ciphers (state the guideline you followed in a comment), `server_tokens off`, and HSTS on the HTTPS server only (6 months, no preload).
- Keep ONE source for the CSP and the other security headers: the app. nginx adds only HSTS, so no header appears twice.
- Proxy to web with Host, X-Real-IP, X-Forwarded-For (set by nginx, never appended from the client) and X-Forwarded-Proto. Use sensible timeouts and buffers.
- `limit_req` with status 429:
  - strict on admin login POSTs;
  - moderate on checkout and `/api/webhooks/`;
  - a generous general burst limit;
  - a per-IP connection limit.
- `client_max_body_size` 6m only on the upload route and 1m elsewhere.
- Static files: long immutable caching for `/_next/static/`. Serve `/uploads/` directly from the shared volume (`autoindex off`, `nosniff`), and check that newly uploaded images work. Never cache HTML for /admin, /cart, /checkout or /order.
- gzip for text types, block dotfiles, return 404 for `/dev/`, and add styled static error pages for 502, 503 and 504.
- Add a commented, documented option to protect /admin with HTTP basic auth or an IP allow-list.
- Provide a production template in deploy/nginx/ using Let's Encrypt paths. It is documented only, never executed.

## 7. Stack tests: `npm run stack:test`
Bring the stack up from scratch, wait until healthy, then run a smoke suite (Playwright, ignoring the self-signed certificate), then run `docker compose -p nilegoods down`. A `--clean` flag also removes the volumes.
1. HTTPS loads, HTTP redirects, HSTS is present, there is no version leak in `Server`, and each security header appears exactly once.
2. A full mock purchase works: the order is paid, stock is reduced, and the email file is written to the outbox volume.
3. Admin login works. 30 rapid bad logins get 429 from nginx, and the app account lockout still works. A spoofed X-Forwarded-For is ignored.
4. An admin image upload is served at /uploads/... by nginx (200, correct type, nosniff) and shows in the storefront. It survives `docker compose restart web`, and data survives `down` then `up`.
5. Postgres is unreachable from the host, and only nginx's two ports on 127.0.0.1 are published.
6. Containers run as non-root with a read-only root filesystem, and their healthchecks pass. If `web` is killed it restarts and nginx recovers, and while it is down nginx shows the styled error page.
7. The worker releases an expired reservation within the test interval.
8. Backup and restore (section 8).
Add `npm run verify:all` (verify plus stack:test) and keep `verify` fast.

## 8. Backups and operations
- `scripts/backup.sh`: pg_dump in custom format through `docker compose exec`, timestamped, keeping the last 14. It also saves the uploads volume as a tar. `scripts/restore.sh <file>` restores only when called with an explicit `--yes`. Scripts must be safe against bad input (quote everything, no `eval`).
- Test it: seed the history, back up, delete rows, restore, and check that the counts match.
- docs/OPERATIONS.md: updating and rolling back (tag images with the git SHA, roll back to the previous tag with `up -d --no-build`, migrations only go forward, so back up before each deploy), reading logs, rotating secrets and the admin password, creating an admin (`admin:create` through exec), volume maintenance, and a restore drill.

## 9. CI (runs on GitHub after I push; you cannot run it)
`.github/workflows/ci.yml` on push and pull request: install, lint, typecheck, unit and integration tests against a Postgres service container, build, and `docker build` (no push). Use `permissions: contents: read`, no secrets, and the current major versions of official actions (check them). Validate the YAML by parsing it locally. E2E stays out of CI for now (say so in the README).

## 10. Performance and security re-check
- Run Lighthouse (mobile, default preset) against the nginx stack for home, catalog and product, 3 runs each in one go. Compare with Phase 2 (82 / 81 / 79) and report honestly, including the laptop CPU state. The target stays 90 or higher, but do not chase it beyond reason.
- If an image scanner (trivy or docker scout) is already installed, run it. Do not install one. Otherwise write "not scanned".
- **Security review subagent (checkpoint):** "Review the Dockerfile, compose files, nginx config, deploy scripts, env handling, trusted-proxy logic, rate limits and the CI workflow for: secrets in images or git, privilege (root, capabilities, writable FS, mounts), exposed ports, duplicated or missing headers, spoofable client IP, upload serving risks (content type, path traversal), unsafe defaults, and backup script safety (command injection, file permissions). Max 40 lines: file, line, fix. Do not edit files." Fix the valid findings and report what was fixed and what was rejected, with reasons.

## 11. Work order (copy into docs/PROGRESS_PHASE4.md; ★ = run full `npm run verify`)
- [ ] 1. Preflight, branch, copy this prompt to docs/
- [ ] 2. Postgres: dev compose, schema, baseline migration, adapter, seeds
- [ ] 3. Fix SQLite-isms, indexes, CHECK constraint; tests green on Postgres including the race ★
- [ ] 4. Health endpoints, trusted-proxy logic and tests
- [ ] 5. Dockerfile, .dockerignore, .gitattributes, worker loop
- [ ] 6. compose.yml, env example, stack:init, local TLS certificate
- [ ] 7. nginx config, error pages, `nginx -t`
- [ ] 8. Stack smoke suite, tests 1 to 6 (first full stack run)
- [ ] 9. Worker, uploads and outbox volumes, remaining stack tests ★
- [ ] 10. Backup and restore scripts plus test
- [ ] 11. CI workflow and YAML check
- [ ] 12. CHECKPOINT: security review subagent, then fixes ★
- [ ] 13. Lighthouse on the stack
- [ ] 14. Docs: ARCHITECTURE.md (Mermaid diagram), DEPLOY_LINUX.md, OPERATIONS.md, README update
- [ ] 15. HOW_TO_TEST_PHASE4.md and PHASE4_REPORT.md
- [ ] 16. Demo frames (section 12)
- [ ] 17. Privacy check and final `npm run verify:all`

## 12. Demo frames (do this only if the session budget allows; otherwise list it as pending in NEXT_SESSION.md)
No terminal screenshots (they leak paths). Render "cards" as local HTML pages and screenshot them with Playwright, desktop 1280x720, about 20 frames: an architecture diagram (from ARCHITECTURE.md), the store running over HTTPS on the local stack (page only), a security-headers card, a stack-test results card, a backup and restore result card, a Lighthouse before and after card, and a "what's next" card. Write evidence/phase4/storyboard.json in the same format as before, with captions and durations. Copy evidence/phase4 to **E:\handoff\ecommerce_phase1\phase4_evidence\**.

## 13. Docs
- **docs/HOW_TO_TEST_PHASE4.md:** in plain words, with Git Bash commands, one action per step, and what I should see. Use ONLY the short `npm run` aliases (long pasted commands get garbled on my phone terminal). Order: Docker running, `db:up`, `verify`, `stack:init`, `stack:up`, open https://localhost:8443 (explain why the certificate warning is expected locally), buy something, admin login (password from var/stack-credentials.txt), upload an image, `stack:backup`, `stack:restore` drill, `stack:test`, `stack:down`. Add a troubleshooting table (port in use, Docker not running, WSL memory, line endings). End with the git commands to push `phase-4` and merge it into `main` with `--no-edit`.
- **docs/DEPLOY_LINUX.md:** generic steps for a small Ubuntu LTS VPS, for me to do later with a domain, all marked "not executed in Phase 4". Cover a non-root user, SSH keys only, firewall (22, 80, 443), automatic security updates, installing Docker from the official repository, cloning, creating .env.production, bringing the stack up, Let's Encrypt with the nginx template, a cron job for backups, off-server backup advice, and basic uptime monitoring.
- **docs/PHASE4_REPORT.md:** summary, versions, results with counts, the stack test results, the review findings and fixes, Lighthouse before and after, image sizes, known issues, Blocked, a privacy grep (no secrets, real emails, real domains or IPs, or Windows user paths in the repo or frames; show the commands and results), and the commit list.

Stop when every item is ticked and committed on `phase-4`, then print `PHASE 4 DONE`. Do not push.
