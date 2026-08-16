import { Suspense } from 'react';
import CheckoutCallbackInner from './CheckoutCallbackInner';

export default function CheckoutCallbackPage() {
  return (
    <Suspense fallback={<p style={{ margin: '2rem' }}>Loading...</p>}>
      <CheckoutCallbackInner />
    </Suspense>
  );
}