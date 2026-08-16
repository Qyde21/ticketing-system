/* TicketHub scan background sync */
const DB_NAME = 'tickethub-scan';
const DB_VERSION = 1;
const SYNC_TAG = 'tickethub-checkin-sync';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('manifests')) {
        db.createObjectStore('manifests', { keyPath: 'eventId' });
      }
      if (!db.objectStoreNames.contains('queue')) {
        const q = db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
        q.createIndex('eventId', 'eventId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function listAllQueue(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue', 'readonly');
    const req = tx.objectStore('queue').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function deleteQueueId(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function flushQueue() {
  const db = await openDb();
  try {
    const items = await listAllQueue(db);
    for (const item of items) {
      try {
        const res = await fetch('/api/checkin', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticketCode: item.ticketCode,
            eventId: item.eventId,
          }),
        });
        // Success, already used, or validation error → drop from queue
        if (res.ok || res.status === 409 || res.status === 400) {
          await deleteQueueId(db, item.id);
        } else if (res.status === 401 || res.status === 403) {
          // Auth expired — stop; user must open app again
          break;
        } else {
          // Server error — retry later
          break;
        }
      } catch {
        // Still offline
        break;
      }
    }
  } finally {
    db.close();
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(flushQueue());
  }
});

// Allow page to request an immediate flush
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FLUSH_CHECKIN_QUEUE') {
    event.waitUntil(flushQueue());
  }
});