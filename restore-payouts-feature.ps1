# Run this from your project root: C:\Users\user\ticketing-system (or wherever
# your current working clone is)
# Usage: powershell -ExecutionPolicy Bypass -File restore-payouts-feature.ps1
#
# The entire organizer payouts backend went missing - lib/payouts.ts, all
# 4 API routes, all 3 supporting components, the migration file, and both
# the organizer and admin payout pages had reverted to older/pre-feature
# versions. This looks like the same class of stale-force-push incident
# we hit earlier in this project, just affecting a different feature this
# time. The pages that referenced the missing files (importing components
# that no longer existed) would very likely have broken your build or
# 404'd at runtime.
#
# This restores the complete, correct version of everything - AND already
# includes a race-condition fix in lib/payouts.ts: processPayout() now
# atomically claims a payout (an UPDATE ... WHERE status IN (pending,
# failed) guard) before calling Paystack's transfer API, so two
# near-simultaneous calls (double-click, or a cron overlapping a manual
# request) can no longer both trigger a real duplicate money transfer to
# an organizer. This fix was found and applied during a routine review,
# independent of the file-loss incident itself.
#
# IMPORTANT: run migrations/006_organizer_payouts.sql in Neon's SQL Editor
# if you have not already (it's likely already applied from before, but
# safe to re-run - all statements use IF NOT EXISTS).

$ErrorActionPreference = "Stop"
$script:anyFailed = $false
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

