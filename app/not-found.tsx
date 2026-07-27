import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="max-w-xl mx-auto px-4 py-24 text-white text-center">
      <p className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 text-7xl font-extrabold mb-4">404</p>
      <h1 className="text-2xl font-bold mb-3">Page not found</h1>
      <p className="text-gray-400 mb-8">
        The page you are looking for does not exist, may have been moved, or the link might be broken.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold py-3 px-6 rounded-lg transition shadow-lg"
        >
          Browse Events
        </Link>
        <Link
          href="/contact"
          className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition"
        >
          Contact Support
        </Link>
      </div>
    </main>
  );
}
