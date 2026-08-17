# Run this from your project root: C:\Users\user\ticketing-system
# Usage: powershell -ExecutionPolicy Bypass -File fix-missing-auth-functions.ps1
#
# Your lib/auth.ts was missing signTicketsMagicLink and
# verifyTicketsMagicLink - the guest "My Tickets" magic-link feature
# (app/my-tickets/*) already imports verifyTicketsMagicLink, but the
# function didn't exist in your live file, which is what broke the
# Vercel build. This ONLY appends the two missing functions to the end
# of the file - nothing else in lib/auth.ts is touched, so anything
# already working (login, sessions, 2FA) is untouched.

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

$path = "lib\auth.ts"
if (-not (Test-Path -LiteralPath $path)) {
    Write-Host "Could not find lib\auth.ts - run this from your project root." -ForegroundColor Red
    exit 1
}

$existing = [System.IO.File]::ReadAllText($path)

if ($existing -match "verifyTicketsMagicLink") {
    Write-Host "verifyTicketsMagicLink already present - nothing to do." -ForegroundColor Yellow
    exit 0
}

$addition = @'


/** Magic link for guest view-my-tickets (email-bound, 1 hour). */
export async function signTicketsMagicLink(email: string) {
  const normalized = email.trim().toLowerCase();
  return new SignJWT({ purpose: 'tickets_magic', email: normalized })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(JWT_SECRET);
}

export async function verifyTicketsMagicLink(
  token: string
): Promise<{ email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.purpose !== 'tickets_magic') return null;
    if (typeof payload.email !== 'string' || !payload.email.includes('@')) return null;
    return { email: payload.email.toLowerCase() };
  } catch {
    return null;
  }
}
'@

$combined = $existing.TrimEnd() + "`n" + $addition + "`n"
[System.IO.File]::WriteAllText($path, $combined, $utf8NoBom)

Write-Host "Appended signTicketsMagicLink and verifyTicketsMagicLink to lib\auth.ts" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  git add -A"
Write-Host "  git commit -m ""Add missing signTicketsMagicLink/verifyTicketsMagicLink to lib/auth.ts"""
Write-Host "  git push --force"
