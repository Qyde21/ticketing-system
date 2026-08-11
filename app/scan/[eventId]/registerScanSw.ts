const SYNC_TAG = 'tickethub-checkin-sync';

export async function registerScanServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register('/sw-scan.js', { scope: '/' });
    return reg;
  } catch (err) {
    console.warn('Scan SW registration failed', err);
    return null;
  }
}

/** Request Background Sync when offline check-ins are queued */
export async function requestCheckinBackgroundSync(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const anyReg = reg as ServiceWorkerRegistration & {
      sync?: { register: (tag: string) => Promise<void> };
    };
    if (anyReg.sync) {
      await anyReg.sync.register(SYNC_TAG);
    } else {
      // Fallback: ask SW to flush if it is already active
      reg.active?.postMessage({ type: 'FLUSH_CHECKIN_QUEUE' });
    }
  } catch (err) {
    console.warn('Background sync register failed', err);
  }
}

export async function flushCheckinQueueNow(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({ type: 'FLUSH_CHECKIN_QUEUE' });
  } catch {
    /* ignore */
  }
}