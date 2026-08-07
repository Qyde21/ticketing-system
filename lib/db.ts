import { neon } from '@neondatabase/serverless';

export const sql = ((strings: TemplateStringsArray, ...values: any[]) => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }
  const client = neon(process.env.DATABASE_URL);
  return client(strings, ...values);
}) as ReturnType<typeof neon>;