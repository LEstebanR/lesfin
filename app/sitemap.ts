import { blogAlternates, getAllPostsMeta } from '@/lib/blog'
import { siteUrl } from '@/lib/site'
import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  const posts = [...getAllPostsMeta('en'), ...getAllPostsMeta('es')]
  const postEntries: MetadataRoute.Sitemap = posts.map((post) => {
    const languages = Object.fromEntries(
      Object.entries(blogAlternates(post)).map(([lang, path]) => [
        lang,
        new URL(path, siteUrl).toString(),
      ])
    )

    return {
      url: `${siteUrl}/blog/${post.locale}/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: 'yearly',
      priority: 0.6,
      alternates: { languages },
    }
  })

  return [
    { url: siteUrl, lastModified, changeFrequency: 'monthly', priority: 1 },
    {
      url: `${siteUrl}/pricing`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${siteUrl}/blog`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    ...postEntries,
  ]
}