function Write-ClaudeFile($path, $content) {
    $dir = Split-Path $path -Parent
    if ($dir -and -not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    [System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
}


Write-Host "Writing: lib\payouts.ts" -ForegroundColor Cyan
$content = @'
import { sql } from '@/lib/db';
import { createTransferRecipient, initiateTransfer, fetchTransfer } from '@/lib/paystack';
import { nanoid } from 'nanoid';

export const PLATFORM_FEE_RATE = 0.1;
export const MIN_PAYOUT_KES = 50;
export const PAYOUT_DELAY_HOURS = 48;

export type EventEarnings = {
  eventId: string;
  organizerId: string;
  title: string;
  endAt: string | null;
  status: string;
  gross: number;
  refunded: number;
  fee: number;
  net: number;
};

export function computeNet(gross: number, refunded: number) {
  const g = Math.max(0, Number(gross) || 0);
  const r = Math.max(0, Number(refunded) || 0);
  const eligible = Math.max(0, g - r);
  const fee = Math.round(eligible * PLATFORM_FEE_RATE * 100) / 100;
  const net = Math.round((eligible - fee) * 100) / 100;
  return { gross: g, refunded: r, fee, net };
}

export async function getEventEarnings(eventId: string): Promise<EventEarnings | null> {
  const [row] = await sql`
    SELECT
      e.id AS event_id,
      e.organizer_id,
      e.title,
      e.end_at,
      e.start_at,
      e.status,
      COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status = 'paid'), 0) AS gross,
      COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status = 'refunded'), 0) AS refunded
    FROM events e
    LEFT JOIN orders o ON o.event_id = e.id
    WHERE e.id = ${eventId}
    GROUP BY e.id
  `;
  if (!row) return null;
  const { gross, refunded, fee, net } = computeNet(Number(row.gross), Number(row.refunded));
  return {
    eventId: row.event_id as string,
    organizerId: row.organizer_id as string,
    title: row.title as string,
    endAt: (row.end_at || row.start_at) ? String(row.end_at || row.start_at) : null,
    status: row.status as string,
    gross,
    refunded,
    fee,
    net,
  };
}

export async function ensureRecipient(organizerId: string): Promise<string> {
  const [profile] = await sql`
    SELECT
      op.payout_method, op.payout_name, op.payout_phone,
      op.bank_code, op.bank_account_number, op.paystack_recipient_code,
      u.full_name, u.email
    FROM organizer_profiles op
    JOIN users u ON u.id = op.user_id
    WHERE op.user_id = ${organizerId}
  `;
  if (!profile) throw new Error('Organizer profile not found. Complete payout details first.');
  if (profile.paystack_recipient_code) return profile.paystack_recipient_code as string;

  const method = profile.payout_method as string | null;
  const name = (profile.payout_name || profile.full_name || 'Organizer') as string;

  if (method === 'mpesa') {
    const phone = String(profile.payout_phone || '').replace(/\s+/g, '');
    if (!phone) throw new Error('M-Pesa phone number is required');
    let account = phone.replace(/^\+/, '');
    if (account.startsWith('0')) account = '254' + account.slice(1);
    if (!account.startsWith('254')) account = '254' + account;

    const recipient = await createTransferRecipient({
      type: 'mobile_money',
      name,
      accountNumber: account,
      bankCode: 'MPESA',
      currency: 'KES',
    });
    await sql`
      UPDATE organizer_profiles
      SET paystack_recipient_code = ${recipient.recipient_code},
          payout_updated_at = now()
      WHERE user_id = ${organizerId}
    `;
    return recipient.recipient_code;
  }

  if (method === 'bank') {
    const bankCode = String(profile.bank_code || '');
    const accountNumber = String(profile.bank_account_number || '');
    if (!bankCode || !accountNumber) throw new Error('Bank code and account number are required');
    const recipient = await createTransferRecipient({
      type: 'basa',
      name,
      accountNumber,
      bankCode,
      currency: 'KES',
    });
    await sql`
      UPDATE organizer_profiles
      SET paystack_recipient_code = ${recipient.recipient_code},
          payout_updated_at = now()
      WHERE user_id = ${organizerId}
    `;
    return recipient.recipient_code;
  }

  throw new Error('Set a payout method (M-Pesa or bank) before requesting payout');
}

export async function queuePayoutForEvent(eventId: string, opts?: { force?: boolean }) {
  const earnings = await getEventEarnings(eventId);
  if (!earnings) throw new Error('Event not found');
  if (earnings.net < MIN_PAYOUT_KES) {
    throw new Error(`Net payout KES ${earnings.net} is below minimum KES ${MIN_PAYOUT_KES}`);
  }

  const [existing] = await sql`
    SELECT id, status, net_kes FROM organizer_payouts WHERE event_id = ${eventId}
  `;
  if (existing) {
    if (existing.status === 'paid') throw new Error('This event was already paid out');
    if (existing.status === 'processing' && !opts?.force) {
      throw new Error('Payout is already processing');
    }
    if (existing.status === 'pending' || existing.status === 'failed') {
      return { payoutId: existing.id as string, created: false };
    }
  }

  const [row] = await sql`
    INSERT INTO organizer_payouts (
      organizer_id, event_id, gross_kes, refunded_kes, platform_fee_kes, net_kes, status
    ) VALUES (
      ${earnings.organizerId},
      ${eventId},
      ${earnings.gross},
      ${earnings.refunded},
      ${earnings.fee},
      ${earnings.net},
      'pending'
    )
    ON CONFLICT (event_id) DO NOTHING
    RETURNING id
  `;
  if (row) return { payoutId: row.id as string, created: true };

  const [again] = await sql`SELECT id FROM organizer_payouts WHERE event_id = ${eventId}`;
  return { payoutId: again.id as string, created: false };
}

export async function processPayout(payoutId: string) {
  const [payout] = await sql`
    SELECT p.*, e.title AS event_title
    FROM organizer_payouts p
    JOIN events e ON e.id = p.event_id
    WHERE p.id = ${payoutId}
  `;
  if (!payout) throw new Error('Payout not found');
  if (payout.status === 'paid') return { status: 'paid' as const, payout };

  if (payout.status === 'processing' && payout.paystack_transfer_code) {
    try {
      const t = await fetchTransfer(payout.paystack_transfer_code as string);
      if (t.status === 'success') {
        await sql`
          UPDATE organizer_payouts
          SET status = 'paid', paid_at = now(), processed_at = now()
          WHERE id = ${payoutId}
        `;
        return { status: 'paid' as const, payout };
      }
    } catch {
      /* retry transfer */
    }
    // Already processing with no confirmed success yet — do not re-enter
    // the pending/failed branch below, which would call Paystack again.
    return { status: 'processing' as const, payout };
  }

  const net = Number(payout.net_kes);
  if (net < MIN_PAYOUT_KES) throw new Error('Amount below minimum');

  const recipientCode = await ensureRecipient(payout.organizer_id as string);
  const reference = payout.paystack_reference || `payout_${nanoid(12)}`;

  // Atomically claim the payout before calling Paystack: the WHERE guard
  // means only ONE concurrent call can actually flip pending/failed ->
  // processing. If two requests race (double-click, or a cron overlapping
  // a manual request), the loser gets zero rows back here and bails out
  // instead of also initiating a second real money transfer.
  const [claimed] = await sql`
    UPDATE organizer_payouts
    SET status = 'processing',
        paystack_reference = ${reference},
        processed_at = now(),
        failure_reason = NULL
    WHERE id = ${payoutId} AND status IN ('pending', 'failed')
    RETURNING id
  `;
  if (!claimed) {
    // Someone else already claimed it between our read above and now.
    return { status: 'processing' as const, payout };
  }

  try {
    const transfer = await initiateTransfer({
      amountKes: net,
      recipientCode,
      reference,
      reason: `TicketHub payout: ${payout.event_title}`,
    });

    if (transfer.status === 'success') {
      await sql`
        UPDATE organizer_payouts
        SET status = 'paid',
            paystack_transfer_code = ${transfer.transfer_code},
            paid_at = now()
        WHERE id = ${payoutId}
      `;
      return { status: 'paid' as const, transfer };
    }

    await sql`
      UPDATE organizer_payouts
      SET status = 'processing',
          paystack_transfer_code = ${transfer.transfer_code}
      WHERE id = ${payoutId}
    `;
    return { status: 'processing' as const, transfer };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Transfer failed';
    await sql`
      UPDATE organizer_payouts
      SET status = 'failed', failure_reason = ${message}
      WHERE id = ${payoutId}
    `;
    throw err;
  }
}

export async function listAutoPayoutCandidates(limit = 50) {
  const cutoff = new Date(Date.now() - PAYOUT_DELAY_HOURS * 60 * 60 * 1000).toISOString();
  return sql`
    SELECT
      e.id AS event_id,
      e.organizer_id,
      e.title,
      COALESCE(e.end_at, e.start_at) AS ended_at,
      COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status = 'paid'), 0) AS gross,
      COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status = 'refunded'), 0) AS refunded
    FROM events e
    LEFT JOIN orders o ON o.event_id = e.id
    LEFT JOIN organizer_payouts op ON op.event_id = e.id
    JOIN organizer_profiles pr ON pr.user_id = e.organizer_id
    WHERE e.status IN ('published', 'completed', 'cancelled')
      AND COALESCE(e.end_at, e.start_at) < ${cutoff}
      AND pr.paystack_recipient_code IS NOT NULL
      AND (op.id IS NULL OR op.status IN ('pending', 'failed'))
    GROUP BY e.id, pr.paystack_recipient_code, op.id, op.status
    HAVING COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status = 'paid'), 0)
         - COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status = 'refunded'), 0) > 0
    ORDER BY COALESCE(e.end_at, e.start_at) ASC
    LIMIT ${limit}
  `;
}

'@
Write-ClaudeFile "lib\payouts.ts" $content
if (-not (Test-Path -LiteralPath "lib\payouts.ts")) {
    Write-Host "  ERROR: file was not created!" -ForegroundColor Red
    $script:anyFailed = $true
} else {
    Write-Host "  Confirmed on disk." -ForegroundColor Green
}

Write-Host "Writing: app\api\organizer\payouts\route.ts" -ForegroundColor Cyan
$content = @'
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';
import { queuePayoutForEvent, processPayout, getEventEarnings } from '@/lib/payouts';

export async function GET() {
  const session = await getSession();
  if (!session || (session.role !== 'organizer' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }
  const rows = await sql`
    SELECT p.id, p.event_id, p.gross_kes, p.refunded_kes, p.platform_fee_kes, p.net_kes,
           p.status, p.failure_reason, p.requested_at, p.paid_at, e.title AS event_title
    FROM organizer_payouts p
    JOIN events e ON e.id = p.event_id
    WHERE p.organizer_id = ${session.userId}
    ORDER BY p.requested_at DESC
    LIMIT 50
  `;
  return NextResponse.json({ payouts: rows });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== 'organizer' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const eventId = body.eventId as string;
    const doProcess = body.process !== false;
    if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });

    const [event] = await sql`SELECT id, organizer_id FROM events WHERE id = ${eventId}`;
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    if (event.organizer_id !== session.userId && session.role !== 'admin') {
      return NextResponse.json({ error: 'Not your event' }, { status: 403 });
    }

    const earnings = await getEventEarnings(eventId);
    if (!earnings) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const { payoutId } = await queuePayoutForEvent(eventId);
    let result: { status: string } = { status: 'pending' };
    if (doProcess) {
      result = await processPayout(payoutId);
    }
    return NextResponse.json({ payoutId, ...result, net: earnings.net });
  } catch (err: unknown) {
    console.error('payout request:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Payout failed' },
      { status: 400 }
    );
  }
}

