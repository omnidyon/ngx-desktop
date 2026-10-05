#!/bin/bash
# Builds and publishes @omnidyon/ngx-desktop to npm and JSR.
# Run ONLY after explicit approval (see CLAUDE.md Hard Rules). Git commit/tag/push are left to the maintainer.
set -e

echo "Publishing @omnidyon/ngx-desktop..."

# Version source of truth: projects/ngx-desktop/package.json (synced into jsr.json below)
cd projects/ngx-desktop && npm version patch --no-git-tag-version && cd ../..
node -e "const f=require('fs');const j=JSON.parse(f.readFileSync('jsr.json'));j.version=require('./projects/ngx-desktop/package.json').version;f.writeFileSync('jsr.json',JSON.stringify(j,null,2)+'\n')"

npm run lint
npm test
npm run build

cd dist/ngx-desktop
npm publish --access public
cd ../..
npx jsr publish

VERSION=$(node -p "require('./projects/ngx-desktop/package.json').version")
echo "Published v$VERSION. Commit, tag and push manually once reviewed:"
echo "  git add package.json projects/ngx-desktop/package.json jsr.json && git commit -m \"chore: release v$VERSION\" && git tag v$VERSION"
