#!/bin/sh
set -eu
# Root-stable build: publish the committed application source without runtime patch injection.
node --check app.js
node --check excel-worker.js
node --check ine-engine-maestro.js
rm -rf public
mkdir -p public
find . -maxdepth 1 -type f ! -name 'vercel.json' -exec cp -p {} public/ \;
if [ -d docs ]; then cp -R docs public/; fi
