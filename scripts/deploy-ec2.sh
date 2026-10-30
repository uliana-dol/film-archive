#!/usr/bin/env bash
set -Eeuo pipefail

SHA="${1:?Missing Git commit SHA}"

if [[ ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "ERROR: Invalid commit SHA"
  exit 1
fi

cd /home/ubuntu/film-archive

REGION="eu-north-1"
REGISTRY="620306387556.dkr.ecr.eu-north-1.amazonaws.com"
NEW_IMAGE="$REGISTRY/filmarchive:$SHA"

test -s .env || {
  echo "ERROR: Existing .env file is missing"
  exit 1
}

OLD_CONTAINER="$(docker ps \
  --filter 'label=com.docker.compose.project=film-archive' \
  --filter 'label=com.docker.compose.service=api' \
  --format '{{.ID}}' | head -n 1)"

if [[ -z "$OLD_CONTAINER" ]]; then
  echo "ERROR: Existing FilmArchive container not found"
  exit 1
fi

OLD_IMAGE="$(docker inspect \
  --format '{{.Config.Image}}' "$OLD_CONTAINER")"

echo "Previous image: $OLD_IMAGE"
echo "Deploying image: $NEW_IMAGE"

aws ecr get-login-password --region "$REGION" |
  docker login --username AWS --password-stdin "$REGISTRY"

docker pull "$NEW_IMAGE"

rollback() {
  echo "Deployment failed. Restoring previous image..."

  if APP_IMAGE="$OLD_IMAGE" docker compose \
    -p film-archive \
    -f compose.aws.yaml \
    up -d --no-build --force-recreate; then
    echo "Rollback command completed"
  else
    echo "ERROR: Automatic rollback failed"
  fi

  exit 1
}

if ! APP_IMAGE="$NEW_IMAGE" docker compose \
  -p film-archive \
  -f compose.aws.yaml \
  up -d --no-build --force-recreate; then
  rollback
fi

for i in $(seq 1 30); do
  CURRENT_CONTAINER="$(APP_IMAGE="$NEW_IMAGE" docker compose \
    -p film-archive -f compose.aws.yaml ps -q api)"

  if [[ -n "$CURRENT_CONTAINER" ]]; then
    CURRENT_IMAGE="$(docker inspect \
      --format '{{.Config.Image}}' "$CURRENT_CONTAINER")"

    if [[ "$CURRENT_IMAGE" == "$NEW_IMAGE" ]] &&
       curl -fsS --max-time 3 http://127.0.0.1:3000/health |
         grep -qx 'OK'; then
      echo "Deployment successful. Health check passed."
      exit 0
    fi
  fi

  sleep 2
done

echo "ERROR: New application did not become healthy"
APP_IMAGE="$NEW_IMAGE" docker compose \
  -p film-archive -f compose.aws.yaml logs --tail 30 api

rollback
