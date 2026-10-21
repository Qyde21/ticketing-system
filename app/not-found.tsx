import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="max-w-xl mx-auto px-4 py-24 text-white text-center">
      <p className="text-7xl font-extrabold mb-4 text-white">404</p>
      <h1 className="text-2xl font-bold mb-3">Page not found</h1>
      <p className="text-neutral-400 mb-8">
        The page you are looking for does not exist, may have been moved, or the link might be broken.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="font-bold py-3 px-6 rounded-full transition bg-white text-black hover:bg-neutral-200"
        >
          Browse Events
        </Link>
        <Link
          href="/contact"
          className="bg-neutral-900 hover:bg-neutral-800 border border-white/15 text-white font-semibold py-3 px-6 rounded-lg transition"
        >
          Contact Support
        </Link>
      </div>
    </main>
  );
}
