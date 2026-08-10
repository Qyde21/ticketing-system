# Run this from your project root:
# C:\Users\USER\Downloads\ticketing-system-main\ticketing-system-main
# Usage: powershell -ExecutionPolicy Bypass -File add-flash-sales.ps1

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

function Write-ClaudeFile($path, $content) {
    $dir = Split-Path $path -Parent
    if ($dir -and -not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    [System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
    Write-Host "  Wrote: $path" -ForegroundColor Green
}

Write-Host "1. Database migration file..." -ForegroundColor Cyan
$migration = @'
-- Flash sale support for ticket_types.
-- A flash sale is active when: flash_sale_price_kes IS NOT NULL,
-- now() is between flash_sale_starts_at and flash_sale_ends_at, and
-- (flash_sale_quantity_cap IS NULL OR flash_sale_quantity_sold < flash_sale_quantity_cap).

ALTER TABLE ticket_types
  ADD COLUMN IF NOT EXISTS flash_sale_price_kes NUMERIC,
  ADD COLUMN IF NOT EXISTS flash_sale_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS flash_sale_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS flash_sale_quantity_cap INTEGER,
  ADD COLUMN IF NOT EXISTS flash_sale_quantity_sold INTEGER NOT NULL DEFAULT 0;

'@
Write-ClaudeFile "migrations\002_flash_sales.sql" $migration

Write-Host "2. Flash sale API route..." -ForegroundColor Cyan
$flashApi = @'
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

async function getOwnedTicketType(ticketTypeId: string, userId: string, role: string) {
  const rows = await sql`
    SELECT t.id, t.event_id, t.name, t.price_kes, e.organizer_id
    FROM ticket_types t
    JOIN events e ON e.id = t.event_id
    WHERE t.id = ${ticketTypeId}
  `;
  const row = rows[0];
  if (!row) return { error: 'Ticket type not found', status: 404 } as const;
  if (row.organizer_id !== userId && role !== 'admin') {
    return { error: 'Not authorized for this ticket type', status: 403 } as const;
  }
  return { row };
}

// Set (or update) a flash sale on a ticket tier.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { flashPriceKes, startsAt, endsAt, quantityCap } = await req.json();

    if (flashPriceKes === undefined || !startsAt || !endsAt) {
      return NextResponse.json({ error: 'flashPriceKes, startsAt and endsAt are required' }, { status: 400 });
    }

    const check = await getOwnedTicketType(id, session.userId, session.role);
    if ('error' in check) {
      return NextResponse.json({ error: check.error }, { status: check.status });
    }

    const numericPrice = Number(flashPriceKes);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return NextResponse.json({ error: 'flashPriceKes must be a non-negative number' }, { status: 400 });
    }
    if (numericPrice >= Number(check.row.price_kes)) {
      return NextResponse.json({ error: 'Flash sale price must be lower than the regular price' }, { status: 400 });
    }

    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return NextResponse.json({ error: 'endsAt must be after startsAt' }, { status: 400 });
    }

    const cap = quantityCap === undefined || quantityCap === null || quantityCap === ''
      ? null
      : Number(quantityCap);
    if (cap !== null && (!Number.isInteger(cap) || cap < 1)) {
      return NextResponse.json({ error: 'quantityCap must be a positive whole number' }, { status: 400 });
    }

    const [updated] = await sql`
      UPDATE ticket_types
      SET flash_sale_price_kes = ${numericPrice},
          flash_sale_starts_at = ${start.toISOString()},
          flash_sale_ends_at = ${end.toISOString()},
          flash_sale_quantity_cap = ${cap},
          flash_sale_quantity_sold = 0
      WHERE id = ${id}
      RETURNING id, name, flash_sale_price_kes, flash_sale_starts_at, flash_sale_ends_at, flash_sale_quantity_cap, flash_sale_quantity_sold
    `;

    return NextResponse.json({ success: true, ticketType: updated });
  } catch (err: any) {
    console.error('Flash sale creation error:', err);
    return NextResponse.json({ error: err.message || 'Something went wrong' }, { status: 500 });
  }
}

// Cancel an active flash sale on a ticket tier.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const check = await getOwnedTicketType(id, session.userId, session.role);
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  await sql`
    UPDATE ticket_types
    SET flash_sale_price_kes = NULL,
        flash_sale_starts_at = NULL,
        flash_sale_ends_at = NULL,
        flash_sale_quantity_cap = NULL,
        flash_sale_quantity_sold = 0
    WHERE id = ${id}
  `;

  return NextResponse.json({ success: true });
}

'@
Write-ClaudeFile "app\api\ticket-types\[id]\flash-sale\route.ts" $flashApi

Write-Host "3. Countdown component..." -ForegroundColor Cyan
$countdown = @'
'use client';

import { useEffect, useState } from 'react';

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Ended';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export default function FlashSaleCountdown({ endsAt }: { endsAt: string }) {
  const [remaining, setRemaining] = useState<string>('');
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    const end = new Date(endsAt).getTime();

    const tick = () => {
      const diff = end - Date.now();
      setRemaining(formatRemaining(diff));
      if (diff <= 0) setEnded(true);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  if (ended) return null;

  return (
    <span className="inline-flex items-center gap-1 text-amber-400 font-bold">
      &middot; Ends in {remaining}
    </span>
  );
}

