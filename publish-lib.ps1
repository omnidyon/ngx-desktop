# Builds and publishes @omnidyon/ngx-desktop to npm and JSR.
# Run ONLY after explicit approval (see CLAUDE.md Hard Rules). Git commit/tag/push are left to the maintainer.
$ErrorActionPreference = 'Stop'
Write-Host "Publishing @omnidyon/ngx-desktop..." -ForegroundColor Blue

# Version source of truth: projects/ngx-desktop/package.json (synced into jsr.json below)
Push-Location projects/ngx-desktop; npm version patch --no-git-tag-version; Pop-Location
$jsr = Get-Content jsr.json | ConvertFrom-Json
$jsr.version = (Get-Content "projects/ngx-desktop/package.json" | ConvertFrom-Json).version
$jsr | ConvertTo-Json | Set-Content -Encoding utf8 jsr.json

npm run lint; if (-not $?) { exit 1 }
npm test; if (-not $?) { exit 1 }
npm run build; if (-not $?) { exit 1 }

Push-Location dist/ngx-desktop
npm publish --access public
Pop-Location
npx jsr publish

$version = (Get-Content "projects/ngx-desktop/package.json" | ConvertFrom-Json).version
Write-Host "Published v$version. Commit, tag and push manually once reviewed." -ForegroundColor Green
