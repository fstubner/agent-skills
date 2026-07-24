# Blocks a commit whose STAGED content contains a secret-shaped value.
# PowerShell counterpart to ./pre-commit (POSIX sh) — both read the same
# canonical pattern list, core/lib/secret-patterns.txt, so there's one
# place a new prefix gets added, not two that can drift.
#
# Reports file paths only, never the matched value — same rule as
# B-client-secrets in backend-engineering/scripts/check-backend.js.
#
# When this actually runs: git resolves a hook by the shebang on the file
# named `pre-commit` (this script's sh sibling), using its own bundled
# sh.exe on Windows too (Git for Windows) — so the sh version already
# covers Windows through git's normal hook mechanism. This .ps1 exists for
# direct/manual invocation (testing the hook without going through git, or
# a git configuration that isn't Git for Windows) — install the sh version
# via `git config core.hooksPath scripts/git-hooks` for the hook itself.
#
# Known scope limit: reconstructs each staged file's text via PowerShell's
# line-array capture of `git show`, which isn't byte-for-byte identical to
# the raw blob (line-ending/encoding nuances) — sufficient for substring
# pattern matching, not a byte-exact re-read.

# Resolved relative to THIS SCRIPT's own location, not the repo being
# committed to — see the matching comment in ./pre-commit (the sh version)
# for why: core.hooksPath can point at a hooks directory shared across
# multiple repos.
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$patternsFile = Join-Path $scriptDir '../../core/lib/secret-patterns.txt'
$maxChars = 2000000

$patterns = Get-Content -LiteralPath $patternsFile |
    Where-Object { $_ -notmatch '^\s*#' -and $_.Trim() -ne '' }

$stagedFiles = git diff --cached --name-only --diff-filter=ACM
$hits = New-Object System.Collections.Generic.List[string]

foreach ($f in $stagedFiles) {
    if ([string]::IsNullOrWhiteSpace($f)) { continue }
    $lines = git show ":$f" 2>$null
    if (-not $lines) { continue }
    $content = ($lines -join "`n")
    if ($content.Length -gt $maxChars) { $content = $content.Substring(0, $maxChars) }
    foreach ($pattern in $patterns) {
        if ($content -match $pattern) {
            $hits.Add($f)
            break
        }
    }
}

if ($hits.Count -gt 0) {
    [Console]::Error.WriteLine('pre-commit: secret-shaped value(s) staged in:')
    foreach ($h in $hits) { [Console]::Error.WriteLine("  $h") }
    [Console]::Error.WriteLine('Remove the secret (and rotate it if already committed elsewhere) before committing.')
    [Console]::Error.WriteLine('If this is a genuine false positive, commit with --no-verify and open an issue.')
    exit 1
}

exit 0
