#!/usr/bin/env bash
set -euo pipefail

PREVIEW_CHANNEL_ID="preview"
FIREBASE_PROJECT_ID="prescribe-7e1e8"

echo "Which deployment do you need?"
echo "1. Preview"
echo "2. Production"
read -r -p "Select option [1]: " deployment_option

deployment_option="${deployment_option:-1}"

if [ "$deployment_option" = "2" ]; then
  npm run build && npm run test:run && npm run test:e2e && firebase deploy --only hosting
else
  npm run build && npm run test:run && npm run test:e2e && firebase hosting:channel:deploy "$PREVIEW_CHANNEL_ID" --project "$FIREBASE_PROJECT_ID"
fi
