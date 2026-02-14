#!/usr/bin/env bash
set -euo pipefail

echo "Which deployment do you need?"
echo "1. Preview"
echo "2. Production"
read -r -p "Select option [1]: " deployment_option

deployment_option="${deployment_option:-1}"

if [ "$deployment_option" = "2" ]; then
  npm run build && firebase deploy --only hosting && npm run test:run && npm run test:e2e
else
  npm run build && firebase hosting:channel:deploy preview && npm run test:run && npm run test:e2e
fi
