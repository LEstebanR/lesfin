// Pure rules for archiving, restoring and permanently deleting accounts.
// Server Actions load the data and enforce these; the UI uses the same
// impact summary to explain what will happen before confirming.

export interface AccountImpact {
  balance: number
  transactions: number
  transfers: number
  debtPayments: number
  subscriptions: number
}

export type ArchiveError = 'already_archived' | 'last_active_account'
export type RestoreError = 'not_archived' | 'plan_limit'
export type DeleteError = 'has_history'
export type AccountLifecycleError = ArchiveError | RestoreError | DeleteError

export function hasHistory(impact: AccountImpact) {
  return impact.transactions + impact.transfers + impact.debtPayments > 0
}

// The last active account can't be archived: every money flow needs an
// account to come from or go to.
export function getArchiveError(input: {
  isArchived: boolean
  activeCount: number
}): ArchiveError | null {
  if (input.isArchived) return 'already_archived'
  if (input.activeCount <= 1) return 'last_active_account'
  return null
}

// `limit` is null when the plan has no account limit (Pro).
export function getRestoreError(input: {
  isArchived: boolean
  activeCount: number
  limit: number | null
}): RestoreError | null {
  if (!input.isArchived) return 'not_archived'
  if (input.limit !== null && input.activeCount >= input.limit) {
    return 'plan_limit'
  }
  return null
}

// Hard delete cascades to transactions/transfers/debt payments, and a
// cascaded transfer would leave the other account's balance wrong — so only
// accounts without history can be deleted. Linked subscriptions are simply
// unlinked (`onDelete: SetNull`).
export function getDeleteError(impact: AccountImpact): DeleteError | null {
  return hasHistory(impact) ? 'has_history' : null
}
