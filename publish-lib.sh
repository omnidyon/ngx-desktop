#!/bin/bash
# Publishes @omnidyon/ngx-desktop to npm.
# Run ONLY after explicit approval (see CLAUDE.md Hard Rules). Git commit, tag and push stay manual.
# Usage: ./publish-lib.sh [patch|minor|major]   (default: patch)
set -euo pipefail

RELEASE="${1:-patch}"
LIB_PACKAGE=projects/ngx-desktop/package.json

if [ -n "$(git status --porcelain)" ]; then
  echo "The working tree is not clean; commit or stash your changes first." >&2
  exit 1
fi

# 1. Everything must pass before anything is changed.
npm run lint
npm run format:check
npm test
npm run test:examples

# 2. Bump the version; it is put back if the build or the publish fails, or the script is interrupted.
cp "$LIB_PACKAGE" "$LIB_PACKAGE.bak"
restore_version() {
  mv "$LIB_PACKAGE.bak" "$LIB_PACKAGE"
  echo "Release failed; the version was restored." >&2
}
trap restore_version ERR
trap 'restore_version; exit 130' INT TERM
(cd projects/ngx-desktop && npm version "$RELEASE" --no-git-tag-version > /dev/null)
npm run build
npm publish ./dist/ngx-desktop --access public
trap - ERR INT TERM
rm "$LIB_PACKAGE.bak"

VERSION=$(node -p "require('./$LIB_PACKAGE').version")
echo "Published @omnidyon/ngx-desktop@$VERSION. Commit, tag and push once reviewed:"
echo "  git add $LIB_PACKAGE && git commit -m \"chore: release v$VERSION\" && git tag v$VERSION"
