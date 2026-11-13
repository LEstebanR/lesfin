import fs from 'fs'
import matter from 'gray-matter'
import path from 'path'
import readingTime from 'reading-time'
import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import remarkHtml from 'remark-html'

export type BlogLocale = 'en' | 'es'

export interface BlogPostMeta {
  slug: string
  locale: BlogLocale
  id: string
  title: string
  description: string
  date: string
  readingMinutes: number
}

export interface BlogPost extends BlogPostMeta {
  html: string
}

const BLOG_DIR = path.join(process.cwd(), 'content/blog')

// Options disable gray-matter's module cache. That cache stores the file
// before parsing, so a YAML error makes the next read look successful with
// empty front matter and the raw file as the article body.
const MATTER_OPTIONS = { language: 'yaml' }

function localeDir(locale: BlogLocale) {
  return path.join(BLOG_DIR, locale)
}

// js-yaml rejects plain scalars that contain ": ". Quote those values so a
// title or description with a colon still parses.
function quoteFrontMatterScalars(raw: string): string {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match || match.index !== 0) return raw

  const quotedBlock = match[1]
    .split(/\r?\n/)
    .map((line) => {
      const field = /^([A-Za-z0-9_-]+):\s+(.+)$/.exec(line)
      if (!field) return line
      const [, key, value] = field
      const trimmed = value.trim()
      if (
        trimmed.startsWith('"') ||
        trimmed.startsWith("'") ||
        trimmed.startsWith('|') ||
        trimmed.startsWith('>') ||
        trimmed.startsWith('[') ||
        trimmed.startsWith('{') ||
        !trimmed.includes(':')
      ) {
        return line
      }
      const escaped = trimmed.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      return `${key}: "${escaped}"`
    })
    .join('\n')

  return `---\n${quotedBlock}\n---${raw.slice(match[0].length)}`
}

function readPostFile(locale: BlogLocale, slug: string) {
  const filePath = path.join(localeDir(locale), `${slug}.md`)
  const raw = fs.readFileSync(filePath, 'utf8')
  return matter(quoteFrontMatterScalars(raw), MATTER_OPTIONS)
}

export function getPostSlugs(locale: BlogLocale): string[] {
  const dir = localeDir(locale)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.md'))
    .map((file) => file.replace(/\.md$/, ''))
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function formatDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'string') {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim())
    if (match) return match[1]
  }
  return null
}

function toMeta(
  locale: BlogLocale,
  slug: string,
  data: Record<string, unknown>,
  content: string
): BlogPostMeta | null {
  const id = asText(data.id)
  const title = asText(data.title)
  const description = asText(data.description)
  const date = formatDate(data.date)
  if (!id || !title || !description || !date) return null

  return {
    slug,
    locale,
    id,
    title,
    description,
    date,
    readingMinutes: Math.max(1, Math.round(readingTime(content).minutes)),
  }
}

export function getPostMeta(
  locale: BlogLocale,
  slug: string
): BlogPostMeta | null {
  try {
    const { data, content } = readPostFile(locale, slug)
    return toMeta(locale, slug, data, content)
  } catch {
    return null
  }
}

export async function getPost(
  locale: BlogLocale,
  slug: string
): Promise<BlogPost | null> {
  try {
    const { data, content } = readPostFile(locale, slug)
    const meta = toMeta(locale, slug, data, content)
    if (!meta) return null

    const processed = await remark()
      .use(remarkGfm)
      .use(remarkHtml)
      .process(content)

    return {
      ...meta,
      html: processed.toString(),
    }
  } catch {
    return null
  }
}

export function getAllPostsMeta(locale: BlogLocale): BlogPostMeta[] {
  return getPostSlugs(locale)
    .map((slug) => getPostMeta(locale, slug))
    .filter((post): post is BlogPostMeta => post !== null)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}

// Cross-links a post to its counterpart in the other language, matched by
// the shared frontmatter `id` rather than slug — the two versions rarely
// share the same URL-friendly words.
export function getTranslationSlug(
  locale: BlogLocale,
  id: string
): string | undefined {
  const otherLocale: BlogLocale = locale === 'en' ? 'es' : 'en'
  return getAllPostsMeta(otherLocale).find((post) => post.id === id)?.slug
}

export function blogAlternates(post: BlogPostMeta): Record<string, string> {
  const otherLocale: BlogLocale = post.locale === 'en' ? 'es' : 'en'
  const translationSlug = getTranslationSlug(post.locale, post.id)
  const languages: Record<string, string> = {
    [post.locale]: `/blog/${post.locale}/${post.slug}`,
  }
  if (translationSlug) {
    languages[otherLocale] = `/blog/${otherLocale}/${translationSlug}`
  }
  const englishSlug = post.locale === 'en' ? post.slug : translationSlug
  languages['x-default'] = englishSlug
    ? `/blog/en/${englishSlug}`
    : `/blog/${post.locale}/${post.slug}`
  return languages
}
