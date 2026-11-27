'use server'

import {
  categoryNameSchema,
  createCategoryForUser,
  findOrCreateSubcategoryForUser,
  getCategoriesForUser,
} from '@/app/dashboard/categories/domain'
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/session'
import { requiredString } from '@/lib/validation'

export async function getCategories(type?: 'income' | 'expense') {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  return getCategoriesForUser(session.user.id, type)
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
