'use client'

import { useLanguage } from '@/components/language-provider'
import { Reveal } from '@/components/marketing/reveal'
import { Footer } from '@/components/ui/footer'
import { Header } from '@/components/ui/header'
import type { BlogPostMeta } from '@/lib/blog'
import { formatPostDate } from '@/lib/blog-date'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

export function BlogIndex({
  postsByLocale,
}: {
  postsByLocale: Record<'en' | 'es', BlogPostMeta[]>
}) {
  const { language, t } = useLanguage()
  const posts = postsByLocale[language]

  return (
    <div className="bg-background text-foreground flex flex-col items-center">
      <Header path="/" />

      <section className="w-full px-4 pt-24 pb-16 md:pt-32">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-muted-foreground mb-4 text-sm font-semibold tracking-[0.2em] uppercase">
            {t('blog.eyebrow')}
          </p>
          <h1 className="text-5xl leading-none font-black tracking-tighter sm:text-6xl">
            {t('blog.title')}
            <br />
            <span className="text-muted-foreground">
              {t('blog.titleMuted')}
            </span>
          </h1>
          <p className="text-muted-foreground mx-auto mt-6 max-w-lg text-lg text-balance">
            {t('blog.subtitle')}
          </p>
        </div>
      </section>

      <section className="w-full px-4 pb-24">
        <div className="mx-auto max-w-2xl">
          {posts.length === 0 ? (
            <p className="text-muted-foreground text-center">
              {t('blog.noPosts')}
            </p>
          ) : (
            <div className="divide-border divide-y">
              {posts.map((post, i) => (
                <Reveal key={post.slug} delay={i * 40}>
                  <Link
                    href={`/blog/${post.locale}/${post.slug}`}
                    className="group flex items-center justify-between gap-4 py-8"
                  >
                    <div>
                      <p className="text-muted-foreground mb-2 text-sm">
                        {formatPostDate(post.date, language)} ·{' '}
                        {t('blog.minRead', { minutes: post.readingMinutes })}
                      </p>
                      <h2 className="text-xl font-black tracking-tight sm:text-2xl">
                        {post.title}
                      </h2>
                      <p className="text-muted-foreground mt-2 leading-relaxed">
                        {post.description}
                      </p>
                    </div>
                    <ArrowRight className="text-muted-foreground group-hover:text-foreground h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  )
}
