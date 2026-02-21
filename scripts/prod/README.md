# Production bootstrap

Run as a normal sudo user on the VPS:

```bash
bash scripts/prod/setup-production.sh
```

What it automates:
- system update + required package installation
- Docker + compose plugin install
- PostgreSQL + Redis install/config (localhost-only)
- SSH hardening (`PermitRootLogin no`, `AllowUsers clerk`)
- UFW + fail2ban + unattended upgrades + AppArmor + auditd
- `.env` production values for `paayonepal.com`
- `docker compose --profile prod build` + `up -d`
- drizzle schema pull (`bun run db:pull`) from current DB
- cron-based monitoring:
  - resource alerts every 5 minutes
  - weekly security report
  - weekly maintenance upgrades
  - monthly logs report + cleanup

Optional SMTP relay envs for reliable outbound alerts:
- `SMTP_HOST`
- `SMTP_PORT` (default `587`)
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM` (default `ALERT_EMAIL`)

Default requested credentials are embedded as script defaults:
- DB user/password: `tourism` / `tourism>_@#12`
- Redis password: `redis>_@#12`
- App user/password: `clerk` / `clerk>_@#12`
- Alert email: `info@paayonepal.com`

Override any default at runtime:

```bash
APP_DOMAIN=paayonepal.com ALERT_EMAIL=info@paayonepal.com bash scripts/prod/setup-production.sh
```

If you already created the deploy user manually and want to skip user/password
management in the script:

```bash
MANAGE_APP_USER=false bash scripts/prod/setup-production.sh
```

In this mode, the script still hardens SSH and sets:
- `PermitRootLogin no`
- `AllowUsers <current shell user>`