'@
Write-ClaudeFile "app\api\organizer\payouts\route.ts" $content
if (-not (Test-Path -LiteralPath "app\api\organizer\payouts\route.ts")) {
    Write-Host "  ERROR: file was not created!" -ForegroundColor Red
    $script:anyFailed = $true
} else {
    Write-Host "  Confirmed on disk." -ForegroundColor Green
}

Write-Host "Writing: app\api\admin\payouts\[id]\route.ts" -ForegroundColor Cyan
$content = @'
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { processPayout } from '@/lib/payouts';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }
  const { id } = await params;
  try {
    const result = await processPayout(id);
    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 400 }
    );
  }
}

'@
Write-ClaudeFile "app\api\admin\payouts\[id]\route.ts" $content
if (-not (Test-Path -LiteralPath "app\api\admin\payouts\[id]\route.ts")) {
    Write-Host "  ERROR: file was not created!" -ForegroundColor Red
    $script:anyFailed = $true
} else {
    Write-Host "  Confirmed on disk." -ForegroundColor Green
}

Write-Host "Writing: app\api\organizer\payout-account\route.ts" -ForegroundColor Cyan
$content = @'
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { createTransferRecipient } from '@/lib/paystack';

export async function GET() {
  const session = await getSession();
  if (!session || (session.role !== 'organizer' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }
  const [row] = await sql`
    SELECT payout_method, payout_name, payout_phone, bank_code, bank_account_number,
           paystack_recipient_code IS NOT NULL AS recipient_ready, payout_updated_at
    FROM organizer_profiles WHERE user_id = ${session.userId}
  `;
  return NextResponse.json(row || {});
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== 'organizer' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const method = body.method === 'bank' ? 'bank' : 'mpesa';
    const payoutName = String(body.payoutName || '').trim();
    if (!payoutName) {
      return NextResponse.json({ error: 'Account name is required' }, { status: 400 });
    }

    let payoutPhone: string | null = null;
    let bankCode: string | null = null;
    let bankAccountNumber: string | null = null;
    let recipientCode: string | null = null;

    if (method === 'mpesa') {
      payoutPhone = String(body.payoutPhone || '').replace(/\s+/g, '');
      if (!payoutPhone || payoutPhone.length < 9) {
        return NextResponse.json({ error: 'Valid M-Pesa number required' }, { status: 400 });
      }
      let account = payoutPhone.replace(/^\+/, '');
      if (account.startsWith('0')) account = '254' + account.slice(1);
      if (!account.startsWith('254')) account = '254' + account;

      const recipient = await createTransferRecipient({
        type: 'mobile_money',
        name: payoutName,
        accountNumber: account,
        bankCode: 'MPESA',
        currency: 'KES',
      });
      recipientCode = recipient.recipient_code;
      payoutPhone = account;
    } else {
      bankCode = String(body.bankCode || '').trim();
      bankAccountNumber = String(body.bankAccountNumber || '').trim();
      if (!bankCode || !bankAccountNumber) {
        return NextResponse.json({ error: 'Bank code and account number required' }, { status: 400 });
      }
      const recipient = await createTransferRecipient({
        type: 'basa',
        name: payoutName,
        accountNumber: bankAccountNumber,
        bankCode,
        currency: 'KES',
      });
      recipientCode = recipient.recipient_code;
    }

    await sql`
      INSERT INTO organizer_profiles (
        user_id, payout_method, payout_name, payout_phone,
        bank_code, bank_account_number, paystack_recipient_code, payout_updated_at
      ) VALUES (
        ${session.userId}, ${method}, ${payoutName}, ${payoutPhone},
        ${bankCode}, ${bankAccountNumber}, ${recipientCode}, now()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        payout_method = EXCLUDED.payout_method,
        payout_name = EXCLUDED.payout_name,
        payout_phone = EXCLUDED.payout_phone,
        bank_code = EXCLUDED.bank_code,
        bank_account_number = EXCLUDED.bank_account_number,
        paystack_recipient_code = EXCLUDED.paystack_recipient_code,
        payout_updated_at = now()
    `;

    return NextResponse.json({ ok: true, recipientReady: true });
  } catch (err: unknown) {
    console.error('payout-account save:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not save payout account' },
      { status: 500 }
    );
  }
}

