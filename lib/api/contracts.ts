// Public contract of the mobile REST API (`/api/v1/*`). See
// docs/mobile-api.md for the endpoints that use these shapes.
//
// This file must stay import-free: the Expo app imports it with
// `import type` and must not pull in Prisma or any server module.
// Dates are ISO 8601 strings; amounts are plain numbers.
// `lib/api/contracts.check.ts` fails typecheck if a domain function's
// return value stops matching these types.

export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'BUSINESS_RULE'
  | 'INTERNAL'

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode
    message: string
    /** Only for VALIDATION_ERROR: messages per field path. */
    details?: Record<string, string[]>
  }
}

export type TransactionType = 'income' | 'expense'
export type AccountType = 'cash' | 'savings' | 'caja'

export type AccountDto = {
  id: string
  userId: string
  name: string
  type: string
  initialBalance: number
  currentBalance: number
  description: string | null
  color: string | null
  logoUrl: string | null
  icon: string | null
  isArchived: boolean
  lockedByPlan: boolean
  createdAt: string
}

export type TransactionDto = {
  id: string
  userId: string
  accountId: string | null
  debtId: string | null
  amount: number
  type: string
  description: string
  date: string
  categoryId: string
  subcategoryId: string | null
  createdAt: string
}

export type TransactionListItemDto = TransactionDto & {
  categoryName: string
  subcategoryName: string | null
  sourceName: string | null
  isDebtSource: boolean
  isDebtPayment: boolean
}

export type TransferDto = {
  id: string
  userId: string
  fromAccountId: string
  toAccountId: string
  amount: number
  date: string
  note: string | null
  createdAt: string
}

export type SubcategoryDto = {
  id: string
  categoryId: string
  userId: string
  name: string
  createdAt: string
}

export type CategoryDto = {
  id: string
  userId: string
  name: string
  type: string
  isDefault: boolean
  defaultKey: string | null
  createdAt: string
  subcategories: SubcategoryDto[]
}

export type OverviewDto = {
  /** Active (non-archived) accounts only. */
  accounts: AccountDto[]
  transactions: (TransactionDto & {
    categoryName: string
    sourceName: string | null
  })[]
  transfers: TransferDto[]
  totalDebt: number
  totalMinimumPayment: number
}

// ---- Request bodies ----

export type CreateAccountBody = {
  name: string
  type: AccountType
  initialBalance: number
  description?: string | null
  color?: string | null
  logoUrl?: string | null
  icon?: string | null
}

export type UpdateAccountBody = Partial<
  Omit<CreateAccountBody, 'initialBalance'>
>

export type CreateTransactionBody = {
  /** Exactly one of accountId / debtId. debtId only for expenses. */
  accountId?: string | null
  debtId?: string | null
  amount: number
  type: TransactionType
  categoryId: string
  subcategoryId?: string | null
  description?: string
  /** `YYYY-MM-DD` or a full ISO 8601 datetime. */
  date: string
}

/** Fields left out keep their value; sending accountId or debtId replaces the source. */
export type UpdateTransactionBody = Partial<CreateTransactionBody>

export type CreateTransferBody = {
  fromAccountId: string
  toAccountId: string
  amount: number
  date: string
  note?: string | null
}

export type UpdateTransferBody = Partial<CreateTransferBody>
