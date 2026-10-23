const PAYSTACK_BASE_URL = 'https://api.paystack.co';

export async function initializeTransaction(params: {
  email: string;
  amountKes: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}) {
  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: params.email,
      amount: Math.round(params.amountKes * 100),
      currency: 'KES',
      reference: params.reference,
      callback_url: params.callbackUrl,
      channels: ['card', 'mobile_money'],
      metadata: params.metadata ?? {},
    }),
  });

  const data = await res.json();
  if (!data.status) {
    throw new Error(data.message || 'Failed to initialize Paystack transaction');
  }
  return data.data as { authorization_url: string; access_code: string; reference: string };
}

/** Full refund, or partial when amountKes is set (Paystack amount is in kobo). */
export async function refundTransaction(reference: string, amountKes?: number) {
  const body: Record<string, unknown> = { transaction: reference };
  if (amountKes != null && amountKes > 0) {
    body.amount = Math.round(amountKes * 100);
  }

  const res = await fetch(`${PAYSTACK_BASE_URL}/refund`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!data.status) {
    throw new Error(data.message || 'Failed to process refund');
  }
  return data.data;
}


async function paystackFetch(path: string, init?: RequestInit) {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not set');
  const res = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok || data.status === false) {
    throw new Error(data.message || `Paystack error (${res.status})`);
  }
  return data;
}

export async function createTransferRecipient(params: {
  type: 'mobile_money' | 'ghipss' | 'basa' | 'nuban';
  name: string;
  accountNumber: string;
  bankCode: string;
  currency?: string;
}) {
  const data = await paystackFetch('/transferrecipient', {
    method: 'POST',
    body: JSON.stringify({
      type: params.type,
      name: params.name,
      account_number: params.accountNumber,
      bank_code: params.bankCode,
      currency: params.currency || 'KES',
    }),
  });
  return data.data as {
    recipient_code: string;
    type: string;
    name: string;
    details: Record<string, unknown>;
  };
}

export async function initiateTransfer(params: {
  amountKes: number;
  recipientCode: string;
  reference: string;
  reason?: string;
}) {
  const amount = Math.round(params.amountKes * 100);
  if (amount < 100) throw new Error('Transfer amount too small');
  const data = await paystackFetch('/transfer', {
    method: 'POST',
    body: JSON.stringify({
      source: 'balance',
      amount,
      recipient: params.recipientCode,
      reference: params.reference,
      reason: params.reason || 'TicketHub organizer payout',
      currency: 'KES',
    }),
  });
  return data.data as {
    transfer_code: string;
    status: string;
    reference: string;
    amount: number;
  };
}

export async function fetchTransfer(transferCodeOrReference: string) {
  const data = await paystackFetch(`/transfer/${encodeURIComponent(transferCodeOrReference)}`, {
    method: 'GET',
  });
  return data.data as {
    status: string;
    transfer_code: string;
    reference: string;
    amount: number;
    reason?: string;
  };
}

export type VerifyResult =
  | { kind: 'success'; amountKes: number; currency: string }
  | { kind: 'not_success'; status: string } // abandoned, failed, never initialised (404) ...
  | { kind: 'error'; message: string }; // could not get a trustworthy answer - do NOT treat as unpaid

/**
 * Asks Paystack whether a transaction was paid. The three outcomes are kept
 * apart on purpose: "Paystack says it wasn't paid" and "I couldn't reach
 * Paystack" must never be confused, or an outage would look like abandoned
 * carts.
 */
export async function verifyTransaction(reference: string): Promise<VerifyResult> {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return { kind: 'error', message: 'PAYSTACK_SECRET_KEY is not configured' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
      signal: controller.signal,
    });
    if (res.status === 404) return { kind: 'not_success', status: 'not_found' };
    if (!res.ok) return { kind: 'error', message: `Paystack answered HTTP ${res.status}` };

    const json = await res.json();
    const status = json?.data?.status;
    if (json?.status === true && status === 'success') {
      return { kind: 'success', amountKes: Number(json.data.amount) / 100, currency: String(json.data.currency || '') };
    }
    return { kind: 'not_success', status: String(status || 'unknown') };
  } catch (err: any) {
    return { kind: 'error', message: err?.name === 'AbortError' ? 'Paystack timed out' : String(err?.message || err) };
  } finally {
    clearTimeout(timer);
  }
}
