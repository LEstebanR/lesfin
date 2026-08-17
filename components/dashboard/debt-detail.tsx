'use client'

import { useCurrency } from '@/components/currency-provider'
import { useLanguage } from '@/components/language-provider'
import { formatMoney } from '@/lib/currency'
import {
  useDebtInterestCharges,
  useDebtPayments,
  useDebts,
  useTransactions,
} from '@/lib/queries'
import { cn } from '@/lib/utils'
import { ArrowLeft, CreditCard, Landmark, Pencil } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'

import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Loader } from '../ui/loader'
import { SortableTableHead } from '../ui/sortable-table-head'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '../ui/table'
import { EditDebtDialog } from './edit-debt-dialog'

type MovementType = 'payment' | 'interest' | 'purchase'

interface MovementRow {
  id: string
  type: MovementType
  description: string
  date: Date
  amount: number
  signedAmount: number
}

export function DebtDetail() {
  const currency = useCurrency()
  const { t } = useLanguage()
  const searchParams = useSearchParams()
  const debtId = searchParams.get('id') ?? ''

  const { data: debts = [], isLoading: loadingDebts } = useDebts()
  const { data: payments = [], isLoading: loadingPayments } =
    useDebtPayments(debtId)
  const { data: interestCharges = [], isLoading: loadingInterest } =
    useDebtInterestCharges(debtId)
  const { data: transactions = [], isLoading: loadingTransactions } =
    useTransactions()
  const loading =
    loadingDebts || loadingPayments || loadingInterest || loadingTransactions

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [sort, setSort] = useState<'type' | 'description' | 'amount' | 'date'>(
    'date'
  )
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const debt = debts.find((d) => d.id === debtId)

  const purchases = useMemo(
    () => transactions.filter((item) => item.debtId === debtId),
    [transactions, debtId]
  )

  const movements = useMemo<MovementRow[]>(() => {
    const rows: MovementRow[] = []

    for (const payment of payments) {
      rows.push({
        id: payment.id,
        type: 'payment',
        description: payment.note || t('debts.payment'),
        date: payment.date,
        amount: payment.amount,
        signedAmount: payment.amount,
      })
    }

    for (const charge of interestCharges) {
      rows.push({
        id: charge.id,
        type: 'interest',
        description: charge.note || t('debts.interest'),
        date: charge.date,
        amount: charge.amount,
        signedAmount: -charge.amount,
      })
    }

    for (const purchase of purchases) {
      rows.push({
        id: purchase.id,
        type: 'purchase',
        description: purchase.description || purchase.categoryName,
        date: purchase.date,
        amount: purchase.amount,
        signedAmount: -purchase.amount,
      })
    }

    return rows
  }, [payments, interestCharges, purchases, t])

  const sortedMovements = useMemo(() => {
    return [...movements].sort((a, b) => {
      const difference =
        sort === 'type'
          ? a.type.localeCompare(b.type)
          : sort === 'description'
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

  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0)
  const totalInterest = interestCharges.reduce(
    (sum, charge) => sum + charge.amount,
    0
  )
  const totalPurchases = purchases.reduce(
    (sum, purchase) => sum + purchase.amount,
    0
  )

  const movementTypeLabel = (type: MovementType) =>
    type === 'payment'
      ? t('debts.payment')
      : type === 'interest'
        ? t('debts.interest')
        : t('debts.purchase')

  if (loading) {
    return (
      <div className="flex w-full justify-center p-8">
        <Loader />
      </div>
    )
  }

  if (!debt) {
    return (
      <div className="flex w-full flex-col items-center gap-4 p-8 text-center">
        <p className="text-muted-foreground">{t('debts.debtNotFound')}</p>
        <Button asChild variant="outline">
          <Link href="?debts">{t('debts.backToDebts')}</Link>
        </Button>
      </div>
    )
  }

  const isPaidOff = debt.remainingBalance <= 0

  return (
    <div className="flex w-full flex-col items-center justify-center rounded-md p-4 md:mt-4 md:w-11/12 md:p-8">
      <div className="w-full space-y-6">
        <Button asChild variant="ghost" className="-ml-2">
          <Link href="?debts">
            <ArrowLeft className="h-4 w-4" />
            {t('debts.backToDebts')}
          </Link>
        </Button>

        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-primary/10 shrink-0 rounded-lg p-3">
              <Landmark className="text-primary h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold">{debt.name}</h1>
              {debt.type === 'credit_card' && (
                <Badge variant="secondary" className="mt-1 gap-1">
                  <CreditCard className="h-3 w-3" />
                  {t('debts.creditCard')}
                </Badge>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            className="shrink-0"
            onClick={() => setIsEditOpen(true)}
          >
            <Pencil className="h-4 w-4" />
            {t('debts.edit')}
          </Button>
        </div>

        <div className="bg-muted/50 rounded-xl p-6">
          <p className="text-muted-foreground mb-1 text-sm">
            {t('debts.remainingBalance')}
          </p>
          <p
            className={cn('text-3xl font-bold', isPaidOff && 'text-green-600')}
          >
            ${formatMoney(debt.remainingBalance, currency)}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {t('debts.totalPaid')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-green-600">
                ${formatMoney(totalPaid, currency)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {t('debts.totalInterest')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-red-600">
                ${formatMoney(totalInterest, currency)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {t('debts.totalPurchases')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-red-600">
                ${formatMoney(totalPurchases, currency)}
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="text-lg font-semibold">{t('debts.movements')}</h2>
          <p className="text-muted-foreground text-sm">
            {t('debts.movementsDesc')}
          </p>

          {movements.length === 0 ? (
            <p className="text-muted-foreground mt-6 text-center text-sm">
              {t('debts.noMovements')}
            </p>
          ) : (
            <div className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead
                      active={sort === 'type'}
                      direction={sortDirection}
                      onSort={() => toggleSort('type')}
                    >
                      {t('transactions.table.type')}
                    </SortableTableHead>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedMovements.map((movement) => (
                    <TableRow key={`${movement.type}-${movement.id}`}>
                      <TableCell>
                        <Badge variant="secondary">
                          {movementTypeLabel(movement.type)}
                        </Badge>
                      </TableCell>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      <EditDebtDialog
        debt={debt}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
      />
    </div>
  )
}
