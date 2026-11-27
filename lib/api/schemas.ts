import { z } from 'zod'

// Request-body/query parsing for `/api/v1/*`. These only translate the JSON
// wire format (ISO date strings, optional fields) into the inputs the domain
// `*ForUser` functions take; the business validation itself stays in the
// shared schemas (transactionSchema, transferSchema, account schemas) those
// functions already apply.

// `YYYY-MM-DD` (stored as UTC midnight, same as the web form) or a full
// ISO 8601 datetime with timezone. Anything `new Date` would merely guess
// at ('5', 'Nov 5', '2026') is rejected.
const isoDate = z
  .union([z.iso.date(), z.iso.datetime({ offset: true })], {
    error: 'Expected YYYY-MM-DD or an ISO 8601 datetime',
  })
  .transform((value) => new Date(value))

const nullableString = z.string().nullable().optional()

export const createAccountBody = z.object({
  name: z.string(),
  type: z.enum(['cash', 'savings', 'caja']),
  initialBalance: z.number(),
  description: nullableString,
  color: nullableString,
  logoUrl: nullableString,
  icon: nullableString,
})

export const updateAccountBody = z
  .object({
    name: z.string(),
    type: z.enum(['cash', 'savings', 'caja']),
    description: z.string().nullable(),
    color: z.string().nullable(),
    logoUrl: z.string().nullable(),
    icon: z.string().nullable(),
  })
  .partial()
  .strict()

export const createTransactionBody = z.object({
  accountId: z.string().nullable().optional().default(null),
  debtId: z.string().nullable().optional().default(null),
  amount: z.number(),
  type: z.enum(['income', 'expense']),
  categoryId: z.string(),
  subcategoryId: z.string().nullable().optional().default(null),
  description: z.string().optional().default(''),
  date: isoDate,
})

export const updateTransactionBody = z
  .object({
    accountId: z.string().nullable(),
    debtId: z.string().nullable(),
    amount: z.number(),
    type: z.enum(['income', 'expense']),
    categoryId: z.string(),
    subcategoryId: z.string().nullable(),
    description: z.string(),
    date: isoDate,
  })
  .partial()
  .strict()

export const createTransferBody = z.object({
  fromAccountId: z.string(),
  toAccountId: z.string(),
  amount: z.number(),
  date: isoDate,
  note: nullableString,
})

export const updateTransferBody = z
  .object({
    fromAccountId: z.string(),
    toAccountId: z.string(),
    amount: z.number(),
    date: isoDate,
    note: z.string().nullable(),
  })
  .partial()
  .strict()

const optionalInt = (min: number, max: number) =>
  z.coerce.number().int().min(min).max(max).optional()

export const transactionListQuery = z
  .object({
    year: optionalInt(1900, 9999),
    month: optionalInt(1, 12),
    accountId: z.string().uuid().optional(),
  })
  .refine((q) => q.month === undefined || q.year !== undefined, {
    message: 'month requires year',
    path: ['month'],
  })

export const transferListQuery = z
  .object({
    year: optionalInt(1900, 9999),
    month: optionalInt(1, 12),
  })
  .refine((q) => q.month === undefined || q.year !== undefined, {
    message: 'month requires year',
    path: ['month'],
  })

export const categoryListQuery = z.object({
  type: z.enum(['income', 'expense']).optional(),
})

export function searchParamsObject(request: Request) {
  const params = new URL(request.url).searchParams
  return Object.fromEntries(
    [...params.entries()].filter(([, value]) => value !== '')
  )
}
