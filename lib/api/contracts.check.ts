// Compile-time only: fails `bun run typecheck` if what a domain function
// returns (after JSON serialization) stops matching the public contract in
// ./contracts.ts. Nothing here runs.
import type { getAccountsForUser } from '@/app/dashboard/accounts/domain'
import type { getCategoriesForUser } from '@/app/dashboard/categories/domain'
import type { getOverviewDataForUser } from '@/app/dashboard/overview/domain'
import type {
  createTransactionForUser,
  getTransactionsForUser,
  getTransfersForUser,
} from '@/app/dashboard/transactions/domain'

import type {
  AccountDto,
  CategoryDto,
  OverviewDto,
  TransactionDto,
  TransactionListItemDto,
  TransferDto,
} from './contracts'

// What `Response.json` turns a value into: Dates become strings.
type Jsonify<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Jsonify<U>[]
    : T extends object
      ? { [K in keyof T]: Jsonify<T[K]> }
      : T

type Wire<F extends (...args: never[]) => unknown> = Jsonify<
  Awaited<ReturnType<F>>
>

// Both directions, so an added/removed/renamed field fails either way.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
type Assert<T extends true> = T

export type Checks = [
  Assert<Same<Wire<typeof getAccountsForUser>, AccountDto[]>>,
  Assert<Same<Wire<typeof getOverviewDataForUser>, OverviewDto>>,
  Assert<Same<Wire<typeof getTransactionsForUser>, TransactionListItemDto[]>>,
  Assert<Same<Wire<typeof createTransactionForUser>, TransactionDto>>,
  Assert<Same<Wire<typeof getTransfersForUser>, TransferDto[]>>,
  Assert<Same<Wire<typeof getCategoriesForUser>, CategoryDto[]>>,
]
