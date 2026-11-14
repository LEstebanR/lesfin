'use client'

import { useLanguage } from '@/components/language-provider'
import { isDebtCategoryBlocked } from '@/lib/expenses'
import { useCategories } from '@/lib/queries'
import Link from 'next/link'

// Whether the selected category is the debt category and the transaction
// isn't already in it — the server rejects that case, so the form blocks it
// up front and points to the debt payment flow instead.
export function useDebtCategoryBlocked(
  categoryId: string,
  previousCategoryId?: string | null
) {
  const { data: categories = [] } = useCategories('expense')
  const category = categories.find((c) => c.id === categoryId)
  return category ? isDebtCategoryBlocked(category, previousCategoryId) : false
}

export function DebtCategoryNotice() {
  const { t } = useLanguage()

  return (
    <p className="bg-muted text-muted-foreground rounded-md p-3 text-sm">
      {t('transactions.debtCategoryBlocked')}{' '}
      <Link href="?debts" className="text-primary font-medium underline">
        {t('transactions.goToDebts')}
      </Link>
    </p>
  )
}
