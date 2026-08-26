#!/bin/sh
set -eu
sh scripts/vercel-build.sh
node scripts/patch-public-existence-master-ine-v1.js
node scripts/patch-public-existence-master-ine-v3.js
node --check public/app.js
echo '=== MOLINO CONTROL · V3 BUILD · MASTER INE AUTO-PERIOD + EXACT AVERAGES ==='
