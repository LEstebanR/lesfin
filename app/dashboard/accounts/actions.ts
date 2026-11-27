'use server'

import {
  accountTypeSchema,
  createAccountForUser,
  getAccountsForUser,
  updateAccountForUser,
  updateAccountSchema,
} from '@/app/dashboard/accounts/domain'
import { parseCurrencyInput } from '@/lib/currency'
import { getServerSession } from '@/lib/session'
import { put } from '@vercel/blob'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'

const MAX_ACCOUNT_LOGO_SIZE = 1024 * 1024

export async function getAccounts() {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  return getAccountsForUser(session.user.id)
}

export async function createAccount(formData: FormData) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  return createAccountForUser(session.user.id, {
    accountName: formData.get('accountName') as string,
    accountType: formData.get('accountType') as z.infer<
      typeof accountTypeSchema
    >,
    initialBalance: parseCurrencyInput(formData.get('initialBalance')),
    description: formData.get('description') as string | null,
    color: formData.get('color') as string | null,
    logoUrl: formData.get('logoUrl') as string | null,
    icon: formData.get('icon') as string | null,
  })
}

// Uploaded logos are stored publicly and referenced directly by the account.
export async function uploadAccountLogo(formData: FormData) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  const file = formData.get('logo') as File | null
  if (!file || file.size === 0) throw new Error('No file provided')
  if (!file.type.startsWith('image/')) throw new Error('Invalid image file')
  if (file.size > MAX_ACCOUNT_LOGO_SIZE) throw new Error('Image is too large')

  const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-120)

  const blob = await put(`account-logos/${randomUUID()}-${filename}`, file, {
    access: 'public',
    addRandomSuffix: false,
  })

  return blob.url
}

export async function updateAccount(
  id: string,
  data: {
    name: string
    type: string
    description: string | null
    color: string | null
    logoUrl: string | null
    icon: string | null
  }
) {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  return updateAccountForUser(
    session.user.id,
    id,
    updateAccountSchema.parse(data)
  )
}
