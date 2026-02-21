#!/usr/bin/env bash
set -Eeuo pipefail

# S3/Object Storage connectivity check script
#
# What it validates:
# 1) Credentials can access the bucket (head-bucket)
# 2) Upload works
# 3) Download works
# 4) Downloaded content matches uploaded content
# 5) Delete works (unless keep is enabled)
#
# Usage:
#   bash scripts/s3/s3-connection-check.sh
#   bash scripts/s3/s3-connection-check.sh --env-file scripts/s3/s3-test.env
#
# Optional flags:
#   --bucket <name>
#   --endpoint <url>
#   --region <region>
#   --access-key <id>
#   --secret-key <secret>
#   --session-token <token>
#   --prefix <object-prefix>
#   --path-style <true|false>
#   --keep-object <true|false>
#   --help

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_ENV_FILE="${SCRIPT_DIR}/s3-test.env"

ENV_FILE="${ENV_FILE:-${DEFAULT_ENV_FILE}}"
ARG_BUCKET=""
ARG_ENDPOINT=""
ARG_REGION=""
ARG_ACCESS_KEY=""
ARG_SECRET_KEY=""
ARG_SESSION_TOKEN=""
ARG_PREFIX=""
ARG_PATH_STYLE=""
ARG_KEEP_OBJECT=""

log() {
  printf "[%s] %s\n" "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"
}

die() {
  printf "[%s] ERROR: %s\n" "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
S3 connection test script

Required via env file or flags:
  S3_BUCKET
  S3_ENDPOINT
  S3_REGION
  S3_ACCESS_KEY_ID (or AWS_ACCESS_KEY_ID)
  S3_SECRET_ACCESS_KEY (or AWS_SECRET_ACCESS_KEY)

Optional:
  S3_SESSION_TOKEN
  S3_TEST_PREFIX (default: healthcheck)
  S3_FORCE_PATH_STYLE (true|false, default: false)
  S3_KEEP_TEST_OBJECT (true|false, default: false)

Examples:
  bash scripts/s3/s3-connection-check.sh --env-file scripts/s3/s3-test.env
  bash scripts/s3/s3-connection-check.sh --bucket bisup214 --endpoint https://fsn1.your-objectstorage.com --region fsn1
EOF
}

to_bool() {
  local v="${1:-}"
  shopt -s nocasematch
  if [[ "$v" == "1" || "$v" == "true" || "$v" == "yes" || "$v" == "on" ]]; then
    echo "true"
  else
    echo "false"
  fi
  shopt -u nocasematch
}

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

      value="${value#"${value%%[![:space:]]*}"}"

      if [[ "${value}" =~ ^\"(.*)\"$ ]]; then
        value="${BASH_REMATCH[1]}"
      elif [[ "${value}" =~ ^\'(.*)\'$ ]]; then
        value="${BASH_REMATCH[1]}"
      fi

      export "${key}=${value}"
    fi
  done < "${env_file}"
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --env-file)
        ENV_FILE="$2"
        shift 2
        ;;
      --bucket)
        ARG_BUCKET="$2"
        shift 2
        ;;
      --endpoint)
        ARG_ENDPOINT="$2"
        shift 2
        ;;
      --region)
        ARG_REGION="$2"
        shift 2
        ;;
      --access-key)
        ARG_ACCESS_KEY="$2"
        shift 2
        ;;
      --secret-key)
        ARG_SECRET_KEY="$2"
        shift 2
        ;;
      --session-token)
        ARG_SESSION_TOKEN="$2"
        shift 2
        ;;
      --prefix)
        ARG_PREFIX="$2"
        shift 2
        ;;
      --path-style)
        ARG_PATH_STYLE="$2"
        shift 2
        ;;
      --keep-object)
        ARG_KEEP_OBJECT="$2"
        shift 2
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      *)
        die "Unknown argument: $1 (use --help)"
        ;;
    esac
  done
}

parse_args "$@"
safe_load_env_file "${ENV_FILE}"

S3_BUCKET="${ARG_BUCKET:-${S3_BUCKET:-}}"
S3_ENDPOINT="${ARG_ENDPOINT:-${S3_ENDPOINT:-}}"
S3_REGION="${ARG_REGION:-${S3_REGION:-}}"
S3_ACCESS_KEY_ID="${ARG_ACCESS_KEY:-${S3_ACCESS_KEY_ID:-${AWS_ACCESS_KEY_ID:-}}}"
S3_SECRET_ACCESS_KEY="${ARG_SECRET_KEY:-${S3_SECRET_ACCESS_KEY:-${AWS_SECRET_ACCESS_KEY:-}}}"
S3_SESSION_TOKEN="${ARG_SESSION_TOKEN:-${S3_SESSION_TOKEN:-${AWS_SESSION_TOKEN:-}}}"
S3_TEST_PREFIX="${ARG_PREFIX:-${S3_TEST_PREFIX:-healthcheck}}"
S3_FORCE_PATH_STYLE="$(to_bool "${ARG_PATH_STYLE:-${S3_FORCE_PATH_STYLE:-false}}")"
S3_KEEP_TEST_OBJECT="$(to_bool "${ARG_KEEP_OBJECT:-${S3_KEEP_TEST_OBJECT:-false}}")"

