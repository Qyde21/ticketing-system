# Run this from your project root:
# C:\Users\user\ticketing-system
# Usage: powershell -ExecutionPolicy Bypass -File rebuild-all-features.ps1
#
# This writes ALL feature files (organizer + admin analytics, CSV export,
# flash sales) in one pass and verifies each one actually landed on disk,
# since a previous run silently failed to write some nested files.

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


Write-Host "Writing: app\organizer\events\[id]\analytics\page.tsx" -ForegroundColor Cyan
$content = @'
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import SalesTrendChart from '@/components/SalesTrendChart';

export const dynamic = 'force-dynamic';

export default async function OrganizerEventAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  if (!session) {
    return <div className="max-w-6xl mx-auto px-4 py-8 text-white">Unauthorized.</div>;
  }

  const decodedId = decodeURIComponent(id);
  const events = await sql`
    SELECT id, title, organizer_id FROM events
    WHERE id::text = ${decodedId} OR slug = ${decodedId.toLowerCase()} OR title ILIKE ${decodedId}
  `;

  if (events.length === 0) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-8 text-white">
        <h1 className="text-2xl font-bold text-red-400 mb-2">Event Not Found</h1>
        <p className="text-gray-400">Could not find an event matching: <code className="bg-gray-800 px-2 py-1 rounded text-cyan-300">{decodedId}</code></p>
        <div className="mt-6">
          <Link href="/organizer/dashboard" className="text-indigo-400 hover:underline">&larr; Back to Dashboard</Link>
        </div>
      </main>
    );
  }

  const event = events[0];

  if (event.organizer_id !== session.userId && session.role !== 'admin') {
    return <div className="max-w-6xl mx-auto px-4 py-8 text-white">Not authorized for this event.</div>;
  }

  const ticketTypes = await sql`
    SELECT id, name, price_kes, quantity_total, quantity_sold
    FROM ticket_types
    WHERE event_id = ${event.id}
  `;

  const orders = await sql`
    SELECT created_at, total_amount_kes, payment_status, quantity
    FROM orders
    WHERE event_id = ${event.id}
  `;

  let totalCapacity = 0;
  let totalSold = 0;
  let totalRevenue = 0;

  const processedTiers = ticketTypes.map((t: any) => {
    const total = Number(t.quantity_total) || 0;
    const sold = Number(t.quantity_sold) || 0;
    const remaining = Math.max(0, total - sold);
    const tierPrice = Number(t.price_kes || 0);

    totalCapacity += total;
    totalSold += sold;
    totalRevenue += sold * tierPrice;

    const percentageSold = total > 0 ? Math.round((sold / total) * 100) : 0;

    return {
      ...t,
      total,
      sold,
      remaining,
      tierPrice,
      percentageSold,
    };
  });

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 text-white">
      <div className="mb-6">
        <Link href="/organizer/dashboard" className="text-indigo-400 hover:underline">
          &larr; Back to Dashboard
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
          Analytics: {event.title}
        </h1>
        <p className="text-gray-400 text-sm mt-1">Real-time inventory and revenue tracking</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-800 shadow-lg">
          <p className="text-indigo-300 font-medium text-sm">Total Revenue Generated</p>
          <p className="text-2xl font-bold text-cyan-400 mt-2">KES {totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-800 shadow-lg">
          <p className="text-indigo-300 font-medium text-sm">Tickets Sold / Capacity</p>
          <p className="text-2xl font-bold text-emerald-400 mt-2">{totalSold} <span className="text-gray-500 text-lg">/ {totalCapacity}</span></p>
        </div>
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-800 shadow-lg">
          <p className="text-indigo-300 font-medium text-sm">Overall Sell-Through</p>
          <p className="text-2xl font-bold text-amber-400 mt-2">
            {totalCapacity > 0 ? Math.round((totalSold / totalCapacity) * 100) : 0}%
          </p>
        </div>
      </div>

      <SalesTrendChart orders={orders as any} />

      <div className="bg-gray-900 p-6 rounded-lg border border-gray-800 shadow-lg mt-8">
        <h2 className="text-xl font-bold mb-4 text-indigo-300">Ticket Tier Breakdown</h2>
        {processedTiers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-sm">
                  <th className="py-3 px-4">Tier Name</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Total Capacity</th>
                  <th className="py-3 px-4">Sold</th>
                  <th className="py-3 px-4">Remaining</th>
                  <th className="py-3 px-4">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-sm">
                {processedTiers.map((tier: any) => (
                  <tr key={tier.id} className="hover:bg-gray-800/50">
                    <td className="py-3 px-4 font-semibold text-white">{tier.name}</td>
                    <td className="py-3 px-4 text-cyan-400">KES {tier.tierPrice.toLocaleString()}</td>
                    <td className="py-3 px-4 text-gray-300">{tier.total}</td>
                    <td className="py-3 px-4 text-emerald-400 font-semibold">{tier.sold}</td>
                    <td className="py-3 px-4 text-amber-400 font-semibold">{tier.remaining}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-800 h-2 rounded-full overflow-hidden border border-gray-700">
                          <div
                            className="bg-indigo-500 h-full"
                            style={{ width: `${tier.percentageSold}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400">{tier.percentageSold}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-400">No ticket types found for this event.</p>
        )}
      </div>
    </main>
  );
}

'@
Write-ClaudeFile "app\organizer\events\[id]\analytics\page.tsx" $content
if (-not (Test-Path -LiteralPath "app\organizer\events\[id]\analytics\page.tsx")) {
    Write-Host "  ERROR: file was not created!" -ForegroundColor Red
    $script:anyFailed = $true
} else {
    Write-Host "  Confirmed on disk." -ForegroundColor Green
}

Write-Host "Writing: app\admin\events\[id]\analytics\page.tsx" -ForegroundColor Cyan
$content = @'
import { sql } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import SalesTrendChart from "@/components/SalesTrendChart";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminEventAnalyticsPage({ params }: PageProps) {
  const { id } = await params;

  const events = await sql`SELECT * FROM events WHERE id::text = ${id} OR slug = ${id}`;
  const event = events[0];

  if (!event) {
    notFound();
  }

  const ticketTypes = await sql`
    SELECT id, name, price_kes, quantity_total, quantity_sold 
    FROM ticket_types 
    WHERE event_id = ${event.id}
  `;

  const orders = await sql`
    SELECT created_at, total_amount_kes, payment_status, quantity
    FROM orders
    WHERE event_id = ${event.id}
  `;

  let totalCapacity = 0;
  let totalSold = 0;
  let totalRevenue = 0;

  const processedTiers = ticketTypes.map((t: any) => {
    const total = Number(t.quantity_total) || 0;
    const sold = Number(t.quantity_sold) || 0;
    const remaining = Math.max(0, total - sold);
    const tierPrice = Number(t.price_kes || 0);
    
    totalCapacity += total;
    totalSold += sold;
    totalRevenue += sold * tierPrice;

    const percentageSold = total > 0 ? Math.round((sold / total) * 100) : 0;

    return {
      ...t,
      total,
      sold,
      remaining,
      tierPrice,
      percentageSold
    };
  });

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 text-white">
      <div className="mb-6 flex justify-between items-center">
        <Link href="/admin/dashboard" className="text-indigo-400 hover:underline">
          &larr; Back to Admin Dashboard
        </Link>
        <span className="bg-purple-950 border border-purple-800 text-purple-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
          Admin / Organizer View
        </span>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
          Analytics: {event.title}
        </h1>
        <p className="text-gray-400 text-sm mt-1">Real-time inventory and revenue tracking (Private View)</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-800 shadow-lg">
          <p className="text-indigo-300 font-medium text-sm">Total Revenue Generated</p>
          <p className="text-2xl font-bold text-cyan-400 mt-2">KES {totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-800 shadow-lg">
          <p className="text-indigo-300 font-medium text-sm">Tickets Sold / Capacity</p>
          <p className="text-2xl font-bold text-emerald-400 mt-2">{totalSold} <span className="text-gray-500 text-lg">/ {totalCapacity}</span></p>
        </div>
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-800 shadow-lg">
          <p className="text-indigo-300 font-medium text-sm">Overall Sell-Through</p>
          <p className="text-2xl font-bold text-amber-400 mt-2">
            {totalCapacity > 0 ? Math.round((totalSold / totalCapacity) * 100) : 0}%
          </p>
        </div>
      </div>

      <SalesTrendChart orders={orders as any} />

      <div className="bg-gray-900 p-6 rounded-lg border border-gray-800 shadow-lg">
        <h2 className="text-xl font-bold mb-4 text-indigo-300">Ticket Tier Breakdown</h2>
        {processedTiers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-sm">
                  <th className="py-3 px-4">Tier Name</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Total Capacity</th>
                  <th className="py-3 px-4">Sold</th>
                  <th className="py-3 px-4">Remaining</th>
                  <th className="py-3 px-4">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-sm">
                {processedTiers.map((tier: any) => (
                  <tr key={tier.id} className="hover:bg-gray-800/50">
                    <td className="py-3 px-4 font-semibold text-white">{tier.name}</td>
                    <td className="py-3 px-4 text-cyan-400">KES {tier.tierPrice.toLocaleString()}</td>
                    <td className="py-3 px-4 text-gray-300">{tier.total}</td>
                    <td className="py-3 px-4 text-emerald-400 font-semibold">{tier.sold}</td>
                    <td className="py-3 px-4 text-amber-400 font-semibold">{tier.remaining}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-800 h-2 rounded-full overflow-hidden border border-gray-700">
                          <div 
                            className="bg-indigo-500 h-full" 
                            style={{ width: `${tier.percentageSold}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400">{tier.percentageSold}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-400">No ticket types found for this event.</p>
        )}
      </div>
    </main>
  );
}
'@
Write-ClaudeFile "app\admin\events\[id]\analytics\page.tsx" $content
if (-not (Test-Path -LiteralPath "app\admin\events\[id]\analytics\page.tsx")) {
    Write-Host "  ERROR: file was not created!" -ForegroundColor Red
    $script:anyFailed = $true
} else {
    Write-Host "  Confirmed on disk." -ForegroundColor Green
}

Write-Host "Writing: app\api\events\[id]\orders\export\route.ts" -ForegroundColor Cyan
$content = @'
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const decodedId = decodeURIComponent(id);
  const events = await sql`
    SELECT id, title, organizer_id FROM events
    WHERE id::text = ${decodedId} OR slug = ${decodedId.toLowerCase()} OR title ILIKE ${decodedId}
  `;
  const event = events[0];

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  // Only the organizer who owns this event, or an admin, can export it.
  if (event.organizer_id !== session.userId && session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized for this event' }, { status: 403 });
  }

  const orders = await sql`
    SELECT
      o.id,
      o.buyer_name,
      o.buyer_email,
      o.buyer_phone,
      t.name AS ticket_name,
      o.quantity,
      o.total_amount_kes,
      o.payment_status,
      o.paystack_reference,
      o.created_at
    FROM orders o
    LEFT JOIN ticket_types t ON t.id = o.ticket_type_id
    WHERE o.event_id = ${event.id}
    ORDER BY o.created_at DESC
  `;

  const headers = [
    'Order ID',
    'Buyer Name',
    'Buyer Email',
    'Buyer Phone',
    'Ticket Type',
    'Quantity',
    'Total (KES)',
    'Payment Status',
    'Payment Reference',
    'Created At',
  ];

  const rows = orders.map((o: any) => [
    o.id,
    o.buyer_name,
    o.buyer_email,
    o.buyer_phone,
    o.ticket_name,
    o.quantity,
    o.total_amount_kes,
    o.payment_status,
    o.paystack_reference,
    o.created_at ? new Date(o.created_at).toISOString() : '',
  ]);

  const csvLines = [headers, ...rows].map((row) => row.map(csvEscape).join(','));
  const csv = csvLines.join('\r\n');

  const safeTitle = (event.title || 'event').replace(/[^a-z0-9]+/gi, '-').toLowerCase();

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="orders-${safeTitle}.csv"`,
    },
  });
}

'@
Write-ClaudeFile "app\api\events\[id]\orders\export\route.ts" $content
if (-not (Test-Path -LiteralPath "app\api\events\[id]\orders\export\route.ts")) {
    Write-Host "  ERROR: file was not created!" -ForegroundColor Red
    $script:anyFailed = $true
} else {
    Write-Host "  Confirmed on disk." -ForegroundColor Green
}

Write-Host "Writing: app\organizer\events\[id]\flash-sales\page.tsx" -ForegroundColor Cyan
$content = @'
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
Write-ClaudeFile "app\organizer\events\[id]\flash-sales\page.tsx" $content
if (-not (Test-Path -LiteralPath "app\organizer\events\[id]\flash-sales\page.tsx")) {
    Write-Host "  ERROR: file was not created!" -ForegroundColor Red
    $script:anyFailed = $true
} else {
    Write-Host "  Confirmed on disk." -ForegroundColor Green
}

Write-Host "Writing: app\organizer\events\[id]\flash-sales\FlashSaleManager.tsx" -ForegroundColor Cyan
$content = @'
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
Write-ClaudeFile "app\organizer\events\[id]\flash-sales\FlashSaleManager.tsx" $content
if (-not (Test-Path -LiteralPath "app\organizer\events\[id]\flash-sales\FlashSaleManager.tsx")) {
    Write-Host "  ERROR: file was not created!" -ForegroundColor Red
    $script:anyFailed = $true
} else {
    Write-Host "  Confirmed on disk." -ForegroundColor Green
}

Write-Host "Writing: components\FlashSaleCountdown.tsx" -ForegroundColor Cyan
$content = @'
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
Write-ClaudeFile "components\FlashSaleCountdown.tsx" $content
if (-not (Test-Path -LiteralPath "components\FlashSaleCountdown.tsx")) {
    Write-Host "  ERROR: file was not created!" -ForegroundColor Red
    $script:anyFailed = $true
} else {
    Write-Host "  Confirmed on disk." -ForegroundColor Green
}

Write-Host "Writing: app\api\ticket-types\[id]\flash-sale\route.ts" -ForegroundColor Cyan
$content = @'
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
Write-ClaudeFile "app\api\ticket-types\[id]\flash-sale\route.ts" $content
if (-not (Test-Path -LiteralPath "app\api\ticket-types\[id]\flash-sale\route.ts")) {
    Write-Host "  ERROR: file was not created!" -ForegroundColor Red
    $script:anyFailed = $true
} else {
    Write-Host "  Confirmed on disk." -ForegroundColor Green
}

Write-Host "Writing: migrations\002_flash_sales.sql" -ForegroundColor Cyan
$content = @'
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
Write-ClaudeFile "migrations\002_flash_sales.sql" $content
if (-not (Test-Path -LiteralPath "migrations\002_flash_sales.sql")) {
    Write-Host "  ERROR: file was not created!" -ForegroundColor Red
    $script:anyFailed = $true
} else {
    Write-Host "  Confirmed on disk." -ForegroundColor Green
}

Write-Host "Writing: app\admin\dashboard\page.tsx" -ForegroundColor Cyan
$content = @'
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import ApproveButton from './ApproveButton';
import AdminEventActions from '../events/AdminEventActions';
import EventApprovalActions from './EventApprovalActions';
import SalesTrendChart from '@/components/SalesTrendChart';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const session = await getSession();

  if (!session || session.role !== 'admin') {
    return <div className="max-w-6xl mx-auto px-4 py-8 text-white">Unauthorized access.</div>;
  }

  const [stats] = await sql`
    SELECT
      (SELECT COUNT(*) FROM users) AS total_users,
      (SELECT COUNT(*) FROM users WHERE role = 'organizer') AS total_organizers,
      (SELECT COUNT(*) FROM events) AS total_events,
      (SELECT COUNT(*) FROM events WHERE status = 'published') AS published_events,
      (SELECT COUNT(*) FROM orders WHERE payment_status = 'paid') AS paid_orders,
      (SELECT COALESCE(SUM(total_amount_kes), 0) FROM orders WHERE payment_status = 'paid') AS total_revenue_kes
  `;

  const topOrganizers = await sql`
    SELECT
      u.id,
      u.full_name,
      op.business_name,
      COUNT(DISTINCT e.id)::int AS event_count,
      COALESCE(SUM(o.total_amount_kes) FILTER (WHERE o.payment_status = 'paid'), 0) AS revenue_kes,
      COALESCE(SUM(o.quantity) FILTER (WHERE o.payment_status = 'paid'), 0)::int AS tickets_sold
    FROM users u
    LEFT JOIN organizer_profiles op ON op.user_id = u.id
    LEFT JOIN events e ON e.organizer_id = u.id
    LEFT JOIN orders o ON o.event_id = e.id
    WHERE u.role = 'organizer'
    GROUP BY u.id, u.full_name, op.business_name
    ORDER BY revenue_kes DESC
    LIMIT 5
  `;

  const platformOrders = await sql`
    SELECT created_at, total_amount_kes, payment_status, quantity
    FROM orders
    ORDER BY created_at ASC
  `;

  const pendingOrganizers = await sql`
    SELECT u.id, u.full_name, u.email, op.business_name, op.created_at
    FROM organizer_profiles op
    JOIN users u ON u.id = op.user_id
    WHERE op.is_verified = false
    ORDER BY op.created_at ASC
  `;

  const pendingEvents = await sql`
    SELECT e.id, e.title, e.start_at, e.venue_name, e.updated_at,
           u.full_name AS organizer_name, u.email AS organizer_email
    FROM events e
    JOIN users u ON u.id = e.organizer_id
    WHERE e.status = 'pending_review'
    ORDER BY e.updated_at ASC
  `;

  const events = await sql`
    SELECT e.id, e.title, e.slug, e.status, e.created_at
    FROM events e
    ORDER BY e.created_at DESC
  `;

  const eventAnalytics = await Promise.all(
    events.map(async (event: any) => {
      const ticketTypes = await sql`
        SELECT id, name, price_kes, quantity_total, quantity_sold 
        FROM ticket_types 
        WHERE event_id = ${event.id}
      `;

      let totalCapacity = 0;
      let totalSold = 0;
      let eventRevenue = 0;

      const tiers = ticketTypes.map((t: any) => {
        const total = Number(t.quantity_total) || 0;
        const sold = Number(t.quantity_sold) || 0;
        const price = Number(t.price_kes || 0);

        totalCapacity += total;
        totalSold += sold;
        eventRevenue += sold * price;

        return { ...t, total, sold, remaining: Math.max(0, total - sold), price };
      });

      return {
        ...event,
        totalCapacity,
        totalSold,
        eventRevenue,
        tiers,
      };
    })
  );

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 text-white">
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-800">
        <div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Admin Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Platform overview and management controls</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/events/new"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-lg transition shadow text-sm"
          >
            + Create Event
          </Link>
          <Link
            href="/admin/events"
            className="bg-gray-800 hover:bg-gray-700 text-indigo-300 font-semibold px-4 py-2 rounded-lg border border-gray-700 transition shadow text-sm"
          >
            Manage All Events &rarr;
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">Total Revenue</p>
          <p className="text-2xl font-extrabold text-white mt-2">KES {Number(stats.total_revenue_kes).toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">{stats.paid_orders} successful paid orders</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">Total Events</p>
          <p className="text-2xl font-extrabold text-white mt-2">{stats.total_events}</p>
          <p className="text-xs text-cyan-400 mt-1">{stats.published_events} currently published</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">Total Users</p>
          <p className="text-2xl font-extrabold text-white mt-2">{stats.total_users}</p>
          <p className="text-xs text-gray-400 mt-1">Registered platform accounts</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">Organizers</p>
          <p className="text-2xl font-extrabold text-white mt-2">{stats.total_organizers}</p>
          <p className="text-xs text-gray-400 mt-1">Active event organizers</p>
        </div>
      </div>

      <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl mb-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-indigo-300">Platform Sales Trend</h2>
          <span className="text-xs text-gray-400">All events combined</span>
        </div>
        {platformOrders.length > 0 ? (
          <SalesTrendChart orders={platformOrders as any} />
        ) : (
          <div className="text-center py-8 text-gray-400 bg-gray-800/40 rounded-lg border border-gray-800">
            No orders yet.
          </div>
        )}
      </section>

      <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl mb-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-indigo-300">Top Organizers by Revenue</h2>
        </div>
        {topOrganizers.length > 0 && Number(topOrganizers[0].revenue_kes) > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-indigo-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Organizer</th>
                  <th className="py-3 px-4">Events</th>
                  <th className="py-3 px-4">Tickets Sold</th>
                  <th className="py-3 px-4 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-sm">
                {topOrganizers.map((o: any) => (
                  <tr key={o.id} className="hover:bg-gray-800/50 transition">
                    <td className="py-4 px-4 font-semibold text-white">
                      {o.business_name || o.full_name}
                      {o.business_name && <div className="text-xs text-gray-500">{o.full_name}</div>}
                    </td>
                    <td className="py-4 px-4 text-gray-300">{o.event_count}</td>
                    <td className="py-4 px-4 text-emerald-400 font-semibold">{o.tickets_sold}</td>
                    <td className="py-4 px-4 text-right text-cyan-400 font-bold">KES {Number(o.revenue_kes).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400 bg-gray-800/40 rounded-lg border border-gray-800">
            No organizer revenue yet.
          </div>
        )}
      </section>

      <section className="bg-gray-900 border border-amber-800/50 rounded-xl p-6 shadow-xl mb-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-amber-300">
            Pending Event Approvals ({pendingEvents.length})
          </h2>
        </div>

        {pendingEvents.length === 0 ? (
          <div className="text-center py-8 text-gray-400 bg-gray-800/40 rounded-lg border border-gray-800">
            No events waiting for review. All clear!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-amber-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Event</th>
                  <th className="py-3 px-4">Organizer</th>
                  <th className="py-3 px-4">Date &amp; Venue</th>
                  <th className="py-3 px-4">Submitted</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-sm">
                {pendingEvents.map((ev: any) => (
                  <tr key={ev.id} className="hover:bg-gray-800/50 transition">
                    <td className="py-4 px-4 font-semibold text-white">{ev.title}</td>
                    <td className="py-4 px-4 text-gray-300">
                      {ev.organizer_name}
                      <div className="text-xs text-gray-500">{ev.organizer_email}</div>
                    </td>
                    <td className="py-4 px-4 text-gray-400 text-xs">
                      {ev.start_at ? new Date(ev.start_at).toLocaleDateString() : 'TBA'}
                      <div>{ev.venue_name}</div>
                    </td>
                    <td className="py-4 px-4 text-gray-400 text-xs">{new Date(ev.updated_at).toLocaleDateString()}</td>
                    <td className="py-4 px-4 text-right">
                      <EventApprovalActions eventId={ev.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl mb-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-indigo-300">
            Events & Ticket Inventory Analytics
          </h2>
          <span className="text-xs text-gray-400">Real-time status breakdown</span>
        </div>

        {eventAnalytics.length > 0 ? (
          <div className="space-y-6">
            {eventAnalytics.map((ev) => (
              <div key={ev.id} className="bg-gray-950 p-5 rounded-lg border border-gray-800">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 pb-3 border-b border-gray-800">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-white">{ev.title}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider ${
                        ev.status === 'published' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : ev.status === 'pending_review' ? 'bg-amber-950 text-amber-400 border border-amber-800'
                        : ev.status === 'cancelled' ? 'bg-red-950 text-red-400 border border-red-800'
                        : 'bg-gray-800 text-gray-400 border border-gray-700'
                      }`}>
                        {ev.status === 'pending_review' ? 'Pending Review' : (ev.status || 'Draft')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Created: {ev.created_at ? new Date(ev.created_at).toLocaleDateString() : 'N/A'}</p>
                  </div>
                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <p className="text-xs text-gray-400">Revenue</p>
                      <p className="text-sm font-bold text-cyan-400">KES {ev.eventRevenue.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Tickets Sold</p>
                      <p className="text-sm font-bold text-emerald-400">{ev.totalSold} / {ev.totalCapacity}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 pb-3 mb-3 border-b border-gray-800/60 text-xs">
                  <Link
                    href={`/admin/scan/${ev.id}`}
                    className="text-gray-300 hover:text-emerald-400 transition"
                  >
                    Scan tickets
                  </Link>
                  <span className="text-gray-700">|</span>
                  <Link
                    href={`/organizer/events/${ev.id}/scan-overview`}
                    className="text-gray-300 hover:text-cyan-400 transition"
                  >
                    Scan overview
                  </Link>
                  <span className="text-gray-700">|</span>
                  <Link
                    href={`/admin/events/${ev.id}/orders`}
                    className="text-gray-300 hover:text-indigo-400 transition"
                >
                    Orders
                  </Link>
                  <span className="text-gray-700">|</span>
                  <Link
                    href={`/organizer/events/${ev.id}/messages`}
                    className="text-gray-300 hover:text-purple-400 transition"
                  >
                    Messages
                  </Link>
                  <span className="text-gray-700">|</span>
                  <Link
                    href={`/organizer/events/${ev.id}/edit`}
                    className="text-gray-300 hover:text-amber-400 transition"
                  >
                    Edit cover
                  </Link>
                  <span className="text-gray-700">|</span>
                  <AdminEventActions eventId={ev.id} status={ev.status} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {ev.tiers.map((tier: any) => (
                    <div key={tier.id} className="bg-gray-900 p-3 rounded border border-gray-800 text-xs">
                      <div className="flex justify-between font-semibold text-gray-200">
                        <span>{tier.name}</span>
                        <span className="text-cyan-400">KES {tier.price.toLocaleString()}</span>
                      </div>
                      <div className="mt-2 flex justify-between text-gray-400">
                        <span>Sold: <strong className="text-emerald-400">{tier.sold}</strong></span>
                        <span>Remaining: <strong className={tier.remaining <= 0 ? 'text-red-500 font-extrabold' : 'text-amber-400'}>{tier.remaining}</strong></span>
                        <span>Total: {tier.total}</span>
                      </div>
                      {tier.remaining <= 0 && (
                        <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wider text-red-400 bg-red-950/50 border border-red-800 rounded px-2 py-0.5">
                          Sold Out
                        </span>
                      )}
                      <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden mt-2">
                        <div 
                          className="bg-indigo-500 h-full" 
                          style={{ width: `${tier.total > 0 ? Math.round((tier.sold / tier.total) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400 bg-gray-800/40 rounded-lg border border-gray-800">
            No events found on the platform.
          </div>
        )}
      </section>

      <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-indigo-300">
            Pending Organizer Approvals ({pendingOrganizers.length})
          </h2>
        </div>

        {pendingOrganizers.length === 0 ? (
          <div className="text-center py-8 text-gray-400 bg-gray-800/40 rounded-lg border border-gray-800">
            No pending organizer approvals at the moment. All clear!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-indigo-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Business Name</th>
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Requested On</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-sm">
                {pendingOrganizers.map((o: any) => (
                  <tr key={o.id} className="hover:bg-gray-800/50 transition">
                    <td className="py-4 px-4 font-semibold text-white">{o.business_name || 'N/A'}</td>
                    <td className="py-4 px-4 text-gray-300">{o.full_name}</td>
                    <td className="py-4 px-4 text-gray-400">{o.email}</td>
                    <td className="py-4 px-4 text-gray-400">{new Date(o.created_at).toLocaleDateString()}</td>
                    <td className="py-4 px-4 text-right">
                      <ApproveButton userId={o.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

'@
Write-ClaudeFile "app\admin\dashboard\page.tsx" $content
if (-not (Test-Path -LiteralPath "app\admin\dashboard\page.tsx")) {
    Write-Host "  ERROR: file was not created!" -ForegroundColor Red
    $script:anyFailed = $true
} else {
    Write-Host "  Confirmed on disk." -ForegroundColor Green
}

Write-Host "Writing: app\organizer\dashboard\page.tsx" -ForegroundColor Cyan
$content = @'
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
Write-ClaudeFile "app\organizer\dashboard\page.tsx" $content
if (-not (Test-Path -LiteralPath "app\organizer\dashboard\page.tsx")) {
    Write-Host "  ERROR: file was not created!" -ForegroundColor Red
    $script:anyFailed = $true
} else {
    Write-Host "  Confirmed on disk." -ForegroundColor Green
}

Write-Host "Writing: app\api\orders\route.ts" -ForegroundColor Cyan
$content = @'
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
Write-ClaudeFile "app\api\orders\route.ts" $content
if (-not (Test-Path -LiteralPath "app\api\orders\route.ts")) {
    Write-Host "  ERROR: file was not created!" -ForegroundColor Red
    $script:anyFailed = $true
} else {
    Write-Host "  Confirmed on disk." -ForegroundColor Green
}

Write-Host "Writing: app\events\[id]\page.tsx" -ForegroundColor Cyan
$content = @'
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
Write-ClaudeFile "app\events\[id]\page.tsx" $content
if (-not (Test-Path -LiteralPath "app\events\[id]\page.tsx")) {
    Write-Host "  ERROR: file was not created!" -ForegroundColor Red
    $script:anyFailed = $true
} else {
    Write-Host "  Confirmed on disk." -ForegroundColor Green
}

Write-Host "Writing: app\checkout\[slug]\page.tsx" -ForegroundColor Cyan
$content = @'
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
Write-ClaudeFile "app\checkout\[slug]\page.tsx" $content
if (-not (Test-Path -LiteralPath "app\checkout\[slug]\page.tsx")) {
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
    $script:anyFailed = $true
} else {
    Write-Host "Clean." -ForegroundColor Green
}

Write-Host ""
if ($script:anyFailed) {
    Write-Host "SOME FILES FAILED TO WRITE - do not push yet, share this output." -ForegroundColor Red
} else {
    Write-Host "All files confirmed written successfully." -ForegroundColor Green
    Write-Host ""
    Write-Host "IMPORTANT: run migrations/002_flash_sales.sql in Neon's SQL Editor" -ForegroundColor Yellow
    Write-Host "before testing the flash sale feature, if you have not already." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Green
    Write-Host "  git add ."
    Write-Host "  git commit -m ""Restore analytics + CSV export, ensure flash sales files present"""
    Write-Host "  git push origin main"
}
