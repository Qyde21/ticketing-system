# Run this from your project root
# Usage: powershell -ExecutionPolicy Bypass -File fix-admin-analytics-dynamic-again.ps1
#
# app/admin/events/[id]/analytics/page.tsx lost its "force-dynamic" export
# again (this file has been substantially rewritten since the last time,
# so the earlier one-line patch didn't carry over). Reapplying it -
# without this, the admin analytics page can serve stale cached revenue
# and ticket-sold numbers instead of fresh ones.

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

$path = "app\admin\events\[id]\analytics\page.tsx"
$content = @'
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import SalesTrendChart from "@/components/SalesTrendChart";

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminEventAnalyticsPage({ params }: PageProps) {
  const session = await getSession();

  if (!session || session.role !== 'admin') {
    return <div className="max-w-5xl mx-auto px-4 py-8 text-white">Unauthorized access.</div>;
  }

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
[System.IO.File]::WriteAllText($path, $content, $utf8NoBom)

if (-not (Test-Path -LiteralPath $path)) {
    Write-Host "ERROR: file was not created!" -ForegroundColor Red
} else {
    Write-Host "Confirmed on disk." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Green
    Write-Host "  git add ."
    Write-Host "  git commit -m ""Fix: re-add force-dynamic to admin analytics page"""
    Write-Host "  git push origin main"
}
