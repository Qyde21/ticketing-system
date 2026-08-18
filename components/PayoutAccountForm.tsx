'use client';

import { useEffect, useState } from 'react';

export default function PayoutAccountForm() {
  const [method, setMethod] = useState<'mpesa' | 'bank'>('mpesa');
  const [payoutName, setPayoutName] = useState('');
  const [payoutPhone, setPayoutPhone] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/organizer/payout-account')
      .then((r) => r.json())
      .then((d) => {
        if (d.payout_method) setMethod(d.payout_method === 'bank' ? 'bank' : 'mpesa');
        if (d.payout_name) setPayoutName(d.payout_name);
        if (d.payout_phone) setPayoutPhone(d.payout_phone);
        if (d.bank_code) setBankCode(d.bank_code);
        if (d.bank_account_number) setBankAccountNumber(d.bank_account_number);
        setReady(Boolean(d.recipient_ready));
      })
      .catch(() => {});
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr('');
    setMsg('');
    try {
      const res = await fetch('/api/organizer/payout-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, payoutName, payoutPhone, bankCode, bankAccountNumber }),
      });
      const data = await res.json();
      if (!res.ok) setErr(data.error || 'Save failed');
      else {
        setReady(true);
        setMsg('Payout account saved and verified with Paystack.');
      }
    } catch {
      setErr('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-8">
      <h2 className="text-lg font-bold text-white mb-1">Payout destination</h2>
      <p className="text-sm text-gray-400 mb-4">
        Net earnings (after 10% fee) are paid via Paystack, usually ~48h after the event ends.
        {ready && <span className="text-emerald-400 font-semibold"> Â· Account ready</span>}
      </p>
      <form onSubmit={save} className="space-y-3">
        <div className="flex gap-2">
          <button type="button" onClick={() => setMethod('mpesa')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold ${method === 'mpesa' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
            M-Pesa
          </button>
          <button type="button" onClick={() => setMethod('bank')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold ${method === 'bank' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
            Bank
          </button>
        </div>
        <input required value={payoutName} onChange={(e) => setPayoutName(e.target.value)}
          placeholder="Account name (as registered)"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm" />
        {method === 'mpesa' ? (
          <input required value={payoutPhone} onChange={(e) => setPayoutPhone(e.target.value)}
            placeholder="M-Pesa number e.g. 0712 345 678"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm" />
        ) : (
          <>
            <input required value={bankCode} onChange={(e) => setBankCode(e.target.value)}
              placeholder="Bank code (Paystack Kenya)"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm" />
            <input required value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)}
              placeholder="Account number"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm" />
          </>
        )}
        {err && <p className="text-red-400 text-sm">{err}</p>}
        {msg && <p className="text-emerald-400 text-sm">{msg}</p>}
        <button type="submit" disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm">
          {loading ? 'Savingâ€¦' : ready ? 'Update payout account' : 'Save payout account'}
        </button>
      </form>
    </div>
  );
}
