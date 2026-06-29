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