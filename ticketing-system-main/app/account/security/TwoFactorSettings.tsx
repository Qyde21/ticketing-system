'use client';
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function TwoFactorSettings({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [step, setStep] = useState<'idle' | 'qr' | 'backup-codes' | 'disable'>('idle');

  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleStartSetup() {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/2fa/setup');
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to start setup');
        setLoading(false);
        return;
      }
      setOtpauthUrl(data.otpauthUrl);
      setSecret(data.secret);
      setStep('qr');
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifySetup(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/2fa/verify-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid code');
        setLoading(false);
        return;
      }
      setBackupCodes(data.backupCodes);
      setStep('backup-codes');
      setEnabled(true);
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to disable');
        setLoading(false);
        return;
      }
      setEnabled(false);
      setStep('idle');
      setPassword('');
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputClass = 'w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition';

  if (step === 'backup-codes') {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-emerald-400 mb-2">2FA Enabled!</h2>
        <p className="text-sm text-gray-300 mb-4">
          Save these backup codes somewhere safe. Each one can be used once to log in if you lose access to your authenticator app. They won&apos;t be shown again.
        </p>
        <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 grid grid-cols-2 gap-2 font-mono text-sm text-white mb-4">
          {backupCodes.map((c) => (
            <div key={c}>{c}</div>
          ))}
        </div>
        <button
          onClick={() => setStep('idle')}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition"
        >
          I&apos;ve saved my codes
        </button>
      </div>
    );
  }

  if (step === 'qr') {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-white mb-3">Scan this QR code</h2>
        <p className="text-sm text-gray-400 mb-4">
          Use Google Authenticator, Authy, or any TOTP app to scan this code, then enter the 6-digit code it generates.
        </p>
        <div className="bg-white p-4 rounded-xl inline-block mb-4">
          <QRCodeSVG value={otpauthUrl} size={180} />
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Can&apos;t scan? Enter this code manually: <span className="font-mono text-gray-300">{secret}</span>
        </p>
        <form onSubmit={handleVerifySetup} className="flex flex-col gap-3">
          <input
            type="text"
            required
            inputMode="numeric"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={inputClass + ' text-center tracking-widest'}
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition"
            >
              {loading ? 'Verifying...' : 'Verify & Enable'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('idle'); setError(''); }}
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-5 py-2.5 rounded-lg text-sm transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (step === 'disable') {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-white mb-3">Disable Two-Factor Authentication</h2>
        <p className="text-sm text-gray-400 mb-4">Enter your password to confirm.</p>
        <form onSubmit={handleDisable} className="flex flex-col gap-3">
          <input
            type="password"
            required
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition"
            >
              {loading ? 'Disabling...' : 'Confirm Disable'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('idle'); setError(''); setPassword(''); }}
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-5 py-2.5 rounded-lg text-sm transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold text-white">Two-Factor Authentication</h2>
        <span
          className={
            'text-xs font-semibold px-2.5 py-1 rounded-full ' +
            (enabled
              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50'
              : 'bg-gray-800 text-gray-400 border border-gray-700')
          }
        >
          {enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>
      <p className="text-sm text-gray-400 mb-4">
        Add an extra layer of security to your account with an authenticator app.
      </p>
      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
      {enabled ? (
        <button
          onClick={() => setStep('disable')}
          className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-5 py-2.5 rounded-lg font-semibold text-sm transition"
        >
          Disable 2FA
        </button>
      ) : (
        <button
          onClick={handleStartSetup}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition"
        >
          {loading ? 'Loading...' : 'Enable 2FA'}
        </button>
      )}
    </div>
  );
}
