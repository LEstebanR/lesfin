'use client'

import { useLanguage } from '@/components/language-provider'
import { Footer } from '@/components/ui/footer'
import { Header } from '@/components/ui/header'
import {
  LEGAL_INFO,
  type LegalDocumentKind,
  PENDING_MARKER,
  legalDocuments,
} from '@/lib/legal'

// Highlights "[PENDIENTE: …]" placeholders so missing legal data is obvious.
function LegalText({ text }: { text: string }) {
  return text.split(PENDING_MARKER).map((part, i) =>
    PENDING_MARKER.test(part) ? (
      <mark key={i} className="rounded bg-yellow-200 px-1 text-black">
        {part}
      </mark>
    ) : (
      part
    )
  )
}

export function LegalPage({ kind }: { kind: LegalDocumentKind }) {
  const { language } = useLanguage()
  const doc = legalDocuments[kind][language]

  return (
    <div className="bg-background text-foreground flex flex-col items-center">
      <Header path="/" />

      <article className="w-full max-w-2xl px-4 pt-24 pb-16 md:pt-32">
        <h1 className="text-4xl leading-none font-black tracking-tighter sm:text-5xl">
          {doc.title}
        </h1>
        <p className="text-muted-foreground mt-4 text-sm">
          {doc.lastUpdatedLabel}:{' '}
          <time dateTime={LEGAL_INFO.lastUpdated}>
            {LEGAL_INFO.lastUpdated}
          </time>
        </p>
        <p className="mt-8 text-lg leading-relaxed">{doc.intro}</p>

        {doc.sections.map((section) => (
          <section key={section.heading} className="mt-10">
            <h2 className="text-xl font-bold tracking-tight">
              {section.heading}
            </h2>
            {section.blocks.map((block, i) =>
              Array.isArray(block) ? (
                <ul
                  key={i}
                  className="text-muted-foreground mt-4 list-disc space-y-2 pl-5 leading-relaxed"
                >
                  {block.map((item) => (
                    <li key={item}>
                      <LegalText text={item} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p
                  key={i}
                  className="text-muted-foreground mt-4 leading-relaxed"
                >
                  <LegalText text={block} />
                </p>
              )
            )}
          </section>
        ))}
      </article>

      <Footer />
    </div>
  )
}
