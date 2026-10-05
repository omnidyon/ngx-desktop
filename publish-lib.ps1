# Publishes @omnidyon/ngx-desktop to npm.
# Run ONLY after explicit approval (see CLAUDE.md Hard Rules). Git commit, tag and push stay manual.
# Usage: .\publish-lib.ps1 [patch|minor|major]   (default: patch)
param([ValidateSet('patch', 'minor', 'major')][string]$Release = 'patch')
$ErrorActionPreference = 'Stop'

$libPackage = 'projects/ngx-desktop/package.json'

function Invoke-Step([string]$command) {
  Write-Host "> $command" -ForegroundColor DarkGray
  cmd /c $command
  if ($LASTEXITCODE -ne 0) { throw "'$command' failed." }
}

if (git status --porcelain) {
  Write-Error 'The working tree is not clean; commit or stash your changes first.'
}

# 1. Everything must pass before anything is changed.
Invoke-Step 'npm run lint'
Invoke-Step 'npm run format:check'
Invoke-Step 'npm test'
Invoke-Step 'npm run test:examples'

# 2. Bump the version; it is put back if the build or the publish fails.
Copy-Item $libPackage "$libPackage.bak"
try {
  Push-Location projects/ngx-desktop
  try { Invoke-Step "npm version $Release --no-git-tag-version" } finally { Pop-Location }
  Invoke-Step 'npm run build'
  Invoke-Step 'npm publish ./dist/ngx-desktop --access public'
  Remove-Item "$libPackage.bak"
} catch {
  Move-Item -Force "$libPackage.bak" $libPackage
  Write-Error "Release failed; the version was restored. $_"
}

$version = (Get-Content $libPackage | ConvertFrom-Json).version
Write-Host "Published @omnidyon/ngx-desktop@$version. Commit, tag and push once reviewed:" -ForegroundColor Green
Write-Host "  git add $libPackage; git commit -m `"chore: release v$version`"; git tag v$version"
