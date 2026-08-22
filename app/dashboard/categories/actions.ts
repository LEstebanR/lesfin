'use server'

import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/session'
import { requiredString, uuidField } from '@/lib/validation'
import { z } from 'zod'

const categoryNameSchema = requiredString
const categoryTypeSchema = z.enum(['income', 'expense'])

type CategoryLanguage = 'en' | 'es'

const DEFAULT_CATEGORIES = [
  { key: 'food', en: 'Food', es: 'Alimentación', type: 'expense' },
  { key: 'charity', en: 'Charity', es: 'Caridad', type: 'expense' },
  { key: 'debt', en: 'Debt', es: 'Deuda', type: 'expense' },
  { key: 'education', en: 'Education', es: 'Educación', type: 'expense' },
  {
    key: 'entertainment',
    en: 'Entertainment',
    es: 'Entretenimiento',
    type: 'expense',
  },
  { key: 'family', en: 'Family', es: 'Familia', type: 'expense' },
  { key: 'home', en: 'Home', es: 'Hogar', type: 'expense' },
  { key: 'legal', en: 'Legal', es: 'Legal', type: 'expense' },
  { key: 'pets', en: 'Pets', es: 'Mascotas', type: 'expense' },
  { key: 'gifts', en: 'Gifts', es: 'Regalos', type: 'expense' },
  { key: 'clothing', en: 'Clothing', es: 'Ropa', type: 'expense' },
  { key: 'health', en: 'Health', es: 'Salud', type: 'expense' },
  { key: 'utilities', en: 'Utilities', es: 'Servicios', type: 'expense' },
  { key: 'transport', en: 'Transport', es: 'Transporte', type: 'expense' },
  { key: 'other', en: 'Other', es: 'Otros', type: 'expense' },
  { key: 'salary', en: 'Salary', es: 'Salario', type: 'income' },
  { key: 'freelance', en: 'Freelance', es: 'Freelance', type: 'income' },
  { key: 'investments', en: 'Investments', es: 'Inversiones', type: 'income' },
  { key: 'refunds', en: 'Refunds', es: 'Reembolsos', type: 'income' },
  {
    key: 'gifts-received',
    en: 'Gifts received',
    es: 'Regalos recibidos',
    type: 'income',
  },
  {
    key: 'other-income',
    en: 'Other income',
    es: 'Otros ingresos',
    type: 'income',
  },
] as const

function defaultCategoryName(
  category: (typeof DEFAULT_CATEGORIES)[number],
  language: CategoryLanguage
) {
  return category[language]
}

export async function syncDefaultCategoriesForUser(
  userId: string,
  language: CategoryLanguage
) {
  const defaults = await prisma.category.findMany({
    where: { userId, isDefault: true },
    select: { id: true, name: true, type: true, defaultKey: true },
  })

  const updates = defaults.flatMap((existing) => {
    const definition = DEFAULT_CATEGORIES.find(
      (category) => category.key === existing.defaultKey
    )
    if (!definition) return []

    const name = defaultCategoryName(definition, language)
    return existing.name === name
      ? []
      : [prisma.category.update({ where: { id: existing.id }, data: { name } })]
  })

  await prisma.$transaction(updates)
}

function findMissingDefaults(
  existing: { defaultKey: string | null }[],
  language: CategoryLanguage
) {
  const existingKeys = new Set(existing.map((c) => c.defaultKey))
  const defaults = DEFAULT_CATEGORIES.map((category) => ({
    key: category.key,
    name: defaultCategoryName(category, language),
    type: category.type,
  }))
  return defaults.filter(({ key }) => !existingKeys.has(key))
}

export async function getCategoriesForUser(
  userId: string,
  type?: 'income' | 'expense'
) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { language: true },
  })
  const language: CategoryLanguage = user.language === 'es' ? 'es' : 'en'
  await syncDefaultCategoriesForUser(userId, language)

  const where = { userId, ...(type ? { type } : {}) }
  const categories = await prisma.category.findMany({
    where,
    include: { subcategories: { orderBy: { name: 'asc' } } },
    orderBy: { name: 'asc' },
  })

  // Defaults are seeded once per user; checking against the type-filtered
  // list would false-positive on "missing" categories of the other type, so
  // check against the user's full category list instead.
  const allCategories =
    type === undefined
      ? categories
      : await prisma.category.findMany({
          where: { userId },
          select: { defaultKey: true },
        })
  const missing = findMissingDefaults(allCategories, language)
  if (missing.length === 0) return categories

  await prisma.category.createMany({
    data: missing.map(({ key, name, type: missingType }) => ({
      userId,
      name,
      type: missingType,
      defaultKey: key,
      isDefault: true,
    })),
  })

  return prisma.category.findMany({
    where,
    include: { subcategories: { orderBy: { name: 'asc' } } },
    orderBy: { name: 'asc' },
  })
}

export async function getCategories(type?: 'income' | 'expense') {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  return getCategoriesForUser(session.user.id, type)
}

export async function createCategoryForUser(
  userId: string,
  name: string,
  type: 'income' | 'expense'
) {
  const trimmed = categoryNameSchema.parse(name)
  categoryTypeSchema.parse(type)

  const existing = await prisma.category.findFirst({
    where: { userId, type, name: { equals: trimmed, mode: 'insensitive' } },
  })
  if (existing) return existing

  return prisma.category.create({
    data: { userId, name: trimmed, type, isDefault: false },
  })
}

export async function createCategory(name: string, type: 'income' | 'expense') {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  return createCategoryForUser(session.user.id, name, type)
}

export async function updateCategory(id: string, name: string) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const trimmed = categoryNameSchema.parse(name)

  await prisma.category.findFirstOrThrow({
    where: { id, userId: session.user.id },
  })

  return prisma.category.update({ where: { id }, data: { name: trimmed } })
}

export async function deleteCategory(id: string) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  await prisma.category.findFirstOrThrow({
    where: { id, userId: session.user.id },
  })

  await prisma.category.delete({ where: { id } })
}

export async function getSubcategories(categoryId: string) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  return prisma.subcategory.findMany({
    where: { categoryId, userId: session.user.id },
    orderBy: { name: 'asc' },
  })
}

export async function findOrCreateSubcategoryForUser(
  userId: string,
  categoryId: string,
  name: string
) {
  uuidField.parse(categoryId)
  const trimmed = requiredString.parse(name)

  await prisma.category.findFirstOrThrow({
    where: { id: categoryId, userId },
  })

  const existing = await prisma.subcategory.findFirst({
    where: {
      categoryId,
      userId,
      name: { equals: trimmed, mode: 'insensitive' },
    },
  })
  if (existing) return existing

  return prisma.subcategory.create({
    data: { categoryId, userId, name: trimmed },
  })
}

export async function findOrCreateSubcategory(
  categoryId: string,
  name: string
) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  return findOrCreateSubcategoryForUser(session.user.id, categoryId, name)
}

export async function updateSubcategory(id: string, name: string) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const trimmed = requiredString.parse(name)

  await prisma.subcategory.findFirstOrThrow({
    where: { id, userId: session.user.id },
  })

  return prisma.subcategory.update({ where: { id }, data: { name: trimmed } })
}

export async function deleteSubcategory(id: string) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  await prisma.subcategory.findFirstOrThrow({
    where: { id, userId: session.user.id },
  })

  await prisma.subcategory.delete({ where: { id } })
}