[[ -n "${S3_BUCKET}" ]] || die "Missing S3_BUCKET"
[[ -n "${S3_ENDPOINT}" ]] || die "Missing S3_ENDPOINT"
[[ -n "${S3_REGION}" ]] || die "Missing S3_REGION"
[[ -n "${S3_ACCESS_KEY_ID}" ]] || die "Missing S3_ACCESS_KEY_ID or AWS_ACCESS_KEY_ID"
[[ -n "${S3_SECRET_ACCESS_KEY}" ]] || die "Missing S3_SECRET_ACCESS_KEY or AWS_SECRET_ACCESS_KEY"

if ! command -v aws >/dev/null 2>&1; then
  die "aws cli not found. Install AWS CLI v2 first."
fi

if [[ "${S3_ENDPOINT}" != http://* && "${S3_ENDPOINT}" != https://* ]]; then
  S3_ENDPOINT="https://${S3_ENDPOINT}"
fi
S3_ENDPOINT="${S3_ENDPOINT%/}"

TMP_DIR="$(mktemp -d)"
AWS_CONFIG_TMP_DIR=""
cleanup() {
  if [[ "${S3_KEEP_TEST_OBJECT}" != "true" && -n "${TEST_OBJECT_KEY:-}" ]]; then
    aws s3 rm "s3://${S3_BUCKET}/${TEST_OBJECT_KEY}" \
      --endpoint-url "${S3_ENDPOINT}" \
      --no-cli-pager >/dev/null 2>&1 || true
  fi
  [[ -n "${TMP_DIR}" ]] && rm -rf "${TMP_DIR}" || true
  [[ -n "${AWS_CONFIG_TMP_DIR}" ]] && rm -rf "${AWS_CONFIG_TMP_DIR}" || true
}
trap cleanup EXIT

export AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY}"
export AWS_DEFAULT_REGION="${S3_REGION}"
if [[ -n "${S3_SESSION_TOKEN}" ]]; then
  export AWS_SESSION_TOKEN="${S3_SESSION_TOKEN}"
fi

if [[ "${S3_FORCE_PATH_STYLE}" == "true" ]]; then
  AWS_CONFIG_TMP_DIR="$(mktemp -d)"
  cat > "${AWS_CONFIG_TMP_DIR}/config" <<EOF
[default]
region = ${S3_REGION}
s3 =
    addressing_style = path
EOF
  export AWS_CONFIG_FILE="${AWS_CONFIG_TMP_DIR}/config"
fi

PAYLOAD_FILE="${TMP_DIR}/payload.txt"
DOWNLOADED_FILE="${TMP_DIR}/downloaded.txt"
TS="$(date -u +'%Y%m%dT%H%M%SZ')"
RND="${RANDOM}${RANDOM}"
TEST_OBJECT_KEY="${S3_TEST_PREFIX%/}/s3-health-${TS}-${RND}.txt"

cat > "${PAYLOAD_FILE}" <<EOF
s3-health-check
timestamp=${TS}
bucket=${S3_BUCKET}
object=${TEST_OBJECT_KEY}
EOF

log "Starting S3 connectivity test"
log "Bucket=${S3_BUCKET}"
log "Endpoint=${S3_ENDPOINT}"
log "Region=${S3_REGION}"
log "PathStyle=${S3_FORCE_PATH_STYLE}"

log "Step 1/5: head-bucket"
aws s3api head-bucket \
  --bucket "${S3_BUCKET}" \
  --endpoint-url "${S3_ENDPOINT}" \
  --no-cli-pager >/dev/null

log "Step 2/5: upload test object"
aws s3 cp "${PAYLOAD_FILE}" "s3://${S3_BUCKET}/${TEST_OBJECT_KEY}" \
  --endpoint-url "${S3_ENDPOINT}" \
  --no-progress \
  --no-cli-pager >/dev/null

log "Step 3/5: head-object"
aws s3api head-object \
  --bucket "${S3_BUCKET}" \
  --key "${TEST_OBJECT_KEY}" \
  --endpoint-url "${S3_ENDPOINT}" \
  --no-cli-pager >/dev/null

log "Step 4/5: download test object"
aws s3 cp "s3://${S3_BUCKET}/${TEST_OBJECT_KEY}" "${DOWNLOADED_FILE}" \
  --endpoint-url "${S3_ENDPOINT}" \
  --no-progress \
  --no-cli-pager >/dev/null

if ! cmp -s "${PAYLOAD_FILE}" "${DOWNLOADED_FILE}"; then
  die "Downloaded object content mismatch."
fi

if [[ "${S3_KEEP_TEST_OBJECT}" == "true" ]]; then
  log "Step 5/5: keep object enabled, skipping delete"
  log "Kept object: s3://${S3_BUCKET}/${TEST_OBJECT_KEY}"
else
  log "Step 5/5: delete test object"
  aws s3 rm "s3://${S3_BUCKET}/${TEST_OBJECT_KEY}" \
    --endpoint-url "${S3_ENDPOINT}" \
    --no-cli-pager >/dev/null
fi

log "S3 connectivity test passed."
