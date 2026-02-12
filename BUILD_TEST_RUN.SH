#!/usr/bin/env bash
npm run build && firebase deploy --only hosting && npm run test:run && npm run test:e2e 