'@
Write-ClaudeFile "app\api\organizer\payout-account\route.ts" $content
if (-not (Test-Path -LiteralPath "app\api\organizer\payout-account\route.ts")) {
    Write-Host "  ERROR: file was not created!" -ForegroundColor Red
    $script:anyFailed = $true
} else {
    Write-Host "  Confirmed on disk." -ForegroundColor Green
}

Write-Host "Writing: app\api\cron\process-payouts\route.ts" -ForegroundColor Cyan
$content = @'
import { NextRequest, NextResponse } from 'next/server';
import {
  listAutoPayoutCandidates,
  queuePayoutForEvent,
  processPayout,
  computeNet,
  MIN_PAYOUT_KES,
} from '@/lib/payouts';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const candidates = await listAutoPayoutCandidates(30);
  let paid = 0;
  let processing = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of candidates) {
    try {
      const { net } = computeNet(Number(row.gross), Number(row.refunded));
      if (net < MIN_PAYOUT_KES) {
        skipped++;
        continue;
      }
      const { payoutId } = await queuePayoutForEvent(row.event_id as string);
      const result = await processPayout(payoutId);
      if (result.status === 'paid') paid++;
      else processing++;
    } catch (err: unknown) {
      failed++;
      errors.push(`${row.event_id}: ${err instanceof Error ? err.message : 'error'}`);
    }
  }

  return NextResponse.json({
    candidates: candidates.length,
    paid,
    processing,
    skipped,
    failed,
    errors: errors.slice(0, 10),
  });
}

