#!/bin/sh
set -eu
sh scripts/vercel-build.sh
node scripts/patch-public-existence-master-ine-v1.js
node --check public/app.js
echo '=== MOLINO CONTROL · V2 BUILD · MASTER INE ACTIVE ==='
