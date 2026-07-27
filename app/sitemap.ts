import { MetadataRoute } from 'next';
import { sql } from '@/lib/db';

const BASE_URL = 'https://ticketing-system-phi-eight.vercel.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/about`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/contact`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/faq`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/pricing`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/terms`, changeFrequency: 'yearly', priority: 0.3 },
  ];

  let eventPages: MetadataRoute.Sitemap = [];

  try {
    const events = await sql`
      SELECT slug, id, updated_at, created_at
      FROM events
      WHERE status IN ('published', 'completed')
    `;

    eventPages = events.map((e: any) => ({
      url: `${BASE_URL}/events/${e.slug || e.id}`,
      lastModified: e.updated_at || e.created_at || undefined,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
  } catch (err) {
    console.error('Failed to build sitemap event entries:', err);
  }

  return [...staticPages, ...eventPages];
}
