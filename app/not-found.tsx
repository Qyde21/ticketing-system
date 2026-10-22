import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="max-w-xl mx-auto px-4 py-24 text-black text-center">
      <p className="text-7xl font-extrabold mb-4 text-black">404</p>
      <h1 className="text-2xl font-bold mb-3">Page not found</h1>
      <p className="text-neutral-500 mb-8">
        The page you are looking for does not exist, may have been moved, or the link might be broken.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="font-bold py-3 px-6 rounded-full transition bg-black text-white hover:bg-neutral-800"
        >
          Browse Events
        </Link>
        <Link
          href="/contact"
          className="bg-neutral-100 hover:bg-neutral-200 border border-black/15 text-black font-semibold py-3 px-6 rounded-lg transition"
        >
          Contact Support
        </Link>
      </div>
    </main>
  );
}
