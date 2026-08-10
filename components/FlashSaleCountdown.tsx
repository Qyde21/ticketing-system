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
