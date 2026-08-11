'use client';

import { useEffect, useState } from 'react';

export default function FlashSaleBadge({
  label = 'FLASH SALE',
  style = {},
}: {
  label?: string;
  style?: React.CSSProperties;
}) {
  const [on, setOn] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setOn((v) => !v), 500);
    return () => clearInterval(id);
  }, []);

  return (
    <span
      style={{
        display: 'inline-block',
        background: '#f59e0b',
        color: '#000',
        fontSize: 11,
        fontWeight: 900,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        padding: '4px 10px',
        borderRadius: 999,
        opacity: on ? 1 : 0.35,
        transform: on ? 'scale(1.06)' : 'scale(1)',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
        ...style,
      }}
    >
      {label}
    </span>
  );
}