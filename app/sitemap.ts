import { MetadataRoute } from 'next';
import { sql } from '@/lib/db';

const BASE_URL = 'https://www.mytickethub.co.ke';

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
      SELECT e.slug, e.id, e.updated_at, e.created_at
      FROM events e
      JOIN users u ON u.id = e.organizer_id
      WHERE e.status IN ('published', 'completed') AND u.status != 'suspended'
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
