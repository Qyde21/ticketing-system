import { neon, NeonQueryFunction } from '@neondatabase/serverless';

function createSql(): NeonQueryFunction<false, false> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }
  return neon(process.env.DATABASE_URL);
}

// Lazy proxy – keeps the exact same usage + correct types
export const sql = new Proxy((() => {}) as unknown as NeonQueryFunction<false, false>, {
  apply(_target, _thisArg, args) {
    return (createSql() as any)(...args);
  },
  get(_target, prop) {
    return (createSql() as any)[prop];
  },
});
