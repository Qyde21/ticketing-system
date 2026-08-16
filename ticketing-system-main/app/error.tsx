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
    <main className="max-w-xl mx-auto px-4 py-24 text-white text-center">
      <div className="w-16 h-16 bg-red-950/40 text-red-400 rounded-full flex items-center justify-center mx-auto text-2xl font-bold mb-6">
        !
      </div>
      <h1 className="text-2xl font-bold mb-3">Something went wrong</h1>
      <p className="text-gray-400 mb-8">
        An unexpected error occurred. You can try again, or head back to the homepage. If this keeps happening, please contact support.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => reset()}
          className="bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold py-3 px-6 rounded-lg transition shadow-lg"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition"
        >
          Back to Home
        </Link>
      </div>
    </main>
  );
}
