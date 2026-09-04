#!/usr/bin/env bash
# Apply a SQL file to CouncilForge Postgres (docker councilforge-postgres on aiaa-server).
# usage: scripts/db-apply.sh db/001_closing_package.sql   |   npm run db:seed | scripts/db-apply.sh -
set -euo pipefail
SRC="${1:?sql file or -}"
HOST="${CF_PG_SSH_HOST:-aiaa-server}"
CONTAINER="${CF_PG_CONTAINER:-councilforge-postgres}"
DB="${CF_PG_DB:-councilforge}"; USER="${CF_PG_USER:-councilforge}"
cat "$SRC" | ssh -o BatchMode=yes "$HOST" "cat > /tmp/apply.sql && docker cp /tmp/apply.sql $CONTAINER:/tmp/apply.sql && docker exec $CONTAINER psql -U $USER -d $DB -v ON_ERROR_STOP=1 -q -f /tmp/apply.sql && rm /tmp/apply.sql"