'@
Write-ClaudeFile "components\FlashSaleCountdown.tsx" $countdown

Write-Host "4. Organizer flash sales page..." -ForegroundColor Cyan
$flashPage = @'
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import FlashSaleManager from './FlashSaleManager';

export const dynamic = 'force-dynamic';

export default async function FlashSalesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  if (!session) {
    return <div className="max-w-2xl mx-auto py-12 px-4 text-white">Unauthorized.</div>;
  }

  const [event] = await sql`SELECT id, title, organizer_id FROM events WHERE id = ${id}`;
  if (!event) return <div className="max-w-2xl mx-auto py-12 px-4 text-white">Event not found.</div>;

  if (event.organizer_id !== session.userId && session.role !== 'admin') {
    return <div className="max-w-2xl mx-auto py-12 px-4 text-white">Not authorized for this event.</div>;
  }

  const ticketTypes = await sql`
    SELECT id, name, price_kes, quantity_total, quantity_sold,
           flash_sale_price_kes, flash_sale_starts_at, flash_sale_ends_at,
           flash_sale_quantity_cap, flash_sale_quantity_sold
    FROM ticket_types
    WHERE event_id = ${id}
    ORDER BY price_kes ASC
  `;

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 text-white">
      <Link href="/organizer/dashboard" className="text-sm text-indigo-400 hover:underline">
        &larr; Back to dashboard
      </Link>
      <h1 className="text-2xl font-extrabold mt-2 mb-1">Flash Sales</h1>
      <p className="text-gray-400 text-sm mb-6">{event.title} &middot; Discount a ticket tier for a limited time and/or limited quantity — no code needed at checkout.</p>

      <FlashSaleManager ticketTypes={ticketTypes as any} />
    </div>
  );
}

'@
Write-ClaudeFile "app\organizer\events\[id]\flash-sales\page.tsx" $flashPage

Write-Host "5. Flash sale manager component..." -ForegroundColor Cyan
$flashManager = @'
'use client';

import { useState } from 'react';

