'use client'

import { useCurrency } from '@/components/currency-provider'
import { useLanguage } from '@/components/language-provider'
import { getAccountIcon } from '@/lib/account-icons'
import { formatMoney } from '@/lib/currency'
import { useAccounts, useTransactions, useTransfers } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { ArrowLeft, Lock, Pencil, PiggyBank, Wallet } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'

import { Button } from '../ui/button'
import { Loader } from '../ui/loader'
import { SortableTableHead } from '../ui/sortable-table-head'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table'
import { EditAccountDialog } from './edit-account-dialog'
import {
  EditTransactionDialog,
  type EditableItem,
} from './edit-transaction-dialog'
import { TransactionRowActions } from './transaction-row-actions'

interface MovementRow {
  id: string
  description: string
  date: Date
  signedAmount: number
  editable: EditableItem
}

export function AccountDetail() {
  const currency = useCurrency()
  const { t } = useLanguage()
  const searchParams = useSearchParams()
  const accountId = searchParams.get('id') ?? ''

  const { data: accounts = [], isLoading: loadingAccounts } = useAccounts()
  const { data: transactions = [], isLoading: loadingTransactions } =
    useTransactions()
  const { data: transfers = [], isLoading: loadingTransfers } = useTransfers()
  const loading = loadingAccounts || loadingTransactions || loadingTransfers

  const [editingItem, setEditingItem] = useState<EditableItem | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isEditAccountOpen, setIsEditAccountOpen] = useState(false)
  const [sort, setSort] = useState<'description' | 'amount' | 'date'>('date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const account = accounts.find((a) => a.id === accountId)

  const movements = useMemo<MovementRow[]>(() => {
    const own: MovementRow[] = []

    for (const item of transactions) {
      if (item.accountId !== accountId) continue
      own.push({
        id: item.id,
        description: item.description || item.categoryName,
        date: item.date,
        signedAmount: item.type === 'income' ? item.amount : -item.amount,
        editable: {
          itemType: 'transaction',
          id: item.id,
          accountId: item.accountId,
          debtId: item.debtId,
          amount: item.amount,
          type: item.type,
          description: item.description,
          date: item.date,
          categoryId: item.categoryId,
          subcategoryId: item.subcategoryId,
        },
      })
    }

    for (const item of transfers) {
      const isOutgoing = item.fromAccountId === accountId
      const isIncoming = item.toAccountId === accountId
      if (!isOutgoing && !isIncoming) continue
      const otherAccountId = isOutgoing ? item.toAccountId : item.fromAccountId
      const otherAccountName =
        accounts.find((a) => a.id === otherAccountId)?.name ?? ''
      own.push({
        id: item.id,
        description: isOutgoing
          ? `${t('overview.transfer')} → ${otherAccountName}`
          : `${t('overview.transfer')} ← ${otherAccountName}`,
        date: item.date,
        signedAmount: isOutgoing ? -item.amount : item.amount,
        editable: {
          itemType: 'transfer',
          id: item.id,
          fromAccountId: item.fromAccountId,
          toAccountId: item.toAccountId,
          amount: item.amount,
          date: item.date,
          note: item.note,
        },
      })
    }

    return own
  }, [transactions, transfers, accounts, accountId, t])

  const sortedMovements = useMemo(() => {
    return [...movements].sort((a, b) => {
      const difference =
        sort === 'description'
          ? a.description.localeCompare(b.description)
          : sort === 'amount'
            ? a.signedAmount - b.signedAmount
            : new Date(a.date).getTime() - new Date(b.date).getTime()
      return sortDirection === 'asc' ? difference : -difference
    })
  }, [movements, sort, sortDirection])

  const toggleSort = (key: typeof sort) => {
    if (sort === key)
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'))
    else {
      setSort(key)
      setSortDirection('asc')
    }
  }

  const handleEdit = (item: EditableItem) => {
    setEditingItem(item)
    setIsEditOpen(true)
  }

  if (loading) {
    return (
      <div className="flex w-full justify-center p-8">
        <Loader />
      </div>
    )
  }

  if (!account) {
    return (
      <div className="flex w-full flex-col items-center gap-4 p-8 text-center">
        <p className="text-muted-foreground">{t('accounts.noAccountsFound')}</p>
        <Button asChild variant="outline">
          <Link href="?accounts">{t('accounts.backToAccounts')}</Link>
        </Button>
      </div>
    )
  }

  const TypeIcon =
    account.type === 'cash'
      ? Wallet
      : account.type === 'caja'
        ? Lock
        : PiggyBank
  const Icon = getAccountIcon(account.icon) ?? TypeIcon
  const typeLabel =
    account.type === 'cash'
      ? t('accounts.cash')
      : account.type === 'caja'
        ? t('accounts.caja')
        : t('accounts.savings')

  return (
    <div className="flex w-full flex-col items-center justify-center rounded-md p-4 md:mt-4 md:w-11/12 md:p-8">
      <div className="w-full space-y-6">
        <Button asChild variant="ghost" className="-ml-2">
          <Link href="?accounts">
            <ArrowLeft className="h-4 w-4" />
            {t('accounts.backToAccounts')}
          </Link>
        </Button>

        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {account.logoUrl ? (
              <div className="bg-muted h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element -- external/dynamic logo domains, not worth remotePatterns config */}
                <img
                  src={account.logoUrl}
                  alt=""
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              <div
                className={cn(
                  'shrink-0 rounded-lg p-3',
                  !account.color && 'bg-primary/10'
                )}
                style={
                  account.color
                    ? { backgroundColor: `${account.color}1a` }
                    : undefined
                }
              >
                <Icon
                  className={cn('h-6 w-6', !account.color && 'text-primary')}
                  style={account.color ? { color: account.color } : undefined}
                />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold">{account.name}</h1>
              <span className="text-primary bg-primary/10 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium">
                {typeLabel}
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            className="shrink-0"
            onClick={() => setIsEditAccountOpen(true)}
          >
            <Pencil className="h-4 w-4" />
            {t('transactions.edit')}
          </Button>
        </div>

        <div className="bg-muted/50 rounded-xl p-6">
          <p className="text-muted-foreground mb-1 text-sm">
            {t('accounts.currentBalance')}
          </p>
          <p
            className={`text-3xl font-bold ${
              account.currentBalance < 0 ? 'text-red-600' : ''
            }`}
          >
            ${formatMoney(Number(account.currentBalance), currency)}
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">{t('accounts.movements')}</h2>
          <p className="text-muted-foreground text-sm">
            {t('accounts.movementsDesc')}
          </p>

          {movements.length === 0 ? (
            <p className="text-muted-foreground mt-6 text-center text-sm">
              {t('accounts.noMovements')}
            </p>
          ) : (
            <div className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead
                      active={sort === 'description'}
                      direction={sortDirection}
                      onSort={() => toggleSort('description')}
                    >
                      {t('transactions.table.description')}
                    </SortableTableHead>
                    <SortableTableHead
                      active={sort === 'amount'}
                      direction={sortDirection}
                      onSort={() => toggleSort('amount')}
                    >
                      {t('transactions.table.amount')}
                    </SortableTableHead>
                    <SortableTableHead
                      active={sort === 'date'}
                      direction={sortDirection}
                      onSort={() => toggleSort('date')}
                    >
                      {t('transactions.table.date')}
                    </SortableTableHead>
                    <TableHead className="text-right">
                      {t('transactions.table.actions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedMovements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell className="font-medium">
                        {movement.description}
                      </TableCell>
                      <TableCell
                        className={
                          movement.signedAmount >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }
                      >
                        {movement.signedAmount >= 0 ? '+' : ''}$
                        {formatMoney(Math.abs(movement.signedAmount), currency)}
                      </TableCell>
                      <TableCell>
                        {new Date(movement.date).toLocaleDateString(undefined, {
                          timeZone: 'UTC',
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <TransactionRowActions
                          item={movement.editable}
                          onEdit={handleEdit}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      <EditTransactionDialog
        item={editingItem}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
      />
      <EditAccountDialog
        account={account}
        open={isEditAccountOpen}
        onOpenChange={setIsEditAccountOpen}
      />
    </div>
  )
}
