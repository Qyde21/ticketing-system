import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/organizer/', '/scan/', '/api/'],
    },
    sitemap: 'https://ticketing-system-phi-eight.vercel.app/sitemap.xml',
  };
}