interface TicketType {
  id: string;
  name: string;
  price_kes: number;
  quantity_total: number;
  quantity_sold: number;
  flash_sale_price_kes: number | null;
  flash_sale_starts_at: string | null;
  flash_sale_ends_at: string | null;
  flash_sale_quantity_cap: number | null;
  flash_sale_quantity_sold: number;
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isFlashActive(t: TicketType): boolean {
  if (!t.flash_sale_price_kes || !t.flash_sale_starts_at || !t.flash_sale_ends_at) return false;
  const now = new Date();
  const capReached = t.flash_sale_quantity_cap !== null && t.flash_sale_quantity_sold >= t.flash_sale_quantity_cap;
  return now >= new Date(t.flash_sale_starts_at) && now <= new Date(t.flash_sale_ends_at) && !capReached;
}

export default function FlashSaleManager({ ticketTypes }: { ticketTypes: TicketType[] }) {
  const [tiers, setTiers] = useState(ticketTypes);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ price: '', startsAt: '', endsAt: '', cap: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const startEdit = (t: TicketType) => {
    setEditingId(t.id);
    setError('');
    setForm({
      price: t.flash_sale_price_kes ? String(t.flash_sale_price_kes) : '',
      startsAt: toDatetimeLocal(t.flash_sale_starts_at) || toDatetimeLocal(new Date().toISOString()),
      endsAt: toDatetimeLocal(t.flash_sale_ends_at),
      cap: t.flash_sale_quantity_cap ? String(t.flash_sale_quantity_cap) : '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setError('');
  };

  const submit = async (ticketTypeId: string) => {
    setError('');
    if (!form.price || !form.startsAt || !form.endsAt) {
      setError('Price, start time, and end time are required.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/ticket-types/${ticketTypeId}/flash-sale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flashPriceKes: Number(form.price),
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: new Date(form.endsAt).toISOString(),
          quantityCap: form.cap ? Number(form.cap) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }
      setTiers((prev) => prev.map((t) => (t.id === ticketTypeId ? { ...t, ...data.ticketType } : t)));
      setEditingId(null);
    } catch (e) {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  };

  const cancelFlashSale = async (ticketTypeId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ticket-types/${ticketTypeId}/flash-sale`, { method: 'DELETE' });
      if (res.ok) {
        setTiers((prev) =>
          prev.map((t) =>
            t.id === ticketTypeId
              ? { ...t, flash_sale_price_kes: null, flash_sale_starts_at: null, flash_sale_ends_at: null, flash_sale_quantity_cap: null, flash_sale_quantity_sold: 0 }
              : t
          )
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {tiers.length === 0 && <p className="text-gray-400">No ticket tiers found for this event.</p>}

      {tiers.map((t) => {
        const active = isFlashActive(t);
        const hasFlashConfigured = !!t.flash_sale_price_kes;

        return (
          <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="font-bold text-white flex items-center gap-2">
                  {t.name}
                  {active && (
                    <span className="text-[10px] uppercase tracking-wider font-extrabold bg-amber-500 text-black px-2 py-0.5 rounded-full">
                      Live Now
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-400 mt-1">Regular price: KES {Number(t.price_kes).toLocaleString()}</p>
                {hasFlashConfigured && (
                  <p className="text-xs text-amber-400 font-semibold mt-1">
                    Flash price: KES {Number(t.flash_sale_price_kes).toLocaleString()}
                    {' '}&middot;{' '}
                    {new Date(t.flash_sale_starts_at!).toLocaleString()} &rarr; {new Date(t.flash_sale_ends_at!).toLocaleString()}
                    {t.flash_sale_quantity_cap && (
                      <> &middot; {t.flash_sale_quantity_sold}/{t.flash_sale_quantity_cap} claimed</>
                    )}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {hasFlashConfigured && (
                  <button
                    onClick={() => cancelFlashSale(t.id)}
                    disabled={loading}
                    className="text-xs bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-800/60 px-3 py-2 rounded-lg font-semibold transition disabled:opacity-50"
                  >
                    Cancel Flash Sale
                  </button>
                )}
                <button
                  onClick={() => (editingId === t.id ? cancelEdit() : startEdit(t))}
                  className="text-xs bg-gray-800 hover:bg-gray-700 text-indigo-300 border border-gray-700 px-3 py-2 rounded-lg font-semibold transition"
                >
                  {editingId === t.id ? 'Close' : hasFlashConfigured ? 'Edit Flash Sale' : 'Start Flash Sale'}
                </button>
              </div>
            </div>

            {editingId === t.id && (
              <div className="mt-4 pt-4 border-t border-gray-800 space-y-3">
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Flash Price (KES)</label>
                    <input
                      type="number"
                      min="0"
                      value={form.price}
                      onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                      placeholder={`< ${t.price_kes}`}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Starts</label>
                    <input
                      type="datetime-local"
                      value={form.startsAt}
                      onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Ends</label>
                    <input
                      type="datetime-local"
                      value={form.endsAt}
                      onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                    />
                  </div>
                </div>
                <div className="max-w-xs">
                  <label className="text-xs text-gray-400 block mb-1">Quantity Cap (optional)</label>
                  <input
                    type="number"
                    min="1"
                    value={form.cap}
                    onChange={(e) => setForm((f) => ({ ...f, cap: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                    placeholder="e.g. 20 — leave blank for no cap"
                  />
                </div>
                <button
                  onClick={() => submit(t.id)}
                  disabled={loading}
                  className="bg-amber-600 hover:bg-amber-500 text-black font-bold px-4 py-2 rounded-lg text-sm transition disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Flash Sale'}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

'@
Write-ClaudeFile "app\organizer\events\[id]\flash-sales\FlashSaleManager.tsx" $flashManager

Write-Host "6. Updating orders route (pricing + reservation logic)..." -ForegroundColor Cyan
$ordersRoute = @'
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { nanoid } from 'nanoid';
import { finalizePaidOrder } from '@/lib/tickets';
import { validatePromoCode } from '@/lib/promoCodes';

export async function POST(req: NextRequest) {
  // Hoisted so the outer catch can release a reservation if something
  // unexpected fails after inventory was reserved but before the order
  // was successfully inserted.
  let reservedTicketTypeId: string | null = null;
  let reservedQuantity = 0;
  let reservedFlashApplied = false;

  try {
    const body = await req.json();
    const { ticketTypeId, quantity = 1, buyerName, buyerEmail: rawBuyerEmail, buyerPhone, promoCode } = body;
    const buyerEmail = typeof rawBuyerEmail === 'string' ? rawBuyerEmail.trim().toLowerCase() : rawBuyerEmail;

    if (!ticketTypeId || !buyerName || !buyerEmail || !buyerPhone) {
      return NextResponse.json({ error: 'Missing required fields', received: body }, { status: 400 });
    }
    if (quantity < 1) {
      return NextResponse.json({ error: 'Quantity must be at least 1' }, { status: 400 });
    }

    const basicTickets = await sql`
      SELECT id, event_id, price_kes, quantity_total, quantity_sold, max_per_order
      FROM ticket_types WHERE id::text = ${ticketTypeId}
    `;
    const basicTicketType = basicTickets[0];

    if (!basicTicketType) {
      return NextResponse.json({ error: 'Ticket type not found' }, { status: 404 });
    }
    if (basicTicketType.max_per_order && quantity > basicTicketType.max_per_order) {
      return NextResponse.json({ error: `Maximum ${basicTicketType.max_per_order} tickets per order` }, { status: 400 });
    }

    // Atomically reserve inventory: only succeeds if enough remains, and can't
    // be beaten by a simultaneous purchase (locked via FOR UPDATE within the
    // same statement, unlike a separate SELECT-then-check).
    // Also determines, in the same atomic step, whether this purchase
    // qualifies for an active flash sale price (time window + quantity cap
    // both still available for the full requested quantity) — if the whole
    // quantity doesn't fit under a remaining flash cap, it's sold at the
    // regular price instead of being split into two prices.
    const reserved = await sql`
      WITH current AS (
        SELECT id, event_id, price_kes, quantity_total, quantity_sold, max_per_order,
               flash_sale_price_kes, flash_sale_starts_at, flash_sale_ends_at,
               flash_sale_quantity_cap, flash_sale_quantity_sold
        FROM ticket_types
        WHERE id::text = ${ticketTypeId}
        FOR UPDATE
      ),
      eligible AS (
        SELECT *,
          (flash_sale_price_kes IS NOT NULL
            AND now() BETWEEN flash_sale_starts_at AND flash_sale_ends_at
            AND (flash_sale_quantity_cap IS NULL OR flash_sale_quantity_sold + ${quantity} <= flash_sale_quantity_cap)
          ) AS flash_applies
        FROM current
      )
      UPDATE ticket_types t
      SET quantity_sold = t.quantity_sold + ${quantity},
          flash_sale_quantity_sold = t.flash_sale_quantity_sold + (CASE WHEN eligible.flash_applies THEN ${quantity} ELSE 0 END)
      FROM eligible
      WHERE t.id = eligible.id
        AND eligible.quantity_sold + ${quantity} <= eligible.quantity_total
      RETURNING t.id, t.event_id, t.price_kes, t.quantity_total, t.quantity_sold, t.max_per_order,
                eligible.flash_applies, eligible.flash_sale_price_kes
    `;
    const ticketType = reserved[0];

    if (!ticketType) {
      const remaining = Number(basicTicketType.quantity_total || 0) - Number(basicTicketType.quantity_sold || 0);
      return NextResponse.json({ error: `Only ${Math.max(0, remaining)} ticket(s) remaining for this tier` }, { status: 400 });
    }

    // From this point on, inventory is reserved. Any early return below must
    // release it first, or the seats will be locked without a completed order.
    reservedTicketTypeId = ticketType.id;
    reservedQuantity = quantity;
    reservedFlashApplied = !!ticketType.flash_applies;
    const releaseReservation = () => sql`
      UPDATE ticket_types
      SET quantity_sold = GREATEST(0, quantity_sold - ${quantity}),
          flash_sale_quantity_sold = GREATEST(0, flash_sale_quantity_sold - ${ticketType.flash_applies ? quantity : 0})
      WHERE id = ${ticketType.id}
    `;

    const [event] = await sql`
      SELECT e.status, e.start_at, e.end_at, e.organizer_id, u.status AS organizer_status
      FROM events e
      JOIN users u ON u.id = e.organizer_id
      WHERE e.id = ${ticketType.event_id}
    `;
    if (!event) {
      await releaseReservation();
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    if (event.organizer_status === 'suspended') {
      await releaseReservation();
      return NextResponse.json({ error: 'This event is not currently available for ticket sales' }, { status: 400 });
    }
    if (event.status === 'cancelled') {
      await releaseReservation();
      return NextResponse.json({ error: 'This event has been cancelled' }, { status: 400 });
    }
    if (event.status !== 'published') {
      await releaseReservation();
      return NextResponse.json({ error: 'This event is not currently available for ticket sales' }, { status: 400 });
    }
    const eventEnd = event.end_at ? new Date(event.end_at) : new Date(event.start_at);
    if (eventEnd < new Date()) {
      await releaseReservation();
      return NextResponse.json({ error: 'This event has already ended' }, { status: 400 });
    }

    const effectivePriceKes = ticketType.flash_applies
      ? Number(ticketType.flash_sale_price_kes)
      : Number(ticketType.price_kes || 0);
    const subtotalKes = effectivePriceKes * quantity;

    let amountKes = subtotalKes;
    let promoCodeId: string | null = null;
    let discountAmountKes = 0;

    if (promoCode && String(promoCode).trim()) {
      const promoResult = await validatePromoCode(ticketType.event_id, promoCode, subtotalKes);
      if (!promoResult.valid) {
        await releaseReservation();
        return NextResponse.json({ error: promoResult.error || 'Invalid promo code' }, { status: 400 });
      }
      promoCodeId = promoResult.promoCodeId!;
      discountAmountKes = promoResult.discountAmount!;
      amountKes = promoResult.finalAmount!;
    }

    const amountInSubunits = Math.round(amountKes * 100);
    const reference = `tk-${nanoid(16)}`;
    const isFree = amountKes <= 0;

    let authorizationUrl = '';

    if (!isFree) {
      const paystackSecret = process.env.PAYSTACK_SECRET_KEY;

      if (!paystackSecret) {
        console.error('PAYSTACK_SECRET_KEY is not configured');
        await releaseReservation();
        return NextResponse.json({ error: 'Payments are not configured right now. Please contact support.' }, { status: 503 });
      }

      try {
        const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${paystackSecret}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: buyerEmail,
            amount: amountInSubunits,
            reference: reference,
            callback_url: `${req.nextUrl.origin}/api/orders/verify?reference=${reference}`
          })
        });

        const paystackData = await paystackRes.json();
        if (paystackData.status && paystackData.data?.authorization_url) {
          authorizationUrl = paystackData.data.authorization_url;
        } else {
          console.error('Paystack did not return an authorization URL:', paystackData);
          await releaseReservation();
          return NextResponse.json({ error: 'Unable to start payment right now. Please try again shortly.' }, { status: 502 });
        }
      } catch (paystackErr) {
        console.error('Paystack API call failed:', paystackErr);
        await releaseReservation();
        return NextResponse.json({ error: 'Unable to reach the payment provider. Please try again shortly.' }, { status: 502 });
      }
    }

    const [order] = await sql`
      INSERT INTO orders (event_id, buyer_name, buyer_email, buyer_phone, total_amount_kes, promo_code_id, discount_amount_kes, payment_status, paystack_reference, ticket_type_id, quantity)
      VALUES (${ticketType.event_id}, ${buyerName}, ${buyerEmail}, ${buyerPhone}, ${amountKes}, ${promoCodeId}, ${discountAmountKes}, ${isFree ? 'paid' : 'pending'}, ${reference}, ${ticketType.id}, ${quantity})
      RETURNING id
    `;

    // Order row exists now, so the reservation is accounted for — no
    // release needed even if something below this point throws.
    reservedTicketTypeId = null;

    if (isFree) {
      await finalizePaidOrder(order.id, req.nextUrl.origin);
    }

    return NextResponse.json({ 
      success: true, 
      orderId: order.id, 
      reference, 
      authorizationUrl: authorizationUrl || null,
      isFree
    });

  } catch (err: any) {
    console.error("Order creation error:", err);
    if (reservedTicketTypeId) {
      try {
        await sql`
          UPDATE ticket_types
          SET quantity_sold = GREATEST(0, quantity_sold - ${reservedQuantity}),
              flash_sale_quantity_sold = GREATEST(0, flash_sale_quantity_sold - ${reservedFlashApplied ? reservedQuantity : 0})
          WHERE id = ${reservedTicketTypeId}
        `;
      } catch (releaseErr) {
        console.error('Failed to release ticket reservation after error:', releaseErr);
      }
    }
    return NextResponse.json({ error: err.message || 'Something went wrong' }, { status: 500 });
  }
}

'@
Write-ClaudeFile "app\api\orders\route.ts" $ordersRoute

Write-Host "7. Updating public event page (flash price + countdown)..." -ForegroundColor Cyan
$eventsPage = @'
import { sql } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import JoinWaitlistButton from '@/components/JoinWaitlistButton';
import FlashSaleCountdown from '@/components/FlashSaleCountdown';

export const dynamic = 'force-dynamic';

export default async function EventDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const resolvedParams = await params;
  const identifier = resolvedParams.id;

  let events: any = await sql`
    SELECT * FROM events WHERE id::text = ${identifier} OR slug = ${identifier} LIMIT 1
  `;

  if (!events || (Array.isArray(events) && events.length === 0) || (events.rows && events.rows.length === 0)) {
    events = await sql`
      SELECT * FROM events WHERE LOWER(title) LIKE ${'%' + identifier.replace(/-/g, ' ').toLowerCase() + '%'} LIMIT 1
    `;
  }

  const rows = Array.isArray(events) ? events : (events?.rows || []);

  if (rows.length === 0) {
    notFound();
  }

  const event = rows[0];

  if (!event || !event.id) {
    notFound();
  }

  const ticketTypes = await sql`
    SELECT id, name, price_kes, quantity_total, quantity_sold,
           flash_sale_price_kes, flash_sale_starts_at, flash_sale_ends_at,
           flash_sale_quantity_cap, flash_sale_quantity_sold
    FROM ticket_types
    WHERE event_id = ${event.id}
    ORDER BY price_kes ASC
  `;

  const [organizerProfile] = await sql`
    SELECT is_verified FROM organizer_profiles WHERE user_id = ${event.organizer_id}
  `;
  const organizerVerified = organizerProfile?.is_verified === true;

  const eventDate = event.start_at || event.start_date || event.date;
  const eventEndDate = event.end_at || eventDate;
  const isCancelled = event.status === 'cancelled';
  const isEnded = eventEndDate ? new Date(eventEndDate) < new Date() : false;
  const notYetPublished = event.status === 'draft' || event.status === 'pending_review';
  const salesClosed = isCancelled || isEnded || notYetPublished;

  const eventUrl = `https://ticketing-system-phi-eight.vercel.app/events/${event.slug || event.id}`;
  const shareText = `Check out ${event.title} on TicketHub!`;
  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + eventUrl)}`;
  const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(eventUrl)}`;
  const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(eventUrl)}`;

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 text-white">
      <h1 className="text-4xl font-extrabold mb-4 flex items-center gap-2 flex-wrap">
        {event.title}
        {organizerVerified && (
          <span className="inline-flex items-center gap-1 bg-cyan-950/50 border border-cyan-800/50 text-cyan-300 text-xs font-bold px-2.5 py-1 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: 14, height: 14 }}>
              <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
            </svg>
            Verified Organizer
          </span>
        )}
      </h1>
      <p className="text-gray-300 text-lg mb-6 leading-relaxed">{event.description}</p>

      <div className="flex gap-2 mb-8 flex-wrap">
        <a
          href={whatsappShareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-white text-xs font-semibold px-3 py-2 rounded-lg transition"
          style={{ background: '#25D366' }}
        >
          Share on WhatsApp
        </a>
        <a
          href={twitterShareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition"
        >
          Share on X
        </a>
        <a
          href={facebookShareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-white text-xs font-semibold px-3 py-2 rounded-lg transition"
          style={{ background: '#1877F2' }}
        >
          Share on Facebook
        </a>
      </div>

      {isCancelled && (
        <div className="bg-red-950/40 border border-red-800/60 text-red-300 font-semibold px-4 py-3 rounded-xl mb-6">
          This event has been cancelled.
        </div>
      )}
      {!isCancelled && isEnded && (
        <div className="bg-gray-800/60 border border-gray-700 text-gray-300 font-semibold px-4 py-3 rounded-xl mb-6">
          This event has already ended.
        </div>
      )}
      {!isCancelled && !isEnded && notYetPublished && (
        <div className="bg-amber-950/40 border border-amber-800/60 text-amber-300 font-semibold px-4 py-3 rounded-xl mb-6">
          This event is not yet live. Ticket sales will open once it has been approved.
        </div>
      )}
      
      <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl mb-8 space-y-3">
        <p><strong className="text-gray-400">Date:</strong> {eventDate ? new Date(eventDate).toLocaleString() : 'TBA'}</p>
        <p><strong className="text-gray-400">Location:</strong> {event.venue_name || event.location || 'Online / Venue TBA'}</p>
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-bold text-white mb-2">Tickets</h2>
        {salesClosed ? (
          <p className="text-gray-400">
            {isCancelled
              ? 'Ticket sales are closed because this event was cancelled.'
              : isEnded
              ? 'Ticket sales are closed because this event has ended.'
              : 'Ticket sales will open once this event has been approved.'}
          </p>
        ) : ticketTypes.length === 0 ? (
          <p className="text-gray-400">No tickets are available for this event yet.</p>
        ) : (
          ticketTypes.map((t: any) => {
            const total = Number(t.quantity_total || 0);
            const remaining = Math.max(0, total - Number(t.quantity_sold || 0));
            const soldOut = remaining <= 0;
            const percentSold = total > 0 ? Math.floor((Number(t.quantity_sold || 0) / total) * 100) : 0;
            const almostSoldOut = total > 0 && !soldOut && percentSold >= 90;

            const now = new Date();
            const flashCapReached = t.flash_sale_quantity_cap !== null && t.flash_sale_quantity_cap !== undefined
              && Number(t.flash_sale_quantity_sold || 0) >= Number(t.flash_sale_quantity_cap);
            const flashActive = t.flash_sale_price_kes !== null && t.flash_sale_price_kes !== undefined
              && t.flash_sale_starts_at && t.flash_sale_ends_at
              && now >= new Date(t.flash_sale_starts_at) && now <= new Date(t.flash_sale_ends_at)
              && !flashCapReached;

            return (
              <div key={t.id} className="flex items-center justify-between bg-gray-900 border border-gray-800 p-4 rounded-xl">
                <div>
                  <p className="font-bold text-white flex items-center gap-2">
                    {t.name}
                    {flashActive && (
                      <span className="text-[10px] uppercase tracking-wider font-extrabold bg-amber-500 text-black px-2 py-0.5 rounded-full">
                        Flash Sale
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">
                    {flashActive ? (
                      <>
                        <span className="line-through text-gray-500 mr-1.5">KES {Number(t.price_kes).toLocaleString()}</span>
                        <span className="text-amber-400 font-bold">KES {Number(t.flash_sale_price_kes).toLocaleString()}</span>
                        {' '}
                        <FlashSaleCountdown endsAt={t.flash_sale_ends_at} />
                      </>
                    ) : (
                      <>KES {Number(t.price_kes).toLocaleString()}</>
                    )}
                    {soldOut && <span> &middot; Sold out</span>}
                    {almostSoldOut && (
                      <span className="text-amber-400 font-bold"> &middot; Almost sold out!</span>
                    )}
                  </p>
                </div>
                {soldOut ? (
                  <JoinWaitlistButton ticketTypeId={t.id} />
                ) : (
                  <Link
                    href={`/checkout/${t.id}`}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold uppercase tracking-wider transition shadow-lg shadow-indigo-950/50 text-center text-sm"
                  >
                    Buy Ticket
                  </Link>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

'@
Write-ClaudeFile "app\events\[id]\page.tsx" $eventsPage

Write-Host "8. Updating checkout page (effective price)..." -ForegroundColor Cyan
$checkoutPage = @'
import { sql } from '@/lib/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import CheckoutForm from './CheckoutForm';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const ticketIdOrSlug = resolvedParams?.slug;

  if (!ticketIdOrSlug) {
    notFound();
  }

  let ticketType: any = null;
  let event: any = null;

  try {
    const ttRes = await sql`
      SELECT tt.*, e.title as event_title, e.start_at, e.venue_name, e.cover_image_url
      FROM ticket_types tt
      JOIN events e ON e.id::text = tt.event_id::text
      WHERE tt.id::text = ${ticketIdOrSlug} OR tt.name ILIKE ${ticketIdOrSlug.replace(/-/g, ' ')}
      LIMIT 1
    `;

    if (ttRes.length === 0) {
      notFound();
    }

    ticketType = ttRes[0];
    event = {
      title: ticketType.event_title,
      start_at: ticketType.start_at,
      venue_name: ticketType.venue_name,
      cover_image_url: ticketType.cover_image_url
    };

  } catch (err) {
    console.error("Error loading checkout details:", err);
    notFound();
  }

  const now = new Date();
  const flashCapReached = ticketType.flash_sale_quantity_cap !== null && ticketType.flash_sale_quantity_cap !== undefined
    && Number(ticketType.flash_sale_quantity_sold || 0) >= Number(ticketType.flash_sale_quantity_cap);
  const flashActive = ticketType.flash_sale_price_kes !== null && ticketType.flash_sale_price_kes !== undefined
    && ticketType.flash_sale_starts_at && ticketType.flash_sale_ends_at
    && now >= new Date(ticketType.flash_sale_starts_at) && now <= new Date(ticketType.flash_sale_ends_at)
    && !flashCapReached;
  const effectivePriceKes = flashActive ? ticketType.flash_sale_price_kes : ticketType.price_kes;

  const priceNum = parseFloat(effectivePriceKes || 0);
  const total = ticketType.quantity_total ?? 0;
  const sold = ticketType.quantity_sold ?? 0;
  const remaining = Math.max(0, total - sold);

  const eventForForm = {
    id: ticketType.event_id,
    title: event.title,
  };

  const ticketTypesForForm = [
    {
      id: ticketType.id,
      name: flashActive ? `${ticketType.name} (Flash Sale)` : ticketType.name,
      price_kes: effectivePriceKes,
    },
  ];

  return (
    <main className="max-w-2xl mx-auto px-4 py-12 text-white">
      <div className="mb-6">
        <Link href={`/events`} className="text-indigo-400 hover:underline text-sm font-semibold">
          ← Back to Events
        </Link>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div>
          <span className="text-xs uppercase tracking-wider font-bold text-indigo-400 bg-indigo-950/60 px-3 py-1 rounded-full border border-indigo-800/50">
            Checkout
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-3">{event.title}</h1>
        </div>

        <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center pb-3 border-b border-gray-800">
            <div>
              <h3 className="font-bold text-lg text-white">{ticketType.name} Ticket</h3>
              <p className="text-xs text-gray-400">{remaining} tickets remaining</p>
            </div>
            <span className="text-cyan-400 font-extrabold text-lg">
              KES {priceNum.toLocaleString()}
            </span>
          </div>

          <div className="text-xs text-gray-400 space-y-1">
            <p><strong>Venue:</strong> {event.venue_name || 'TBD'}</p>
            <p><strong>Date:</strong> {event.start_at ? new Date(event.start_at).toLocaleString() : 'TBD'}</p>
          </div>
        </div>

        <CheckoutForm event={eventForForm} ticketTypes={ticketTypesForForm} />
      </div>
    </main>
  );
}
'@
Write-ClaudeFile "app\checkout\[slug]\page.tsx" $checkoutPage

Write-Host "9. Updating organizer dashboard (Flash Sales link)..." -ForegroundColor Cyan
$dashboard = @'
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import PublishButton from '../PublishButton';
import CancelEventButton from '../CancelEventButton';

export const dynamic = 'force-dynamic';

export default async function OrganizerDashboardPage() {
  const session = await getSession();

  if (!session) {
    return <div className="max-w-6xl mx-auto px-4 py-8 text-white">Unauthorized.</div>;
  }

  // Fetch events belonging to this organizer (or all if admin)
  const events = session.role === 'admin' 
    ? await sql`SELECT * FROM events ORDER BY created_at DESC`
    : await sql`SELECT * FROM events WHERE organizer_id = ${session.userId} ORDER BY created_at DESC`;

  // Organizers must be approved by an admin before they can create events,
  // and a suspension should immediately block creation too — checked live
  // from the DB rather than trusting the session cookie's role/state alone.
  let isVerifiedOrganizer = true;
  let isSuspended = false;
  if (session.role === 'organizer') {
    const [account] = await sql`
      SELECT u.status, COALESCE(op.is_verified, false) AS is_verified
      FROM users u
      LEFT JOIN organizer_profiles op ON op.user_id = u.id
      WHERE u.id = ${session.userId}
    `;
    isVerifiedOrganizer = account?.is_verified === true;
    isSuspended = account?.status === 'suspended';
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 text-white">
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-800">
        <div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Events & Ticket Inventory Analytics</h1>
          <p className="text-gray-400 text-sm mt-1">Real-time status breakdown and ticket sales overview</p>
        </div>
        {isSuspended ? (
          <span
            className="bg-red-950/60 border border-red-800 text-red-300 font-medium px-4 py-2 rounded-lg text-sm"
            title="Your account has been suspended"
          >
            ⛔ Account suspended
          </span>
        ) : isVerifiedOrganizer ? (
          <Link
            href="/organizer/events/new"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-lg transition shadow text-sm"
          >
            + Create Event
          </Link>
        ) : (
          <span
            className="bg-amber-950/60 border border-amber-700 text-amber-300 font-medium px-4 py-2 rounded-lg text-sm"
            title="An admin needs to approve your organizer account before you can create events"
          >
            ⏳ Pending admin approval
          </span>
        )}
      </div>

      {isSuspended && (
        <div className="mb-8 p-4 bg-red-950/40 border border-red-800 rounded-lg text-red-200 text-sm">
          Your organizer account has been suspended. You cannot create new events while suspended. Contact support if you believe this is a mistake.
        </div>
      )}

      {!isSuspended && !isVerifiedOrganizer && (
        <div className="mb-8 p-4 bg-amber-950/40 border border-amber-800 rounded-lg text-amber-200 text-sm">
          Your organizer account is awaiting approval from a TicketHub admin. Once approved, you&apos;ll be able to create and publish events. This usually doesn&apos;t take long — check back soon.
        </div>
      )}

      {events.length === 0 ? (
        <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-2xl shadow-xl text-gray-400">
          No events found.
        </div>
      ) : (
        <div className="space-y-6">
          {events.map(async (event: any) => {
            // Fetch ticket types and orders for revenue/tickets sold breakdown
            const ticketTypes = await sql`
              SELECT * FROM ticket_types WHERE event_id = ${event.id}
            `;
            
            const orders = await sql`
              SELECT quantity, total_amount_kes, payment_status, ticket_type_id 
              FROM orders 
              WHERE event_id = ${event.id} AND (payment_status = 'paid' OR payment_status = 'completed' OR payment_status = 'success')
            `;

            const totalRevenue = orders.reduce((acc: number, o: any) => acc + Number(o.total_amount_kes), 0);
            const totalTicketsSold = orders.reduce((acc: number, o: any) => acc + Number(o.quantity), 0);
            const totalInventory = ticketTypes.reduce((acc: number, t: any) => acc + Number(t.quantity_total), 0);

            return (
              <div key={event.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-800 pb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold text-white">{event.title}</h2>
                      <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ${
                        event.status === 'published' ? 'bg-green-950 text-green-400 border border-green-800'
                        : event.status === 'pending_review' ? 'bg-amber-950 text-amber-400 border border-amber-800'
                        : event.status === 'cancelled' ? 'bg-red-950 text-red-400 border border-red-800'
                        : 'bg-gray-800 text-gray-400'
                      }`}>
                        {event.status === 'pending_review' ? 'Pending Review' : event.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Created: {new Date(event.created_at).toLocaleDateString()}</p>
                  </div>

                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <span className="text-xs text-gray-400 block">Revenue</span>
                      <span className="text-lg font-extrabold text-cyan-400">KES {totalRevenue.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block">Tickets Sold</span>
                      <span className="text-lg font-extrabold text-emerald-400">{totalTicketsSold} / {totalInventory || '�'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-indigo-400 pt-1">
                  <Link href={`/organizer/events/${event.id}/orders`} className="hover:underline text-cyan-300 bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700">Orders</Link>
                  <Link href={`/organizer/events/${event.id}/analytics`} className="hover:underline text-cyan-300 bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700">Analytics</Link>
                  <Link href={`/organizer/events/${event.id}/flash-sales`} className="hover:underline text-amber-300 bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700">Flash Sales</Link>
                  <Link href={`/organizer/events/${event.id}/edit`} className="hover:underline bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700">Manage Details</Link>
                  <Link href={`/organizer/events/${event.id}/messages`} className="hover:underline bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700">Messages</Link>
                  <Link href={`/organizer/events/${event.id}/scan-overview`} className="hover:underline bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700">Scan Overview</Link>
                  <Link href={`/organizer/events/${event.id}/promo-codes`} className="hover:underline bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700">Promo Codes</Link>
                  <Link href={`/organizer/events/new?duplicateFrom=${event.id}`} className="hover:underline bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-700">Duplicate</Link>
                  {event.status === 'draft' && (
                    <PublishButton eventId={event.id} />
                  )}
                  {event.status === 'pending_review' && (
                    <span className="bg-amber-950/50 text-amber-300 border border-amber-800/50 px-3 py-1.5 rounded-lg font-semibold">
                      Awaiting Admin Review
                    </span>
                  )}
                  {event.status !== 'cancelled' && (
                    <CancelEventButton eventId={event.id} />
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                  {ticketTypes.map((ticket: any) => {
                    const sold = orders
                      .filter((o: any) => o.ticket_type_id === ticket.id)
                      .reduce((acc: number, o: any) => acc + Number(o.quantity), 0);
                    const remaining = ticket.quantity_total - sold;
                    const progress = Math.min(100, (sold / ticket.quantity_total) * 100);

                    return (
                      <div key={ticket.id} className="bg-gray-950 border border-gray-800/80 rounded-xl p-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <h3 className="font-semibold text-white text-sm">{ticket.name}</h3>
                          <span className="text-indigo-300 font-bold text-sm">KES {Number(ticket.price_kes).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>Sold: <strong className="text-white">{sold}</strong></span>
                          <span>Remaining: <strong className={remaining <= 0 ? 'text-red-500 font-extrabold' : 'text-white'}>{remaining}</strong></span>
                          <span>Total: <strong className="text-white">{ticket.quantity_total}</strong></span>
                        </div>
                        {remaining <= 0 && (
                          <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-red-400 bg-red-950/50 border border-red-800 rounded px-2 py-0.5">
                            Sold Out
                          </span>
                        )}
                        <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-cyan-500 h-full rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
'@
Write-ClaudeFile "app\organizer\dashboard\page.tsx" $dashboard

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
Write-Host "IMPORTANT: this adds new database columns via migrations/002_flash_sales.sql" -ForegroundColor Yellow
Write-Host "You need to run that SQL against your Neon database once (via the SQL Editor" -ForegroundColor Yellow
Write-Host "at console.neon.tech) BEFORE testing this feature, or the app will error." -ForegroundColor Yellow
Write-Host ""
Write-Host "Done! Next steps:" -ForegroundColor Green
Write-Host "  1. Run migrations/002_flash_sales.sql in Neon's SQL Editor"
Write-Host "  2. git add ."
Write-Host "  3. git commit -m ""Add flash sale feature"""
Write-Host "  4. git push origin main"
