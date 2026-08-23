#!/bin/sh
set -eu
node scripts/patch-dispatch-print.js
node scripts/patch-dispatch-print-v3.js
node scripts/patch-dispatch-ux-v6.js
rm -rf public
mkdir -p public
find . -maxdepth 1 -type f ! -name 'vercel.json' -exec cp -p {} public/ \;
if [ -d docs ]; then cp -R docs public/; fi
