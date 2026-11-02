#!/bin/bash
# Uploads a built site to the VPS as a new release, activates it, verifies it and rolls back on failure.
#   deploy.sh <dir> <domain>
# Env: DEPLOY_SSH_KEY, DEPLOY_KNOWN_HOSTS (secrets); DEPLOY_HOST (SSH address), SITE_IP (address the domain is served from).
# The key only works for this site's /usr/local/bin/deploy-gate on the server: upload, activate, rollback, status.
set -euo pipefail
SRC="${1:?dir}"; DOMAIN="${2:?domain}"
DEPLOY_HOST="${DEPLOY_HOST:-103.137.248.4}"
SITE_IP="${SITE_IP:-157.228.119.3}"
[ -f "$SRC/index.html" ] || { echo "::error::$SRC/index.html not found"; exit 1; }

install -m 700 -d "$HOME/.ssh"
printf '%s\n' "$DEPLOY_SSH_KEY" > "$HOME/.ssh/deploy_key"; chmod 600 "$HOME/.ssh/deploy_key"
printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > "$HOME/.ssh/deploy_known_hosts"
SSH="ssh -i $HOME/.ssh/deploy_key -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$HOME/.ssh/deploy_known_hosts -o ConnectTimeout=20"
REL="$(date -u +%Y%m%d-%H%M%S)-${GITHUB_SHA::7}"

echo "Uploading $SRC → release $REL"
rsync -rlz --chmod=D755,F644 -e "$SSH" "$SRC/" "deploy@$DEPLOY_HOST:$REL/"
$SSH "deploy@$DEPLOY_HOST" "activate $REL"

# The served index.html must be byte-identical to the one just built. http:// follows Caddy's redirect to https
# once the domain has HTTPS; --resolve pins both to the VPS so this works before and after the DNS switch.
expected="$(sha256sum "$SRC/index.html" | cut -d' ' -f1)"
for attempt in 1 2 3 4 5; do
  actual="$(curl -fsSL --max-time 15 --resolve "$DOMAIN:80:$SITE_IP" --resolve "$DOMAIN:443:$SITE_IP" "http://$DOMAIN/" | sha256sum | cut -d' ' -f1)" || actual="curl-failed"
  if [ "$actual" = "$expected" ]; then
    echo "Verified: http://$DOMAIN/ on $SITE_IP serves release $REL"
    echo "### Deployed \`$REL\` to $DOMAIN" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
    exit 0
  fi
  echo "Attempt $attempt: served index.html does not match ($actual)"; sleep 3
done
echo "::error::Verification failed — rolling back"
$SSH "deploy@$DEPLOY_HOST" rollback
exit 1
