import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import TwoFactorSettings from './TwoFactorSettings';

export const dynamic = 'force-dynamic';

export default async function SecuritySettingsPage() {
  const session = await getSession();

  if (!session) {
    return <div className="max-w-md mx-auto py-16 px-4 text-white text-center">Please log in.</div>;
  }
  if (session.role !== 'organizer' && session.role !== 'admin') {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-white text-center">
        Two-factor authentication is available for organizer and admin accounts.
      </div>
    );
  }

  const [user] = await sql`SELECT totp_enabled FROM users WHERE id = ${session.userId}`;

  return (
    <div className="max-w-md mx-auto py-12 px-4 text-white">
      <h1 className="text-2xl font-extrabold mb-1">Security Settings</h1>
      <p className="text-gray-400 text-sm mb-6">Manage two-factor authentication for your account</p>

      <TwoFactorSettings initialEnabled={!!user?.totp_enabled} />
    </div>
  );
}
