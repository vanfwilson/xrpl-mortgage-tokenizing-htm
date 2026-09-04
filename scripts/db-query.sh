#!/usr/bin/env bash
# Run one SQL statement against CouncilForge Postgres: scripts/db-query.sh "select count(*) from htm_mortgages.loans"
set -euo pipefail
HOST="${CF_PG_SSH_HOST:-aiaa-server}"; CONTAINER="${CF_PG_CONTAINER:-councilforge-postgres}"
printf '%s\n' "$1" | ssh -o BatchMode=yes "$HOST" "cat > /tmp/q.sql && docker cp /tmp/q.sql $CONTAINER:/tmp/q.sql && docker exec $CONTAINER psql -U ${CF_PG_USER:-councilforge} -d ${CF_PG_DB:-councilforge} -At -f /tmp/q.sql"
