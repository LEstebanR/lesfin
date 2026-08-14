import {
  positiveAmount,
  requiredString,
  uuidField,
  validDate,
} from '@/lib/validation'
import { z } from 'zod'

const subscriptionFieldsSchema = z.object({
  name: requiredString,
  categoryId: uuidField,
  subcategoryId: uuidField.nullable(),
  amount: positiveAmount,
  frequency: z.enum(['monthly', 'yearly']),
  dueDay: z.number().int().min(1).max(31),
  dueMonth: z.number().int().min(1).max(12).nullable(),
  accountId: uuidField.nullable(),
  debtId: uuidField.nullable(),
})

// Exactly one payment source, never both and never neither — avoids the
// ambiguous state of a subscription that's simultaneously (or neither)
// charged to an account and a credit card.
const paymentSourceRefinement = (data: {
  accountId: string | null
  debtId: string | null
}) => !!data.accountId !== !!data.debtId

export const updateSubscriptionSchema = subscriptionFieldsSchema.refine(
  paymentSourceRefinement,
  {
    message: 'Exactly one of accountId or debtId is required',
    path: ['accountId'],
  }
)

export const createSubscriptionSchema = subscriptionFieldsSchema
  .extend({ startDate: validDate, isActive: z.boolean().optional() })
  .refine(paymentSourceRefinement, {
    message: 'Exactly one of accountId or debtId is required',
    path: ['accountId'],
  })

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>
