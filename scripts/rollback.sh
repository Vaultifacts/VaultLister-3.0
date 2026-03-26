#!/bin/bash
# VaultLister rollback script — reverts to the previous Docker image
# Called by deploy-staging.yml on smoke test failure
set -e

cd /opt/vaultlister-staging

ROLLBACK_IMAGE="ghcr.io/vaultifacts/vaultlister-3.0:staging-rollback"

echo "=== VaultLister Rollback ==="
echo "Rolling back to previous image: $ROLLBACK_IMAGE"

# Check if rollback image exists
if ! docker image inspect "$ROLLBACK_IMAGE" &> /dev/null; then
    echo "ERROR: No rollback image found. Cannot rollback."
    echo "The staging-rollback tag is created during each deploy."
    exit 1
fi

# Stop current containers
docker compose -f docker-compose.staging.yml stop app

# PostgreSQL: DB rollback requires manual pg_restore from a backup dump.
# See scripts/pg-restore.js for restore instructions.
echo "NOTE: PostgreSQL data rollback not automated — restore manually if needed."

# Start with rollback image
OVERRIDE="services:\n  app:\n    image: $ROLLBACK_IMAGE"
echo -e "$OVERRIDE" > /tmp/rollback-override.yml
docker compose -f docker-compose.staging.yml -f /tmp/rollback-override.yml up -d app
rm -f /tmp/rollback-override.yml

# Wait for health
for i in $(seq 1 12); do
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' vaultlister-staging-app 2>/dev/null || echo "starting")
    echo "Health check attempt $i: $STATUS"
    if [ "$STATUS" = "healthy" ]; then
        echo "Rollback complete — container is healthy"
        exit 0
    fi
    sleep 5
done

echo "ERROR: Rollback container failed health check"
docker logs vaultlister-staging-app --tail 20
exit 1
