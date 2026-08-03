/**
 * Kept for compatibility with tooling that referenced proxy.ts.
 * Real route protection runs from middleware.ts (Next.js convention).
 */
export { middleware as proxy, config } from './middleware';
