# Run this from your project root
# Usage: powershell -ExecutionPolicy Bypass -File fix-missing-paystack-transfer-functions.ps1
#
# lib/paystack.ts was also reverted along with the rest of the payouts
# feature, and is missing createTransferRecipient, initiateTransfer, and
# fetchTransfer - which lib/payouts.ts imports, causing this build error.
#
# IMPORTANT: this file's current refundTransaction has a newer capability
# (partial refunds via an amountKes parameter) that my restore snapshot
# does NOT have - overwriting the whole file would have regressed that.
# So this ONLY APPENDS the 3 missing transfer functions (plus their small
# paystackFetch helper) to the end of your current file. Your existing
# initializeTransaction and refundTransaction are completely untouched.

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

$path = "lib\paystack.ts"
if (-not (Test-Path -LiteralPath $path)) {
    Write-Host "Could not find lib\paystack.ts - run this from your project root." -ForegroundColor Red
    exit 1
}

$existing = [System.IO.File]::ReadAllText($path)

if ($existing -match "createTransferRecipient") {
    Write-Host "createTransferRecipient already present - nothing to do." -ForegroundColor Yellow
    exit 0
}

$addition = @'


async function paystackFetch(path: string, init?: RequestInit) {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not set');
  const res = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok || data.status === false) {
    throw new Error(data.message || `Paystack error (${res.status})`);
  }
  return data;
}

export async function createTransferRecipient(params: {
  type: 'mobile_money' | 'ghipss' | 'basa' | 'nuban';
  name: string;
  accountNumber: string;
  bankCode: string;
  currency?: string;
}) {
  const data = await paystackFetch('/transferrecipient', {
    method: 'POST',
    body: JSON.stringify({
      type: params.type,
      name: params.name,
      account_number: params.accountNumber,
      bank_code: params.bankCode,
      currency: params.currency || 'KES',
    }),
  });
  return data.data as {
    recipient_code: string;
    type: string;
    name: string;
    details: Record<string, unknown>;
  };
}

export async function initiateTransfer(params: {
  amountKes: number;
  recipientCode: string;
  reference: string;
  reason?: string;
}) {
  const amount = Math.round(params.amountKes * 100);
  if (amount < 100) throw new Error('Transfer amount too small');
  const data = await paystackFetch('/transfer', {
    method: 'POST',
    body: JSON.stringify({
      source: 'balance',
      amount,
      recipient: params.recipientCode,
      reference: params.reference,
      reason: params.reason || 'TicketHub organizer payout',
      currency: 'KES',
    }),
  });
  return data.data as {
    transfer_code: string;
    status: string;
    reference: string;
    amount: number;
  };
}

export async function fetchTransfer(transferCodeOrReference: string) {
  const data = await paystackFetch(`/transfer/${encodeURIComponent(transferCodeOrReference)}`, {
    method: 'GET',
  });
  return data.data as {
    status: string;
    transfer_code: string;
    reference: string;
    amount: number;
    reason?: string;
  };
}

'@

$newContent = $existing + $addition
[System.IO.File]::WriteAllText($path, $newContent, $utf8NoBom)

Write-Host "Appended the 3 missing transfer functions to lib/paystack.ts" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Green
Write-Host "  git add ."
Write-Host "  git commit -m ""Fix: restore missing Paystack transfer functions for payouts"""
Write-Host "  git push origin main"
