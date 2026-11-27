'use client'

import {
  archiveAccount,
  deleteAccount,
  getAccountImpact,
} from '@/app/dashboard/accounts/actions'
import { useCurrency } from '@/components/currency-provider'
import { useLanguage } from '@/components/language-provider'
import {
  type AccountImpact,
  type AccountLifecycleError,
  hasHistory,
} from '@/lib/account-lifecycle'
import { formatMoney } from '@/lib/currency'
import { Loader } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'
import { Button } from '../ui/button'
import { useDashboardRefresh } from './refresh-provider'

export type AccountLifecycleMode = 'archive' | 'delete'

const errorKeys: Record<AccountLifecycleError, string> = {
  already_archived: 'accounts.lifecycleFailed',
  not_archived: 'accounts.lifecycleFailed',
  last_active_account: 'accounts.errorLastActiveAccount',
  plan_limit: 'accounts.errorPlanLimit',
  has_history: 'accounts.errorHasHistory',
}

export function accountLifecycleErrorKey(error: AccountLifecycleError) {
  return errorKeys[error]
}

export function AccountLifecycleDialog({
  account,
  mode,
  onOpenChange,
  onDone,
}: {
  account: { id: string; name: string } | null
  mode: AccountLifecycleMode | null
  onOpenChange: (open: boolean) => void
  onDone?: () => void
}) {
  const { t } = useLanguage()
  const currency = useCurrency()
  const { triggerRefresh } = useDashboardRefresh()
  const [impact, setImpact] = useState<AccountImpact | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const open = !!account && !!mode

  useEffect(() => {
    if (!open || !account) return
    let cancelled = false
    setImpact(null)
    getAccountImpact(account.id)
      .then((result) => {
        if (!cancelled) setImpact(result)
      })
      .catch((error) => {
        console.error('Error loading account impact:', error)
        if (cancelled) return
        toast.error(t('accounts.lifecycleFailed'))
        onOpenChange(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, account?.id])

  if (!account || !mode) return null

  const deleteBlocked = mode === 'delete' && !!impact && hasHistory(impact)

  const handleConfirm = async () => {
    setIsSubmitting(true)
    try {
      const result =
        mode === 'archive'
          ? await archiveAccount(account.id)
          : await deleteAccount(account.id)
      if (result.ok) {
        toast.success(
          t(
            mode === 'archive'
              ? 'accounts.accountArchived'
              : 'accounts.accountDeleted'
          )
        )
        triggerRefresh()
        onOpenChange(false)
        onDone?.()
      } else {
        toast.error(t(accountLifecycleErrorKey(result.error)))
      }
    } catch (error) {
      console.error(`Error on ${mode} account:`, error)
      toast.error(t('accounts.lifecycleFailed'))
    }
    setIsSubmitting(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t(
              mode === 'archive'
                ? 'accounts.archiveTitle'
                : 'accounts.deleteTitle',
              { name: account.name }
            )}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {mode === 'archive'
              ? t('accounts.archiveDesc')
              : deleteBlocked
                ? t('accounts.deleteBlocked')
                : t('accounts.deleteDesc')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {impact ? (
          <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
            <li>
              {t('accounts.impactBalance', {
                amount: `${impact.balance < 0 ? '-' : ''}$${formatMoney(impact.balance, currency)}`,
              })}
            </li>
            <li>
              {t('accounts.impactTransactions', {
                count: impact.transactions,
              })}
            </li>
            <li>
              {t('accounts.impactTransfers', { count: impact.transfers })}
            </li>
            <li>
              {t('accounts.impactDebtPayments', {
                count: impact.debtPayments,
              })}
            </li>
            {impact.subscriptions > 0 && (
              <li>
                {t(
                  mode === 'archive'
                    ? 'accounts.impactSubscriptionsArchive'
                    : 'accounts.impactSubscriptionsDelete',
                  { count: impact.subscriptions }
                )}
              </li>
            )}
          </ul>
        ) : (
          <Loader className="text-muted-foreground mx-auto h-5 w-5 animate-spin" />
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>
            {t('settings.cancel')}
          </AlertDialogCancel>
          <Button
            variant={mode === 'delete' ? 'destructive' : 'default'}
            disabled={!impact || deleteBlocked || isSubmitting}
            onClick={handleConfirm}
          >
            {isSubmitting ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              t(mode === 'archive' ? 'accounts.archive' : 'accounts.delete')
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
