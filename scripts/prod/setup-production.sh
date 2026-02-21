#!/usr/bin/env bash
set -Eeuo pipefail

###############################################################################
# Paayo Nepal - production bootstrap + deploy
#
# Run as a NORMAL user with sudo privileges:
#   bash scripts/prod/setup-production.sh
#
# What it does:
# 1) apt update/upgrade + installs required tools
# 2) creates/clamps SSH access to APP_USER (default: clerk)
# 3) hardens SSH, UFW, fail2ban, unattended upgrades, AppArmor, auditd
# 4) installs/configures PostgreSQL + Redis (localhost-only)
# 5) writes/updates .env with production values
# 6) builds and starts docker compose prod stack
# 7) runs drizzle schema pull in an ephemeral Bun container
# 8) installs resource/security/monthly log cron jobs with email alerts
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE="${ENV_FILE:-${REPO_ROOT}/.env}"

# Load .env safely (without shell execution). Supports KEY=value and
# single/double-quoted values.
safe_load_env_file() {
  local env_file="$1"
  [[ -f "${env_file}" ]] || return 0

  while IFS= read -r line || [[ -n "${line}" ]]; do
    line="${line%$'\r'}"
    [[ -z "${line}" ]] && continue
    [[ "${line}" =~ ^[[:space:]]*# ]] && continue

    if [[ "${line}" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      local key="${BASH_REMATCH[1]}"
      local value="${BASH_REMATCH[2]}"

      # Trim leading spaces in value.
      value="${value#"${value%%[![:space:]]*}"}"

      # Remove wrapping quotes if present.
      if [[ "${value}" =~ ^\"(.*)\"$ ]]; then
        value="${BASH_REMATCH[1]}"
      elif [[ "${value}" =~ ^\'(.*)\'$ ]]; then
        value="${BASH_REMATCH[1]}"
      fi

      export "${key}=${value}"
    fi
  done < "${env_file}"
}

safe_load_env_file "${ENV_FILE}"

# User/domain settings (sensitive vars must be provided via env/.env)
#
# Always use the invoking shell user (ignore APP_USER from env/.env).
# This script must be run as a normal sudo user, not root.
APP_USER="$(id -un)"
APP_USER_PASSWORD="${APP_USER_PASSWORD:-}"
# When true (default), script creates/updates APP_USER and password.
# Set to "false" to skip user management and only harden SSH for APP_USER.
MANAGE_APP_USER="${MANAGE_APP_USER:-true}"
APP_DOMAIN="${APP_DOMAIN:-}"
ALERT_EMAIL="${ALERT_EMAIL:-}"

# App credentials (sensitive vars must be provided via env/.env)
DATABASE_NAME="${DATABASE_NAME:-tourism}"
DATABASE_USER="${DATABASE_USER:-tourism}"
DATABASE_PASSWORD="${DATABASE_PASSWORD:-}"
DATABASE_MAX_CONNECTIONS="${DATABASE_MAX_CONNECTIONS:-20}"
DATABASE_MIN_CONNECTIONS="${DATABASE_MIN_CONNECTIONS:-5}"

REDIS_PASSWORD="${REDIS_PASSWORD:-}"

# Media storage (local filesystem or S3-compatible object storage)
MEDIA_STORAGE="${MEDIA_STORAGE:-local}"
S3_BUCKET="${S3_BUCKET:-}"
S3_REGION="${S3_REGION:-us-east-1}"
S3_ENDPOINT="${S3_ENDPOINT:-}"
S3_PUBLIC_BASE_URL="${S3_PUBLIC_BASE_URL:-}"
S3_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID:-}"
S3_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY:-}"
S3_SESSION_TOKEN="${S3_SESSION_TOKEN:-}"
S3_FORCE_PATH_STYLE="${S3_FORCE_PATH_STYLE:-false}"
S3_KEY_PREFIX="${S3_KEY_PREFIX:-uploads}"

# Compatibility vars requested by user (not used by stack)
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-}"
MYSQL_EXPOSE_PORT="${MYSQL_EXPOSE_PORT:-127.0.0.1:3306}"

# Optional SMTP relay (recommended for reliable alerts)
SMTP_HOST="${SMTP_HOST:-}"
SMTP_PORT="${SMTP_PORT:-587}"
SMTP_USER="${SMTP_USER:-}"
SMTP_PASS="${SMTP_PASS:-${SMTP_PASSWORD:-}}"
SMTP_FROM="${SMTP_FROM:-${ALERT_EMAIL}}"
SMTP_REPLY_TO="${SMTP_REPLY_TO:-${ALERT_EMAIL}}"
SMTP_TLS="${SMTP_TLS:-on}"
SMTP_STARTTLS="${SMTP_STARTTLS:-on}"

if [[ "${SMTP_HOST,,}" == "google.com" ]]; then
  printf "[%s] WARN: %s\n" "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
    "SMTP_HOST=google.com is not a valid Gmail SMTP relay endpoint. Using smtp.gmail.com." >&2
  SMTP_HOST="smtp.gmail.com"
fi

CPU_THRESHOLD="${ALERT_CPU_THRESHOLD:-90}"
MEM_THRESHOLD="${ALERT_MEM_THRESHOLD:-90}"
DISK_THRESHOLD="${ALERT_DISK_THRESHOLD:-90}"

COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-tourism}"
export COMPOSE_PROJECT_NAME

require_env_var() {
  local var_name="$1"
  local val="${!var_name:-}"
  if [[ -z "${val}" ]]; then
    die "Missing required env var: ${var_name}. Set it in ${ENV_FILE} or export it before running."
  fi
}

validate_required_env() {
  if [[ "${MANAGE_APP_USER,,}" != "false" ]]; then
    require_env_var "APP_USER_PASSWORD"
  fi
  require_env_var "APP_DOMAIN"
  require_env_var "ALERT_EMAIL"
  require_env_var "DATABASE_PASSWORD"
  require_env_var "REDIS_PASSWORD"

  if [[ "${MEDIA_STORAGE,,}" == "s3" ]]; then
    require_env_var "S3_BUCKET"
    require_env_var "S3_ACCESS_KEY_ID"
    require_env_var "S3_SECRET_ACCESS_KEY"
  fi
}

log() {
  printf "[%s] %s\n" "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"
}

warn() {
  printf "[%s] WARN: %s\n" "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*" >&2
}

die() {
  printf "[%s] ERROR: %s\n" "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*" >&2
  exit 1
}

require_non_root_with_sudo() {
  [[ "${EUID}" -ne 0 ]] || die "Run this script as a normal user, not root."
  sudo -v
  # keep sudo ticket alive during long operations
  ( while true; do sudo -n true; sleep 45; done ) &
  SUDO_KEEPALIVE_PID=$!
  trap 'kill "${SUDO_KEEPALIVE_PID}" >/dev/null 2>&1 || true' EXIT
}

urlencode() {
  python3 - <<'PY' "$1"
import sys, urllib.parse
print(urllib.parse.quote(sys.argv[1], safe=''))
PY
}

ensure_file_exists() {
  local file="$1"
  if [[ ! -f "${file}" ]]; then
    if [[ -f "${REPO_ROOT}/.env.example" ]]; then
      cp "${REPO_ROOT}/.env.example" "${file}"
    else
      : > "${file}"
    fi
  fi
}

set_env_var() {
  local key="$1"
  local value="$2"
  local escaped
  escaped="$(printf "%s" "${value}" | sed "s/'/'\"'\"'/g")"

  if grep -qE "^${key}=" "${ENV_FILE}"; then
    sed -i "s|^${key}=.*|${key}='${escaped}'|g" "${ENV_FILE}"
  else
    printf "%s='%s'\n" "${key}" "${escaped}" >> "${ENV_FILE}"
  fi
}

install_required_tools() {
  log "Updating apt index and upgrading packages..."
  sudo apt-get update -y
  sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y

  log "Installing required system packages..."
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    ca-certificates curl gnupg lsb-release jq unzip \
    ufw fail2ban unattended-upgrades apt-listchanges \
    apparmor apparmor-utils auditd rsyslog cron logrotate \
    openssl \
    postgresql postgresql-contrib redis-server \
    mailutils msmtp msmtp-mta bsd-mailx \
    sysstat htop net-tools

  if ! command -v docker >/dev/null 2>&1; then
    log "Installing Docker..."
    curl -fsSL https://get.docker.com | sudo sh
  fi
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y docker-compose-plugin || true
  sudo systemctl enable --now docker
  sudo usermod -aG docker "${USER}" || true
}

configure_postgres() {
  log "Configuring PostgreSQL (localhost only)..."
  local pg_conf
  local hba_conf
  pg_conf="$(sudo -u postgres psql -tAc 'SHOW config_file;' | xargs)"
  hba_conf="$(sudo -u postgres psql -tAc 'SHOW hba_file;' | xargs)"

  sudo sed -ri "s/^#?\s*listen_addresses\s*=.*/listen_addresses = '127.0.0.1'/" "${pg_conf}"

  if ! grep -q "host all all 127.0.0.1/32 scram-sha-256" "${hba_conf}"; then
    echo "host all all 127.0.0.1/32 scram-sha-256" | sudo tee -a "${hba_conf}" >/dev/null
  fi

  local db_pass_sql
  db_pass_sql="${DATABASE_PASSWORD//\'/\'\'}"

  sudo -u postgres psql <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${DATABASE_USER}') THEN
    EXECUTE 'CREATE ROLE ${DATABASE_USER} LOGIN PASSWORD ''${db_pass_sql}''';
  ELSE
    EXECUTE 'ALTER ROLE ${DATABASE_USER} WITH LOGIN PASSWORD ''${db_pass_sql}''';
  END IF;
END
\$\$;

DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '${DATABASE_NAME}') THEN
    EXECUTE 'CREATE DATABASE ${DATABASE_NAME} OWNER ${DATABASE_USER}';
  END IF;
END
\$\$;
SQL

  sudo systemctl enable --now postgresql
  sudo systemctl restart postgresql
}

configure_redis() {
  log "Configuring Redis (localhost only + requirepass)..."
  local redis_conf="/etc/redis/redis.conf"
  local redis_escaped
  redis_escaped="$(printf "%s" "${REDIS_PASSWORD}" | sed -e 's/[\\/&]/\\&/g')"

  sudo sed -ri "s/^#?\s*bind\s+.*/bind 127.0.0.1 ::1/" "${redis_conf}"
  sudo sed -ri "s/^#?\s*protected-mode\s+.*/protected-mode yes/" "${redis_conf}"
  if grep -qE "^#?\s*requirepass\s+" "${redis_conf}"; then
    sudo sed -ri "s|^#?\s*requirepass\s+.*|requirepass ${redis_escaped}|" "${redis_conf}"
  else
    echo "requirepass ${REDIS_PASSWORD}" | sudo tee -a "${redis_conf}" >/dev/null
  fi

  sudo systemctl enable --now redis-server
  sudo systemctl restart redis-server
}

configure_user_and_ssh() {
  if [[ "${MANAGE_APP_USER,,}" != "false" ]]; then
    log "Creating/updating '${APP_USER}' user and hardening SSH..."

    if ! id -u "${APP_USER}" >/dev/null 2>&1; then
      sudo useradd -m -s /bin/bash "${APP_USER}"
    fi

    echo "${APP_USER}:${APP_USER_PASSWORD}" | sudo chpasswd
    sudo usermod -aG sudo,docker "${APP_USER}" || true

    if [[ -f "${HOME}/.ssh/authorized_keys" ]]; then
      sudo mkdir -p "/home/${APP_USER}/.ssh"
      sudo cp "${HOME}/.ssh/authorized_keys" "/home/${APP_USER}/.ssh/authorized_keys"
      sudo chown -R "${APP_USER}:${APP_USER}" "/home/${APP_USER}/.ssh"
      sudo chmod 700 "/home/${APP_USER}/.ssh"
      sudo chmod 600 "/home/${APP_USER}/.ssh/authorized_keys"
    fi
  else
    log "Skipping user creation/update (MANAGE_APP_USER=false). Hardening SSH for existing user '${APP_USER}'..."
    id -u "${APP_USER}" >/dev/null 2>&1 || die "APP_USER '${APP_USER}' does not exist."
  fi

  local sshd="/etc/ssh/sshd_config"
  sudo cp "${sshd}" "${sshd}.bak.$(date +%s)"

  set_sshd_option "${sshd}" "PermitRootLogin" "no"
  set_sshd_option "${sshd}" "PasswordAuthentication" "yes"
  set_sshd_option "${sshd}" "PubkeyAuthentication" "yes"
  set_sshd_option "${sshd}" "ChallengeResponseAuthentication" "no"
  set_sshd_option "${sshd}" "UsePAM" "yes"
  set_sshd_option "${sshd}" "AllowUsers" "${APP_USER}"
  set_sshd_option "${sshd}" "MaxAuthTries" "3"
  set_sshd_option "${sshd}" "LoginGraceTime" "30"

  if systemctl list-unit-files | grep -q "^ssh.service"; then
    sudo systemctl restart ssh
  else
    sudo systemctl restart sshd
  fi
}

set_sshd_option() {
  local file="$1"
  local key="$2"
  local val="$3"
  if grep -qiE "^\s*${key}\s+" "${file}"; then
    sudo sed -ri "s|^\s*${key}\s+.*|${key} ${val}|I" "${file}"
  else
    echo "${key} ${val}" | sudo tee -a "${file}" >/dev/null
  fi
}

configure_firewall_and_fail2ban() {
  log "Configuring UFW and fail2ban..."
  sudo ufw default deny incoming
  sudo ufw default allow outgoing
  sudo ufw allow OpenSSH
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw --force enable

  sudo tee /etc/fail2ban/jail.local >/dev/null <<'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
backend = systemd

[sshd]
enabled = true
port = ssh
logpath = %(sshd_log)s
EOF

  sudo systemctl enable --now fail2ban
  sudo systemctl restart fail2ban
}

configure_periodic_security() {
  log "Enabling unattended upgrades, AppArmor, auditd..."

  sudo tee /etc/apt/apt.conf.d/20auto-upgrades >/dev/null <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

  sudo systemctl enable --now unattended-upgrades
  sudo systemctl enable --now apparmor || true
  sudo systemctl enable --now auditd
}

configure_msmtp_if_requested() {
  echo "root: ${ALERT_EMAIL}" | sudo tee /etc/aliases >/dev/null
  sudo newaliases || true

  if [[ -z "${SMTP_HOST}" || -z "${SMTP_USER}" || -z "${SMTP_PASS}" ]]; then
    warn "SMTP relay vars not set (SMTP_HOST/SMTP_USER/SMTP_PASS)."
    warn "Alert emails may not be delivered off-host until SMTP is configured."
    return 0
  fi

  log "Configuring msmtp relay..."
  sudo tee /etc/msmtprc >/dev/null <<EOF
defaults
auth           on
tls            ${SMTP_TLS}
tls_starttls   ${SMTP_STARTTLS}
logfile        /var/log/msmtp.log

account        default
host           ${SMTP_HOST}
port           ${SMTP_PORT}
user           ${SMTP_USER}
password       ${SMTP_PASS}
from           ${SMTP_FROM}
EOF

  sudo chmod 600 /etc/msmtprc
  sudo chown root:root /etc/msmtprc
}

ensure_tls_certs() {
  local cert_dir="${REPO_ROOT}/docker/nginx/certs"
  local fullchain="${cert_dir}/fullchain.pem"
  local privkey="${cert_dir}/privkey.pem"

  mkdir -p "${cert_dir}"

  if [[ -s "${fullchain}" && -s "${privkey}" ]]; then
    log "Using existing TLS certificates from ${cert_dir}"
    return 0
  fi

  warn "No TLS certificates found in ${cert_dir}. Generating self-signed certificates."
  openssl req -x509 -nodes -newkey rsa:4096 -sha256 -days 365 \
    -keyout "${privkey}" \
    -out "${fullchain}" \
    -subj "/CN=${APP_DOMAIN}" >/dev/null 2>&1

  chmod 600 "${privkey}"
  chmod 644 "${fullchain}"
  warn "Self-signed certificate generated. Replace with a real certificate before public launch."
}

configure_alerting_jobs() {
  log "Installing monitoring and maintenance scripts + cron jobs..."

  sudo mkdir -p /etc/paayo /usr/local/lib/paayo
  sudo tee /etc/paayo/alerts.conf >/dev/null <<EOF
ALERT_EMAIL="${ALERT_EMAIL}"
CPU_THRESHOLD="${CPU_THRESHOLD}"
MEM_THRESHOLD="${MEM_THRESHOLD}"
DISK_THRESHOLD="${DISK_THRESHOLD}"
REPO_ROOT="${REPO_ROOT}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME}"
EOF

  sudo tee /usr/local/lib/paayo/resource-alert.sh >/dev/null <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
source /etc/paayo/alerts.conf

mail_safe() {
  local subject="$1"
  local body="$2"
  printf "%s\n" "${body}" | mail -s "${subject}" "${ALERT_EMAIL}" || true
}

cpu="$(LC_ALL=C mpstat 1 1 | awk '/Average:/ {printf("%.0f", 100-$NF)}' || echo 0)"
mem="$(free | awk '/Mem:/ {printf("%.0f", ($3/$2)*100)}' || echo 0)"
disk="$(df -P / | awk 'NR==2 {gsub(/%/,"",$5); print $5}' || echo 0)"

if [[ "${cpu}" -ge "${CPU_THRESHOLD}" || "${mem}" -ge "${MEM_THRESHOLD}" || "${disk}" -ge "${DISK_THRESHOLD}" ]]; then
  body="Host: $(hostname -f)
CPU: ${cpu}% (threshold ${CPU_THRESHOLD}%)
Memory: ${mem}% (threshold ${MEM_THRESHOLD}%)
Disk (/): ${disk}% (threshold ${DISK_THRESHOLD}%)
Time: $(date -Is)"
  mail_safe "[paayo] Resource alert on $(hostname -s)" "${body}"
fi

if systemctl is-active --quiet docker; then
  unhealthy="$(docker ps --format '{{.Names}} {{.Status}}' | grep -Ei 'unhealthy|Exited' || true)"
  if [[ -n "${unhealthy}" ]]; then
    mail_safe "[paayo] Docker container health alert on $(hostname -s)" "${unhealthy}"
  fi
fi
EOF

  sudo tee /usr/local/lib/paayo/weekly-security.sh >/dev/null <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
source /etc/paayo/alerts.conf
tmp="$(mktemp)"
{
  echo "Host: $(hostname -f)"
  echo "Time: $(date -Is)"
  echo
  echo "=== AppArmor status ==="
  aa-status || true
  echo
  echo "=== fail2ban (sshd) ==="
  fail2ban-client status sshd || true
  echo
  echo "=== Auth failures (last 7 days) ==="
  grep -E "Failed password|Invalid user" /var/log/auth.log 2>/dev/null | tail -n 200 || true
  echo
  echo "=== auditd status ==="
  systemctl status auditd --no-pager || true
} > "${tmp}"

mail -s "[paayo] Weekly security report $(hostname -s)" "${ALERT_EMAIL}" < "${tmp}" || true
rm -f "${tmp}"
EOF

  sudo tee /usr/local/lib/paayo/weekly-maintenance.sh >/dev/null <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
source /etc/paayo/alerts.conf
tmp="$(mktemp)"
{
  echo "Host: $(hostname -f)"
  echo "Time: $(date -Is)"
  echo
  echo "=== apt update/upgrade ==="
  apt-get update -y
  DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
  apt-get autoremove -y
  apt-get autoclean -y
} > "${tmp}" 2>&1 || true

mail -s "[paayo] Weekly maintenance report $(hostname -s)" "${ALERT_EMAIL}" < "${tmp}" || true
rm -f "${tmp}"
EOF

  sudo tee /usr/local/lib/paayo/monthly-logs.sh >/dev/null <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
source /etc/paayo/alerts.conf
tmp_dir="$(mktemp -d)"
report="${tmp_dir}/report.txt"
bundle="${tmp_dir}/logs-$(hostname -s)-$(date +%Y-%m).tar.gz"

{
  echo "Host: $(hostname -f)"
  echo "Time: $(date -Is)"
  echo
  echo "=== journal errors (last 30 days) ==="
  journalctl -p err --since '30 days ago' --no-pager | tail -n 200 || true
  echo
  echo "=== docker compose ps ==="
  cd "${REPO_ROOT}"
  docker compose --profile prod ps || true
} > "${report}"

tar -czf "${bundle}" \
  /var/log/auth.log* \
  /var/log/syslog* \
  /var/log/fail2ban.log* \
  "${report}" 2>/dev/null || true

mail -s "[paayo] Monthly logs and report $(hostname -s)" -a "${bundle}" "${ALERT_EMAIL}" < "${report}" || true

# clean old logs (retain 30 days in journal)
journalctl --vacuum-time=30d || true
find /var/log -type f -name '*.gz' -mtime +30 -delete || true

rm -rf "${tmp_dir}"
EOF

  sudo chmod 750 /usr/local/lib/paayo/*.sh

  sudo tee /etc/cron.d/paayo-ops >/dev/null <<'EOF'
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Resource checks every 5 minutes
*/5 * * * * root /usr/local/lib/paayo/resource-alert.sh

# Weekly security report (Monday 03:10)
10 3 * * 1 root /usr/local/lib/paayo/weekly-security.sh

# Weekly maintenance updates (Sunday 03:30)
30 3 * * 0 root /usr/local/lib/paayo/weekly-maintenance.sh

# Monthly logs + cleanup (1st day of month 04:00)
0 4 1 * * root /usr/local/lib/paayo/monthly-logs.sh
EOF
}

update_env_for_production() {
  log "Updating ${ENV_FILE} with production values..."
  ensure_file_exists "${ENV_FILE}"

  local db_pass_urlenc redis_pass_urlenc
  db_pass_urlenc="$(urlencode "${DATABASE_PASSWORD}")"
  redis_pass_urlenc="$(urlencode "${REDIS_PASSWORD}")"

  local app_origin="https://${APP_DOMAIN}"
  local cors_origins="https://${APP_DOMAIN},https://www.${APP_DOMAIN}"

  set_env_var "NODE_ENV" "production"
  set_env_var "BUILD_TARGET" "production"
  set_env_var "APP_DOMAIN" "${APP_DOMAIN}"
  set_env_var "APP_PUBLIC_ORIGIN" "${app_origin}"
  set_env_var "NEXT_PUBLIC_APP_URL" "${app_origin}"
  set_env_var "BETTER_AUTH_URL" "${app_origin}"
  set_env_var "PASSKEY_ORIGIN" "${app_origin}"
  set_env_var "PASSKEY_RP_ID" "${APP_DOMAIN}"
  set_env_var "NEXT_PUBLIC_API_BASE_URL" "/api"

  set_env_var "DATABASE_NAME" "${DATABASE_NAME}"
  set_env_var "DATABASE_USER" "${DATABASE_USER}"
  set_env_var "DATABASE_PASSWORD" "${DATABASE_PASSWORD}"
  set_env_var "DATABASE_PASSWORD_URLENC" "${db_pass_urlenc}"
  set_env_var "DATABASE_MAX_CONNECTIONS" "${DATABASE_MAX_CONNECTIONS}"
  set_env_var "DATABASE_MIN_CONNECTIONS" "${DATABASE_MIN_CONNECTIONS}"
  set_env_var "DATABASE_URL" "postgresql://${DATABASE_USER}:${db_pass_urlenc}@postgres:5432/${DATABASE_NAME}"

  set_env_var "REDIS_PASSWORD" "${REDIS_PASSWORD}"
  set_env_var "REDIS_PASSWORD_URLENC" "${redis_pass_urlenc}"
  set_env_var "MEDIA_STORAGE" "${MEDIA_STORAGE}"
  set_env_var "S3_BUCKET" "${S3_BUCKET}"
  set_env_var "S3_REGION" "${S3_REGION}"
  set_env_var "S3_ENDPOINT" "${S3_ENDPOINT}"
  set_env_var "S3_PUBLIC_BASE_URL" "${S3_PUBLIC_BASE_URL}"
  set_env_var "S3_ACCESS_KEY_ID" "${S3_ACCESS_KEY_ID}"
  set_env_var "S3_SECRET_ACCESS_KEY" "${S3_SECRET_ACCESS_KEY}"
  set_env_var "S3_SESSION_TOKEN" "${S3_SESSION_TOKEN}"
  set_env_var "S3_FORCE_PATH_STYLE" "${S3_FORCE_PATH_STYLE}"
  set_env_var "S3_KEY_PREFIX" "${S3_KEY_PREFIX}"
  set_env_var "REDIS_URL" "redis://:${redis_pass_urlenc}@redis:6379"

  set_env_var "CORS_ALLOWED_ORIGINS" "${cors_origins}"
  set_env_var "NEXT_PUBLIC_CONTACT_EMAIL" "${ALERT_EMAIL}"
  set_env_var "SMTP_HOST" "${SMTP_HOST}"
  set_env_var "SMTP_PORT" "${SMTP_PORT}"
  set_env_var "SMTP_USER" "${SMTP_USER}"
  set_env_var "SMTP_PASS" "${SMTP_PASS}"
  set_env_var "SMTP_FROM" "${SMTP_FROM}"
  set_env_var "SMTP_REPLY_TO" "${SMTP_REPLY_TO}"
  set_env_var "ALERT_EMAIL" "${ALERT_EMAIL}"
  set_env_var "ALERT_CPU_THRESHOLD" "${CPU_THRESHOLD}"
  set_env_var "ALERT_MEM_THRESHOLD" "${MEM_THRESHOLD}"
  set_env_var "ALERT_DISK_THRESHOLD" "${DISK_THRESHOLD}"

  set_env_var "MYSQL_ROOT_PASSWORD" "${MYSQL_ROOT_PASSWORD}"
  set_env_var "MYSQL_EXPOSE_PORT" "${MYSQL_EXPOSE_PORT}"
}

deploy_compose_stack() {
  log "Deploying docker compose production stack..."
  cd "${REPO_ROOT}"
  sudo docker compose --profile prod build backend frontend
  sudo docker compose --profile prod up -d postgres redis backend frontend nginx
  sudo docker compose --profile prod ps
}

run_drizzle_pull() {
  log "Running drizzle schema pull against current DB..."
  local network_name="${COMPOSE_PROJECT_NAME}_paayo_net"
  if ! sudo docker network inspect "${network_name}" >/dev/null 2>&1; then
    warn "Network ${network_name} not found yet. Skipping drizzle pull."
    return 0
  fi

  sudo docker run --rm \
    --network "${network_name}" \
    -v "${REPO_ROOT}/tour_frontend:/workspace" \
    -w /workspace \
    -e DATABASE_URL="postgresql://${DATABASE_USER}:$(urlencode "${DATABASE_PASSWORD}")@postgres:5432/${DATABASE_NAME}" \
    oven/bun:1.3 sh -lc "bun install --frozen-lockfile && bun run db:pull" || \
    warn "drizzle pull failed. Verify drizzle config/database reachability."
}

print_next_steps() {
  cat <<EOF

Completed production bootstrap/deploy.

Important:
1) Re-login shell once to refresh docker group permissions:
   newgrp docker

2) Verify SSH before closing your current session:
   ssh ${APP_USER}@${APP_DOMAIN}

3) Check app and services:
   sudo docker compose --profile prod ps
   sudo docker compose --profile prod logs -f nginx backend frontend

4) SMTP (recommended): set SMTP_HOST/SMTP_USER/SMTP_PASS and re-run script
   to enable reliable external email alerts.

EOF
}

main() {
  require_non_root_with_sudo
  validate_required_env

  log "This script will harden SSH to allow only user '${APP_USER}' and disable root SSH login."
  read -r -p "Continue? [y/N]: " confirm
  [[ "${confirm}" =~ ^[Yy]$ ]] || die "Aborted by user."

  install_required_tools
  configure_postgres
  configure_redis
  configure_user_and_ssh
  configure_firewall_and_fail2ban
  configure_periodic_security
  configure_msmtp_if_requested
  ensure_tls_certs
  configure_alerting_jobs
  update_env_for_production
  deploy_compose_stack
  run_drizzle_pull
  print_next_steps
}

main "$@"
