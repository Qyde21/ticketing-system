# Run this from your project root
# Usage: powershell -ExecutionPolicy Bypass -File fix-dotenv-build-error.ps1
#
# Fixes: "Cannot find module 'dotenv'" build failure from insert-ticket.ts
# (a local-only dev script, never run in production). Two fixes together:
# 1. Adds dotenv as a devDependency, so the module actually resolves.
# 2. Ensures tsconfig.json excludes insert-ticket.ts and check-db.ts from
#    type-checking (belt-and-suspenders, in case whatever is currently on
#    origin/main doesn't have this exclusion yet).
# NOTE: after this you must run "npm install" locally so package-lock.json
# picks up the new dependency before committing, or the Vercel build can
# still fail on a lockfile mismatch.

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

Write-Host "1. Updating package.json (adding dotenv)..." -ForegroundColor Cyan
$pkgContent = @'
{
  "name": "ticketing-system",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "@geoapify/react-geocoder-autocomplete": "^3.0.0",
    "@neondatabase/serverless": "^1.1.0",
    "@vercel/postgres": "^0.10.0",
    "bcryptjs": "^3.0.3",
    "html5-qrcode": "^2.3.8",
    "jose": "^6.2.3",
    "nanoid": "^5.1.16",
    "next": "16.2.9",
    "qrcode": "^1.5.4",
    "qrcode.react": "^4.2.0",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "resend": "^6.16.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/bcryptjs": "^2.4.6",
    "@types/node": "^20",
    "@types/qrcode": "^1.5.6",
    "@types/qrcode.react": "^1.0.5",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.9",
    "tailwindcss": "^4",
    "typescript": "^5",
    "dotenv": "^16.4.5"
  }
}

'@
[System.IO.File]::WriteAllText("package.json", $pkgContent, $utf8NoBom)
Write-Host "   Done." -ForegroundColor Green

Write-Host "2. Updating tsconfig.json (ensuring exclusions)..." -ForegroundColor Cyan
$tsconfigContent = @'
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": [
      "dom",
      "dom.iterable",
      "esnext"
    ],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": [
        "./*"
      ]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": [
    "check-db.ts",
    "insert-ticket.ts",
    "node_modules"
  ]
}

'@
[System.IO.File]::WriteAllText("tsconfig.json", $tsconfigContent, $utf8NoBom)
Write-Host "   Done." -ForegroundColor Green

Write-Host ""
Write-Host "3. Running npm install to update package-lock.json..." -ForegroundColor Cyan
npm install
Write-Host "   Done." -ForegroundColor Green

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Green
Write-Host "  git add ."
Write-Host "  git commit -m ""Fix: add missing dotenv dependency and tsconfig exclusions"""
Write-Host "  git push origin main"
