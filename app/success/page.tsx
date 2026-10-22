import { Suspense } from 'react';
import SuccessContent from '@/components/SuccessContent';

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="max-w-2xl mx-auto py-20 px-4 text-center text-black">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-yellow-400 border-t-transparent mb-4"></div>
        <p className="text-neutral-500">Loading order details...</p>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}