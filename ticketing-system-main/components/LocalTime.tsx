'use client';
import { useEffect, useState } from 'react';

export default function LocalTime({ isoString }: { isoString: string }) {
  const [formatted, setFormatted] = useState<string>('');

  useEffect(() => {
    if (isoString) {
      const date = new Date(isoString);
      setFormatted(
        date.toLocaleTimeString('en-KE', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    }
  }, [isoString]);

  // Fallback while rendering on the server
  if (!formatted) {
    return <span style={{ color: '#888' }}>Loading...</span>;
  }

  return <span>{formatted}</span>;
}
