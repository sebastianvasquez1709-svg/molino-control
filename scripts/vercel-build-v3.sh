#!/bin/sh
set -eu
node scripts/patch-worker-index-v1.js
sh scripts/vercel-build-v2.sh
node scripts/patch-maestro-storage-hardening-v1.js
node scripts/patch-public-existence-master-ine-v2.js
node scripts/patch-public-existence-master-ine-v3.js
node scripts/patch-public-existence-master-ine-v4.js
node --check public/app.js
echo '=== MOLINO CONTROL · BUILD V5 · MAESTRO STORAGE HARDENED ==='
