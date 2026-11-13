import { describe, expect, it } from 'bun:test'

import {
  blogAlternates,
  getAllPostsMeta,
  getPost,
  getPostMeta,
  getTranslationSlug,
} from './blog'

describe('blog front matter', () => {
  it('parses titles that contain colons', () => {
    expect(getPostMeta('en', 'debt-payoff-strategies')).toMatchObject({
      id: 'debt-payoff-strategies',
      title: 'Debt payoff strategies: avalanche vs. snowball',
      date: '2026-08-05',
    })
    expect(getPostMeta('en', 'emergency-fund-guide')).toMatchObject({
      id: 'emergency-fund-guide',
      title: 'How much should you save in an emergency fund?',
      description:
        'A practical emergency fund guide: choose a target, start with a smaller buffer, and build savings for unexpected expenses without abandoning your budget.',
      date: '2026-08-03',
    })
    expect(getPostMeta('es', 'metodos-para-pagar-deudas')).toMatchObject({
      id: 'debt-payoff-strategies',
      title: 'Métodos para pagar deudas: avalancha o bola de nieve',
      date: '2026-08-05',
    })
  })

  it('links each post to its own translation', () => {
    expect(getTranslationSlug('en', 'emergency-fund-guide')).toBe(
      'fondo-de-emergencia'
    )
    expect(getTranslationSlug('en', 'debt-payoff-strategies')).toBe(
      'metodos-para-pagar-deudas'
    )
    expect(getTranslationSlug('es', 'debt-payoff-strategies')).toBe(
      'debt-payoff-strategies'
    )
    expect(getTranslationSlug('es', 'emergency-fund-guide')).toBe(
      'emergency-fund-guide'
    )
  })

  it('keeps front matter out of the article html', async () => {
    const post = await getPost('en', 'debt-payoff-strategies')
    expect(post?.html).toContain('debt avalanche')
    expect(post?.html).not.toContain('id: debt-payoff-strategies')
    expect(post?.title).not.toBe('undefined')
  })

  it('gives every published post a real title, date, and hreflang set', () => {
    for (const locale of ['en', 'es'] as const) {
      const posts = getAllPostsMeta(locale)
      expect(posts.length).toBeGreaterThan(0)
      for (const post of posts) {
        expect(post.title).not.toBe('undefined')
        expect(post.description).not.toBe('undefined')
        expect(post.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        const languages = blogAlternates(post)
        expect(languages['x-default']).toMatch(/^\/blog\/en\//)
        expect(languages.en).toBeTruthy()
        expect(languages.es).toBeTruthy()
      }
    }
  })
})
