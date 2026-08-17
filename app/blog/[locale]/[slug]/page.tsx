import { Button } from '@/components/ui/button'
import { Footer } from '@/components/ui/footer'
import { Header } from '@/components/ui/header'
import {
  type BlogLocale,
  getPost,
  getPostSlugs,
  getTranslationSlug,
} from '@/lib/blog'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const LOCALES: BlogLocale[] = ['en', 'es']

function isBlogLocale(value: string): value is BlogLocale {
  return LOCALES.includes(value as BlogLocale)
}

export function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    getPostSlugs(locale).map((slug) => ({ locale, slug }))
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isBlogLocale(locale)) return {}

  const post = await getPost(locale, slug)
  if (!post) return {}

  const translationSlug = getTranslationSlug(locale, post.id)
  const otherLocale: BlogLocale = locale === 'en' ? 'es' : 'en'
  const languages: Record<string, string> = {
    [locale]: `/blog/${locale}/${slug}`,
  }
  if (translationSlug) {
    languages[otherLocale] = `/blog/${otherLocale}/${translationSlug}`
  }

  return {
    title: post.title,
    description: post.description,
    alternates: {
      canonical: `/blog/${locale}/${slug}`,
      languages,
    },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `/blog/${locale}/${slug}`,
      type: 'article',
      publishedTime: post.date,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
    },
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  if (!isBlogLocale(locale)) notFound()

  const post = await getPost(locale, slug)
  if (!post) notFound()

  const translationSlug = getTranslationSlug(locale, post.id)
  const otherLocale: BlogLocale = locale === 'en' ? 'es' : 'en'
  const minReadLabel =
    locale === 'es'
      ? `${post.readingMinutes} min de lectura`
      : `${post.readingMinutes} min read`
  const backToBlogLabel = locale === 'es' ? 'Volver al blog' : 'Back to blog'
  const translationLabel =
    otherLocale === 'es' ? 'Leer en español' : 'Read in English'
  const ctaTitle =
    locale === 'es'
      ? '¿Listo para ponerlo en práctica?'
      : 'Ready to put this into practice?'
  const ctaSubtitle =
    locale === 'es'
      ? 'Empezá a registrar gratis — sin tarjeta, sin configuración.'
      : 'Start tracking for free — no credit card, no setup.'
  const ctaButton = locale === 'es' ? 'Empezar gratis' : 'Start for free'
  const formattedDate = new Date(post.date).toLocaleDateString(
    locale === 'es' ? 'es-ES' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' }
  )

  return (
    <div className="bg-background text-foreground flex flex-col items-center">
      <Header path="/" />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: post.title,
            description: post.description,
            datePublished: post.date,
            inLanguage: locale,
          }),
        }}
      />

      <article className="w-full px-4 py-24">
        <div className="mx-auto max-w-2xl">
          <Link
            href="/blog"
            className="text-muted-foreground hover:text-foreground mb-8 inline-flex items-center gap-2 text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            {backToBlogLabel}
          </Link>

          <p className="text-muted-foreground mb-3 text-sm">
            {formattedDate} · {minReadLabel}
          </p>
          <h1 className="mb-8 text-4xl leading-tight font-black tracking-tighter sm:text-5xl">
            {post.title}
          </h1>

          <div
            className="prose prose-neutral dark:prose-invert prose-headings:font-black prose-headings:tracking-tight max-w-none"
            dangerouslySetInnerHTML={{ __html: post.html }}
          />

          {translationSlug && (
            <Link
              href={`/blog/${otherLocale}/${translationSlug}`}
              className="text-primary mt-10 inline-flex items-center gap-2 text-sm font-semibold hover:underline"
            >
              {translationLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}

          <div className="bg-card shadow-soft mt-16 rounded-3xl p-8 text-center">
            <h2 className="text-2xl font-black tracking-tight">{ctaTitle}</h2>
            <p className="text-muted-foreground mt-2">{ctaSubtitle}</p>
            <Link href="/signup" className="mt-6 inline-block">
              <Button size="lg">{ctaButton}</Button>
            </Link>
          </div>
        </div>
      </article>

      <Footer />
    </div>
  )
}