'@
Write-ClaudeFile "app\api\cron\process-payouts\route.ts" $content
if (-not (Test-Path -LiteralPath "app\api\cron\process-payouts\route.ts")) {
    Write-Host "  ERROR: file was not created!" -ForegroundColor Red
    $script:anyFailed = $true
} else {
    Write-Host "  Confirmed on disk." -ForegroundColor Green
}

Write-Host "Writing: components\PayoutAccountForm.tsx" -ForegroundColor Cyan
$content = @'
'use client';

import { useEffect, useState } from 'react';

export default function PayoutAccountForm() {
  const [method, setMethod] = useState<'mpesa' | 'bank'>('mpesa');
  const [payoutName, setPayoutName] = useState('');
  const [payoutPhone, setPayoutPhone] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/organizer/payout-account')
      .then((r) => r.json())
      .then((d) => {
        if (d.payout_method) setMethod(d.payout_method === 'bank' ? 'bank' : 'mpesa');
        if (d.payout_name) setPayoutName(d.payout_name);
        if (d.payout_phone) setPayoutPhone(d.payout_phone);
        if (d.bank_code) setBankCode(d.bank_code);
        if (d.bank_account_number) setBankAccountNumber(d.bank_account_number);
        setReady(Boolean(d.recipient_ready));
      })
      .catch(() => {});
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr('');
    setMsg('');
    try {
      const res = await fetch('/api/organizer/payout-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, payoutName, payoutPhone, bankCode, bankAccountNumber }),
      });
      const data = await res.json();
      if (!res.ok) setErr(data.error || 'Save failed');
      else {
        setReady(true);
        setMsg('Payout account saved and verified with Paystack.');
      }
    } catch {
      setErr('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-8">
      <h2 className="text-lg font-bold text-white mb-1">Payout destination</h2>
      <p className="text-sm text-gray-400 mb-4">
        Net earnings (after 10% fee) are paid via Paystack, usually ~48h after the event ends.
        {ready && <span className="text-emerald-400 font-semibold"> · Account ready</span>}
      </p>
      <form onSubmit={save} className="space-y-3">
        <div className="flex gap-2">
          <button type="button" onClick={() => setMethod('mpesa')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold ${method === 'mpesa' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
            M-Pesa
          </button>
          <button type="button" onClick={() => setMethod('bank')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold ${method === 'bank' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
            Bank
          </button>
        </div>
        <input required value={payoutName} onChange={(e) => setPayoutName(e.target.value)}
          placeholder="Account name (as registered)"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm" />
        {method === 'mpesa' ? (
          <input required value={payoutPhone} onChange={(e) => setPayoutPhone(e.target.value)}
            placeholder="M-Pesa number e.g. 0712 345 678"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm" />
        ) : (
          <>
            <input required value={bankCode} onChange={(e) => setBankCode(e.target.value)}
              placeholder="Bank code (Paystack Kenya)"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm" />
            <input required value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)}
              placeholder="Account number"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm" />
          </>
        )}
        {err && <p className="text-red-400 text-sm">{err}</p>}
        {msg && <p className="text-emerald-400 text-sm">{msg}</p>}
        <button type="submit" disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm">
          {loading ? 'Saving…' : ready ? 'Update payout account' : 'Save payout account'}
        </button>
      </form>
    </div>
  );
}

'@
Write-ClaudeFile "components\PayoutAccountForm.tsx" $content
if (-not (Test-Path -LiteralPath "components\PayoutAccountForm.tsx")) {
    Write-Host "  ERROR: file was not created!" -ForegroundColor Red
    $script:anyFailed = $true
} else {
    Write-Host "  Confirmed on disk." -ForegroundColor Green
}

Write-Host "Writing: components\RequestPayoutButton.tsx" -ForegroundColor Cyan
$content = @'
'use client';

import { useState } from 'react';

export default function RequestPayoutButton({
  eventId,
  netKes,
  disabledReason,
}: {
  eventId: string;
  netKes: number;
  disabledReason?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function request() {
    if (disabledReason) return;
    setLoading(true);
    setMsg('');
    setErr('');
    try {
      const res = await fetch('/api/organizer/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, process: true }),
      });
      const data = await res.json();
      if (!res.ok) setErr(data.error || 'Failed');
      else setMsg(data.status === 'paid' ? 'Paid out successfully' : `Status: ${data.status}`);
    } catch {
      setErr('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="text-right">
      <button type="button" disabled={loading || Boolean(disabledReason) || netKes < 50}
        onClick={() => void request()}
        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white">
        {loading ? '…' : 'Request payout'}
      </button>
      {disabledReason && <div className="text-[10px] text-gray-500 mt-1">{disabledReason}</div>}
      {msg && <div className="text-[10px] text-emerald-400 mt-1">{msg}</div>}
      {err && <div className="text-[10px] text-red-400 mt-1">{err}</div>}
    </div>
  );
}

'@
Write-ClaudeFile "components\RequestPayoutButton.tsx" $content
if (-not (Test-Path -LiteralPath "components\RequestPayoutButton.tsx")) {
    Write-Host "  ERROR: file was not created!" -ForegroundColor Red
    $script:anyFailed = $true
} else {
    Write-Host "  Confirmed on disk." -ForegroundColor Green
}

Write-Host "Writing: components\AdminProcessPayoutButton.tsx" -ForegroundColor Cyan
$content = @'
'use client';

import { useState } from 'react';

export default function AdminProcessPayoutButton({ payoutId }: { payoutId: string }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  async function run() {
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(`/api/admin/payouts/${payoutId}`, { method: 'POST' });
      const data = await res.json();
      setMsg(res.ok ? `OK: ${data.status}` : data.error || 'Failed');
    } catch {
      setMsg('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={() => void run()} disabled={loading}
        className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-semibold">
        {loading ? '…' : 'Process transfer'}
      </button>
      {msg && <div className="text-[10px] text-gray-400 mt-1">{msg}</div>}
    </div>
  );
}

'@
Write-ClaudeFile "components\AdminProcessPayoutButton.tsx" $content
if (-not (Test-Path -LiteralPath "components\AdminProcessPayoutButton.tsx")) {
    Write-Host "  ERROR: file was not created!" -ForegroundColor Red
    $script:anyFailed = $true
} else {
    Write-Host "  Confirmed on disk." -ForegroundColor Green
}

Write-Host "Writing: migrations\006_organizer_payouts.sql" -ForegroundColor Cyan
$content = @'
ALTER TABLE organizer_profiles
  ADD COLUMN IF NOT EXISTS payout_method TEXT,
  ADD COLUMN IF NOT EXISTS payout_name TEXT,
  ADD COLUMN IF NOT EXISTS payout_phone TEXT,
  ADD COLUMN IF NOT EXISTS bank_code TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS paystack_recipient_code TEXT,
  ADD COLUMN IF NOT EXISTS payout_updated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS organizer_payouts (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id           UUID NOT NULL REFERENCES users(id),
  event_id               UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  gross_kes              NUMERIC NOT NULL DEFAULT 0,
  refunded_kes           NUMERIC NOT NULL DEFAULT 0,
  platform_fee_kes       NUMERIC NOT NULL DEFAULT 0,
  net_kes                NUMERIC NOT NULL DEFAULT 0,
  status                 TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'cancelled')),
  paystack_reference     TEXT UNIQUE,
  paystack_transfer_code TEXT,
  failure_reason         TEXT,
  requested_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at           TIMESTAMPTZ,
  paid_at                TIMESTAMPTZ,
  UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS idx_organizer_payouts_organizer
  ON organizer_payouts (organizer_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_organizer_payouts_status
  ON organizer_payouts (status) WHERE status IN ('pending', 'processing', 'failed');

'@
Write-ClaudeFile "migrations\006_organizer_payouts.sql" $content
if (-not (Test-Path -LiteralPath "migrations\006_organizer_payouts.sql")) {
    Write-Host "  ERROR: file was not created!" -ForegroundColor Red
    $script:anyFailed = $true
} else {
    Write-Host "  Confirmed on disk." -ForegroundColor Green
}

Write-Host "Writing: app\admin\payouts\page.tsx" -ForegroundColor Cyan
$content = @'
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { computeNet, PLATFORM_FEE_RATE } from '@/lib/payouts';
import AdminProcessPayoutButton from '@/components/AdminProcessPayoutButton';

export const dynamic = 'force-dynamic';

export default async function AdminPayoutsPage() {
  const session = await getSession();
  if (!session || session.role !== 'admin') redirect('/login');

  const organizers = await sql`
    SELECT u.id, u.full_name, u.email,
      COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status = 'paid'), 0) AS gross,
      COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status = 'refunded'), 0) AS refunded
    FROM users u
    JOIN events e ON e.organizer_id = u.id
    LEFT JOIN orders o ON o.event_id = e.id
    WHERE u.role = 'organizer'
    GROUP BY u.id
    ORDER BY gross DESC
  `;

  const pendingPayouts = await sql`
    SELECT p.id, p.net_kes, p.status, p.failure_reason, p.requested_at,
           e.title AS event_title, u.full_name, u.email
    FROM organizer_payouts p
    JOIN events e ON e.id = p.event_id
    JOIN users u ON u.id = p.organizer_id
    WHERE p.status IN ('pending', 'processing', 'failed')
    ORDER BY p.requested_at ASC
    LIMIT 50
  `;

  let totalGross = 0;
  let totalRefunded = 0;
  for (const o of organizers) {
    totalGross += Number(o.gross);
    totalRefunded += Number(o.refunded);
  }
  const totalFees = Math.round((totalGross - totalRefunded) * PLATFORM_FEE_RATE * 100) / 100;
  const totalNet = Math.round((totalGross - totalRefunded - totalFees) * 100) / 100;

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 text-white">
      <Link href="/admin/dashboard" className="text-sm text-indigo-400 hover:underline">&larr; Admin</Link>
      <h1 className="text-2xl font-extrabold mt-2 mb-6">Platform payouts</h1>

      <div className="flex flex-wrap gap-2 mb-6">
        <a
          href="https://dashboard.paystack.com/#/transfers"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition"
        >
          Paystack dashboard → Transfers
        </a>
        <a
          href="https://dashboard.paystack.com/#/transfers/recipients"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 text-sm font-semibold px-4 py-2.5 rounded-xl transition"
        >
          Recipients
        </a>
      </div>
      <div className="flex gap-3 flex-wrap mb-8">
        {[
          { label: 'Gross paid', value: totalGross, color: 'text-indigo-400' },
          { label: 'Platform fees (10%)', value: totalFees, color: 'text-amber-400' },
          { label: 'Organizer net', value: totalNet, color: 'text-emerald-400' },
        ].map((s) => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-3 min-w-[140px]">
            <div className={`text-xl font-bold ${s.color}`}>
              KES {s.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-gray-400">{s.label}</div>
          </div>
        ))}
      </div>
      <h2 className="text-lg font-bold mb-3">Queue (pending / failed)</h2>
      {pendingPayouts.length === 0 ? (
        <p className="text-gray-500 text-sm mb-8">No payouts waiting.</p>
      ) : (
        <ul className="space-y-2 mb-8">
          {pendingPayouts.map((p) => (
            <li key={p.id as string} className="flex justify-between items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
              <div>
                <div className="font-semibold text-sm">{p.event_title as string}</div>
                <div className="text-xs text-gray-500">
                  {p.full_name as string} · {p.email as string} · {p.status as string}
                  {p.failure_reason ? ` · ${p.failure_reason}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-emerald-400 font-bold text-sm">KES {Number(p.net_kes).toLocaleString()}</span>
                <AdminProcessPayoutButton payoutId={p.id as string} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <h2 className="text-lg font-bold mb-3">Organizers</h2>
      <ul className="space-y-2">
        {organizers.map((o) => {
          const c = computeNet(Number(o.gross), Number(o.refunded));
          return (
            <li key={o.id as string} className="flex justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
              <div>
                <div className="font-semibold text-sm">{(o.full_name as string) || 'Organizer'}</div>
                <div className="text-xs text-gray-500">{o.email as string}</div>
              </div>
              <div className="text-right text-sm">
                <div className="text-emerald-400 font-bold">KES {c.net.toLocaleString(undefined, { maximumFractionDigits: 0 })} net</div>
                <div className="text-xs text-amber-400">KES {c.fee.toLocaleString(undefined, { maximumFractionDigits: 0 })} fees</div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

'@
Write-ClaudeFile "app\admin\payouts\page.tsx" $content
if (-not (Test-Path -LiteralPath "app\admin\payouts\page.tsx")) {
    Write-Host "  ERROR: file was not created!" -ForegroundColor Red
    $script:anyFailed = $true
} else {
    Write-Host "  Confirmed on disk." -ForegroundColor Green
}

Write-Host "Writing: app\organizer\payouts\page.tsx" -ForegroundColor Cyan
$content = @'
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import PayoutAccountForm from '@/components/PayoutAccountForm';
import RequestPayoutButton from '@/components/RequestPayoutButton';
import { computeNet, PLATFORM_FEE_RATE } from '@/lib/payouts';

export const dynamic = 'force-dynamic';

export default async function PayoutsPage() {
  const session = await getSession();
  if (!session?.userId) redirect('/login?next=/organizer/payouts');
  if (session.role !== 'organizer' && session.role !== 'admin') redirect('/');

  const events = await sql`
    SELECT
      e.id, e.title, e.status, e.start_at, e.end_at,
      COUNT(o.id) FILTER (WHERE o.payment_status = 'paid') AS paid_orders,
      COUNT(o.id) FILTER (WHERE o.payment_status = 'refunded') AS refunded_orders,
      COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status = 'paid'), 0) AS gross_revenue,
      COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status = 'refunded'), 0) AS refunded_amount
    FROM events e
    LEFT JOIN orders o ON o.event_id = e.id
    WHERE e.organizer_id = ${session.userId}
    GROUP BY e.id
    ORDER BY e.start_at DESC
  `;

  const payouts = await sql`
    SELECT event_id, status, net_kes, paid_at, failure_reason
    FROM organizer_payouts WHERE organizer_id = ${session.userId}
  `;
  const payoutByEvent = new Map(payouts.map((p) => [p.event_id as string, p]));

  let totalGross = 0;
  let totalRefunded = 0;
  let totalNet = 0;
  for (const e of events) {
    const c = computeNet(Number(e.gross_revenue), Number(e.refunded_amount));
    totalGross += c.gross;
    totalRefunded += c.refunded;
    totalNet += c.net;
  }
  const totalFees = Math.round((totalGross - totalRefunded) * PLATFORM_FEE_RATE * 100) / 100;

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 text-white">
      <Link href="/organizer/dashboard" className="text-sm text-indigo-400 hover:underline">&larr; Dashboard</Link>
      <h1 className="text-2xl font-extrabold mt-2 mb-6">Payouts</h1>
      <PayoutAccountForm />
      <div className="flex gap-3 flex-wrap mb-6">
        {[
          { label: 'Gross (paid)', value: totalGross, color: 'text-indigo-400' },
          { label: 'Fee (10%)', value: totalFees, color: 'text-amber-400' },
          { label: 'Refunded', value: totalRefunded, color: 'text-red-400' },
          { label: 'Net earnings', value: totalNet, color: 'text-emerald-400' },
        ].map((s) => (
          <div key={s.label} className="flex-1 min-w-[120px] bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
            <div className={`text-xl font-bold ${s.color}`}>
              KES {s.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
      <h2 className="text-lg font-bold mb-3">Per event</h2>
      <ul className="space-y-2">
        {events.map((e) => {
          const c = computeNet(Number(e.gross_revenue), Number(e.refunded_amount));
          const existing = payoutByEvent.get(e.id as string);
          const ended = new Date(String(e.end_at || e.start_at)).getTime() < Date.now();
          let disabledReason: string | null = null;
          if (existing?.status === 'paid') disabledReason = 'Already paid';
          else if (existing?.status === 'processing') disabledReason = 'Processing…';
          else if (!ended) disabledReason = 'Available after event ends';
          else if (c.net < 50) disabledReason = 'Below minimum';
          return (
            <li key={e.id as string} className="flex justify-between gap-3 items-center bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
              <div>
                <div className="font-semibold text-sm">{e.title as string}</div>
                <div className="text-xs text-gray-500">
                  {new Date(String(e.start_at)).toLocaleDateString()} · {e.status as string} · {Number(e.paid_orders)} paid
                  {existing && <span className="ml-2 text-indigo-300">· payout {existing.status as string}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-bold text-emerald-400 text-sm">
                    KES {c.net.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    fee {c.fee.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <RequestPayoutButton eventId={e.id as string} netKes={c.net} disabledReason={disabledReason} />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-gray-500 mt-6">
        Net = (paid − refunded) − 10% platform fee. Automatic payouts run ~48 hours after the event ends if your account is saved.
      </p>
    </div>
  );
}

'@
Write-ClaudeFile "app\organizer\payouts\page.tsx" $content
if (-not (Test-Path -LiteralPath "app\organizer\payouts\page.tsx")) {
    Write-Host "  ERROR: file was not created!" -ForegroundColor Red
    $script:anyFailed = $true
} else {
    Write-Host "  Confirmed on disk." -ForegroundColor Green
}


Write-Host ""
Write-Host "Verifying no BOM/mojibake remains..." -ForegroundColor Cyan
$bad = Get-ChildItem -Recurse -Include *.tsx,*.ts,*.sql | Select-String -Pattern "ï»¿" -SimpleMatch
if ($bad) {
    Write-Host "WARNING: corrupted characters found in:" -ForegroundColor Yellow
    $bad | ForEach-Object { Write-Host "  $($_.Path)" }
} else {
    Write-Host "Clean." -ForegroundColor Green
}

Write-Host ""
if ($script:anyFailed) {
    Write-Host "SOME FILES FAILED TO WRITE - do not push yet, share this output." -ForegroundColor Red
} else {
    Write-Host "All files confirmed written successfully." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Green
    Write-Host "  git add ."
    Write-Host "  git commit -m ""Restore payouts feature (lost in a stale force-push), add double-transfer guard"""
    Write-Host "  git push origin main"
}
