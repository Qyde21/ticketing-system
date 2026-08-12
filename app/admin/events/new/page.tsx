import { getSession } from '@/lib/auth';
import NewEventForm from './NewEventForm';

export default async function NewEventPage() {
  const session = await getSession();

  if (!session || session.role !== 'admin') {
    return <div className="max-w-6xl mx-auto px-4 py-8 text-white">Unauthorized access.</div>;
  }

  return <NewEventForm />;
}
