import {
  optionalString,
  positiveAmount,
  uuidField,
  validDate,
} from '@/lib/validation'
import { z } from 'zod'

export const transactionSchema = z
  .object({
    accountId: uuidField.nullable(),
    debtId: uuidField.nullable(),
    amount: positiveAmount,
    type: z.enum(['income', 'expense']),
    categoryId: uuidField,
    subcategoryId: uuidField.nullable(),
    description: z.string(),
    date: validDate,
  })
  // Exactly one money source. Also enforced by the
  // transaction_single_source CHECK constraint in the database.
  .refine((data) => data.accountId || data.debtId, {
    message: 'An account or debt is required',
    path: ['accountId'],
  })
  .refine((data) => !(data.accountId && data.debtId), {
    message: 'A transaction can come from an account or a debt, not both',
    path: ['debtId'],
  })
  .refine((data) => !data.debtId || data.type === 'expense', {
    message: 'Only expenses can be charged to a debt',
    path: ['debtId'],
  })

export const transferSchema = z
  .object({
    fromAccountId: uuidField,
    toAccountId: uuidField,
    amount: positiveAmount,
    date: validDate,
    note: optionalString,
  })
  .refine((data) => data.fromAccountId !== data.toAccountId, {
    message: 'Source and destination accounts must be different',
    path: ['toAccountId'],
  })

export type TransactionInput = z.infer<typeof transactionSchema>
export type TransferInput = z.infer<typeof transferSchema>
