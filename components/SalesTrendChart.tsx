interface Order {
  created_at: string | Date;
  total_amount_kes: number | string;
  payment_status: string;
  quantity: number;
}

export default function SalesTrendChart({ orders }: { orders: Order[] }) {
  const paidOrders = orders.filter(
    (o) => o.payment_status === 'paid' || o.payment_status === 'completed' || o.payment_status === 'success'
  );

  if (paidOrders.length === 0) {
    return null;
  }

  const dailyMap = new Map<string, { count: number; revenue: number }>();

  for (const order of paidOrders) {
    const dateKey = new Date(order.created_at).toISOString().slice(0, 10);
    const existing = dailyMap.get(dateKey) || { count: 0, revenue: 0 };
    existing.count += Number(order.quantity) || 1;
    existing.revenue += Number(order.total_amount_kes) || 0;
    dailyMap.set(dateKey, existing);
  }

  const sortedDays = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14);

  const maxCount = Math.max(...sortedDays.map(([, v]) => v.count), 1);
  const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.total_amount_kes || 0), 0);
  const totalTickets = paidOrders.reduce((sum, o) => sum + (Number(o.quantity) || 1), 0);

  const chartWidth = 700;
  const chartHeight = 160;
  const barGap = 6;
  const barWidth = sortedDays.length > 0 ? (chartWidth - barGap * (sortedDays.length - 1)) / sortedDays.length : 0;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h2 className="text-lg font-bold text-white">Sales Trend</h2>
        <div className="flex gap-5 text-sm">
          <div>
            <span className="text-gray-400 text-xs block">Total Tickets Sold</span>
            <span className="text-indigo-400 font-bold">{totalTickets}</span>
          </div>
          <div>
            <span className="text-gray-400 text-xs block">Total Revenue</span>
            <span className="text-emerald-400 font-bold">KES {totalRevenue.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${chartWidth} ${chartHeight + 24}`} width="100%" style={{ maxWidth: chartWidth }}>
        {sortedDays.map(([date, data], i) => {
          const barHeight = (data.count / maxCount) * chartHeight;
          const x = i * (barWidth + barGap);
          const y = chartHeight - barHeight;
          const label = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

          return (
            <g key={date}>
              <title>{`${label}: ${data.count} ticket(s), KES ${data.revenue.toLocaleString()}`}</title>
              <rect x={x} y={y} width={barWidth} height={Math.max(barHeight, 2)} rx={3} fill="#6366f1" />
              <text
                x={x + barWidth / 2}
                y={chartHeight + 16}
                fontSize="9"
                fill="#9ca3af"
                textAnchor="middle"
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
