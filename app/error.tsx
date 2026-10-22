'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled application error:', error);
  }, [error]);

  return (
    <main className="max-w-xl mx-auto px-4 py-24 text-black text-center">
      <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold mb-6">
        !
      </div>
      <h1 className="text-2xl font-bold mb-3">Something went wrong</h1>
      <p className="text-neutral-500 mb-8">
        An unexpected error occurred. You can try again, or head back to the homepage. If this keeps happening, please contact support.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => reset()}
          className="font-bold py-3 px-6 rounded-full transition bg-black text-white hover:bg-neutral-800"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="bg-neutral-100 hover:bg-neutral-200 border border-black/15 text-black font-semibold py-3 px-6 rounded-lg transition"
        >
          Back to Home
        </Link>
      </div>
    </main>
  );
}
