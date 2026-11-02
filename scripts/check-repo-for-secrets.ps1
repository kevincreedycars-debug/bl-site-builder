# scripts/check-repo-for-secrets.ps1
#
# Looks for anything shaped like a credential in the files git would carry.
# It is a coarse net on purpose: a false alarm costs one line in the report, a
# leaked key costs the inbox.
#
#   powershell -File scripts/check-repo-for-secrets.ps1 -Mode full
#   powershell -File scripts/check-repo-for-secrets.ps1 -Mode staged
#
# Exit code 0 means nothing was found. 1 means something was, and names it.

[CmdletBinding()]
param(
  [ValidateSet('full', 'staged')]
  [string]$Mode = 'full'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

# The rules themselves are not a secret, so this file is never scanned.
$selfName = 'check-repo-for-secrets.ps1'

$skipDirs = @('.git', 'node_modules', '.local', '.vscode', 'exports', 'dist')
$skipFiles = @($selfName, 'package-lock.json', '.DS_Store')

$binaryExtensions = @('.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.zip', '.pdf')

# A name that means "this is a key" followed by an actual value.
$rules = @(
  @{ Name = 'assignment'; Pattern = '(?i)(api[_-]?key|apikey|secret|token|password|passwd|private[_-]?key|client[_-]?secret|bearer)\s*[:=]\s*[''"][^''"]{8,}[''"]' },
  @{ Name = 'aws-key'; Pattern = 'AKIA[0-9A-Z]{16}' },
  @{ Name = 'pem-header'; Pattern = '-----BEGIN [A-Z ]*PRIVATE KEY-----' },
  @{ Name = 'github-token'; Pattern = 'gh[pousr]_[A-Za-z0-9]{30,}' },
  @{ Name = 'slack-token'; Pattern = 'xox[baprs]-[A-Za-z0-9-]{10,}' },
  @{ Name = 'google-api-key'; Pattern = 'AIza[0-9A-Za-z_\-]{35}' },
  @{ Name = 'stripe-key'; Pattern = '(sk|rk)_(live|test)_[0-9A-Za-z]{16,}' },
  @{ Name = 'url-credentials'; Pattern = '[a-z][a-z0-9+.-]*://[^/\s:@]+:[^/\s@]{6,}@' }
)

$allowMarker = 'secret-scan: allow'

function Get-TargetFiles {
  if ($Mode -eq 'staged') {
    $names = & git diff --cached --name-only --diff-filter=ACM 2>$null
    if ($LASTEXITCODE -ne 0) {
      Write-Host 'Not a git repository, or nothing is staged. Nothing to scan.'
      return @()
    }
    return $names | Where-Object { $_ } | ForEach-Object { Join-Path $root $_ }
  }

  return Get-ChildItem -LiteralPath $root -Recurse -File -Force |
    Where-Object { $_.FullName -notmatch '\\\.git\\' } |
    ForEach-Object { $_.FullName }
}

$findings = New-Object System.Collections.Generic.List[object]
$scanned = 0

foreach ($file in Get-TargetFiles) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { continue }

  $relative = $file
  if ($relative.StartsWith($root)) {
    $relative = $relative.Substring($root.Length).TrimStart('\', '/')
  }
  $parts = $relative -split '[\\/]'
  if ($parts | Where-Object { $skipDirs -contains $_ }) { continue }
  if ($skipFiles -contains [System.IO.Path]::GetFileName($file)) { continue }
  if ($binaryExtensions -contains [System.IO.Path]::GetExtension($file).ToLowerInvariant()) { continue }

  $scanned++
  $lineNumber = 0
  foreach ($line in [System.IO.File]::ReadAllLines($file)) {
    $lineNumber++
    if ($line -like "*$allowMarker*") { continue }
    foreach ($rule in $rules) {
      if ($line -match $rule.Pattern) {
        $findings.Add([pscustomobject]@{
          File   = $relative
          Line   = $lineNumber
          Rule   = $rule.Name
          Text   = $line.Trim()
        })
        break
      }
    }
  }
}

Write-Host "Scanned $scanned file(s) in $Mode mode."

if ($findings.Count -eq 0) {
  Write-Host 'Nothing shaped like a credential was found.'
  exit 0
}

Write-Host ''
Write-Host "$($findings.Count) line(s) need a look:" -ForegroundColor Red
foreach ($finding in $findings) {
  $text = $finding.Text
  if ($text.Length -gt 120) { $text = $text.Substring(0, 117) + '...' }
  Write-Host ("  {0}:{1}  [{2}]  {3}" -f $finding.File, $finding.Line, $finding.Rule, $text)
}
Write-Host ''
Write-Host ('If a line is a harmless example, add the marker "' + $allowMarker + '" to that line.')
Write-Host 'Otherwise remove the value and rotate whatever it came from.'
exit 1
