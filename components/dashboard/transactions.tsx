'use client'

import { useCurrency } from '@/components/currency-provider'
import { useLanguage } from '@/components/language-provider'
import { formatMoney } from '@/lib/currency'
import { useAccounts, useTransactions, useTransfers } from '@/lib/queries'
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  PlusIcon,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '../ui/button'
import { DatePicker } from '../ui/date-picker'
import { Input } from '../ui/input'
import { Loader } from '../ui/loader'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { SortableTableHead } from '../ui/sortable-table-head'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { AddTransactionDialog } from './add-transaction-dialog'
import {
  EditTransactionDialog,
  type EditableItem,
} from './edit-transaction-dialog'
import { TransactionRowActions } from './transaction-row-actions'

const ALL = 'all'

interface Transaction {
  id: string
  accountId: string | null
  debtId: string | null
  amount: number
  type: string
  description: string
  date: Date
  categoryId: string
  subcategoryId: string | null
  categoryName: string
  subcategoryName: string | null
  sourceName: string | null
  isDebtPayment: boolean
  createdAt: Date
}

interface Transfer {
  id: string
  fromAccountId: string
  toAccountId: string
  amount: number
  date: Date
  note: string | null
  createdAt: Date
}

type CombinedItem =
  | (Transaction & { itemType: 'transaction' })
  | (Transfer & {
      itemType: 'transfer'
      fromAccountName?: string
      toAccountName?: string
    })

function toEditableItem(item: CombinedItem): EditableItem {
  if (item.itemType === 'transfer') {
    return {
      itemType: 'transfer',
      id: item.id,
      fromAccountId: item.fromAccountId,
      toAccountId: item.toAccountId,
      amount: item.amount,
      date: item.date,
      note: item.note,
    }
  }
  return {
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
  }
}

export function Transactions() {
  const currency = useCurrency()
  const { t } = useLanguage()
  const { data: transactions = [], isLoading: loadingTransactions } =
    useTransactions()
  const { data: transfers = [], isLoading: loadingTransfers } = useTransfers()
  const { data: accounts = [], isLoading: loadingAccounts } = useAccounts()
  const loading = loadingTransactions || loadingTransfers || loadingAccounts
  const [currentPage, setCurrentPage] = useState(1)
  const [transactionsPerPage] = useState(10)
  const [editingItem, setEditingItem] = useState<EditableItem | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [sort, setSort] = useState<{
    key: 'description' | 'account' | 'type' | 'category' | 'amount' | 'date'
    direction: 'asc' | 'desc'
  }>({ key: 'date', direction: 'desc' })
  const [search, setSearch] = useState('')
  const [accountFilter, setAccountFilter] = useState(ALL)
  const [categoryFilter, setCategoryFilter] = useState(ALL)
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)

  const combinedItems = useMemo(() => {
    const accountMap = new Map<string, string>()
    for (const account of accounts) {
      accountMap.set(account.id, account.name)
    }

    const transactionItems: CombinedItem[] = transactions.map((tItem) => ({
      ...tItem,
      itemType: 'transaction' as const,
    }))

    const transferItems: CombinedItem[] = transfers.map((tItem) => ({
      ...tItem,
      itemType: 'transfer' as const,
      fromAccountName: accountMap.get(tItem.fromAccountId),
      toAccountName: accountMap.get(tItem.toAccountId),
    }))

    return [...transactionItems, ...transferItems]
  }, [accounts, transactions, transfers])

  const accountOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of combinedItems) {
      if (item.itemType === 'transaction') {
        const id = item.accountId ?? item.debtId
        if (id && item.sourceName) map.set(id, item.sourceName)
      } else {
        if (item.fromAccountName)
          map.set(item.fromAccountId, item.fromAccountName)
        if (item.toAccountName) map.set(item.toAccountId, item.toAccountName)
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [combinedItems])

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of combinedItems) {
      if (item.itemType === 'transaction' && item.categoryName) {
        map.set(item.categoryId, item.categoryName)
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [combinedItems])

  const hasActiveFilters =
    search.trim() !== '' ||
    accountFilter !== ALL ||
    categoryFilter !== ALL ||
    dateFrom !== undefined ||
    dateTo !== undefined

  const clearFilters = () => {
    setSearch('')
    setAccountFilter(ALL)
    setCategoryFilter(ALL)
    setDateFrom(undefined)
    setDateTo(undefined)
  }

  const filteredCombinedItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    const from = dateFrom
      ? new Date(
          Date.UTC(
            dateFrom.getFullYear(),
            dateFrom.getMonth(),
            dateFrom.getDate()
          )
        )
      : null
    const to = dateTo
      ? new Date(
          Date.UTC(
            dateTo.getFullYear(),
            dateTo.getMonth(),
            dateTo.getDate(),
            23,
            59,
            59
          )
        )
      : null

    const filtered = combinedItems.filter((item) => {
      if (accountFilter !== ALL) {
        const matchesAccount =
          item.itemType === 'transaction'
            ? item.accountId === accountFilter || item.debtId === accountFilter
            : item.fromAccountId === accountFilter ||
              item.toAccountId === accountFilter
        if (!matchesAccount) return false
      }

      if (categoryFilter !== ALL) {
        if (
          item.itemType !== 'transaction' ||
          item.categoryId !== categoryFilter
        )
          return false
      }

      const itemDate = new Date(item.date)
      if (from && itemDate < from) return false
      if (to && itemDate > to) return false

      if (query) {
        const text =
          item.itemType === 'transaction'
            ? (item.description || item.categoryName || '').toLowerCase()
            : (item.note || '').toLowerCase()
        if (!text.includes(query)) return false
      }

      return true
    })

    const textValue = (
      item: CombinedItem,
      key: 'description' | 'account' | 'type' | 'category'
    ) => {
      if (key === 'description') {
        return item.itemType === 'transaction'
          ? item.description || item.categoryName
          : item.note || t('overview.transfer')
      }
      if (key === 'account') {
        return item.itemType === 'transaction'
          ? item.sourceName || ''
          : `${item.fromAccountName ?? ''} ${item.toAccountName ?? ''}`
      }
      if (key === 'type') {
        return item.itemType === 'transfer' ? 'transfer' : item.type
      }
      return item.itemType === 'transaction' ? item.categoryName : ''
    }

    return filtered.sort((a, b) => {
      let diff: number
      if (sort.key === 'amount') diff = Number(a.amount) - Number(b.amount)
      else if (sort.key === 'date')
        diff = new Date(a.date).getTime() - new Date(b.date).getTime()
      else diff = textValue(a, sort.key).localeCompare(textValue(b, sort.key))
      return sort.direction === 'asc' ? diff : -diff
    })
  }, [
    combinedItems,
    accountFilter,
    categoryFilter,
    dateFrom,
    dateTo,
    search,
    sort,
    t,
  ])

  useEffect(() => {
    setCurrentPage(1)
  }, [accountFilter, categoryFilter, dateFrom, dateTo, search, sort])

  const toggleSort = (key: typeof sort.key) => {
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const filterItemsByType = (
    type: 'all' | 'income' | 'expense' | 'transfer'
  ) => {
    if (type === 'all') return filteredCombinedItems
    if (type === 'transfer') {
      return filteredCombinedItems.filter(
        (item) => item.itemType === 'transfer'
      )
    }
    return filteredCombinedItems.filter(
      (item) => item.itemType === 'transaction' && item.type === type
    )
  }

  const paginate = (items: CombinedItem[], page: number) => {
    const startIndex = (page - 1) * transactionsPerPage
    const endIndex = startIndex + transactionsPerPage
    return items.slice(startIndex, endIndex)
  }

  const getTotalPages = (items: CombinedItem[]) => {
    return Math.ceil(items.length / transactionsPerPage)
  }

  const handleEdit = (item: EditableItem) => {
    setEditingItem(item)
    setIsEditOpen(true)
  }

  const EmptyState = () => (
    <div className="bg-card text-card-foreground border-border shadow-soft flex flex-col items-center justify-center rounded-2xl border py-12 text-center">
      <CreditCard className="text-muted-foreground/40 mb-4 h-16 w-16" />
      <h3 className="text-foreground mb-2 text-lg font-semibold">
        {t('transactions.noItemsFound')}
      </h3>
      <p className="text-muted-foreground mb-6 max-w-sm">
        {t('transactions.noItemsFoundDesc')}
      </p>
      <AddTransactionDialog
        trigger={
          <Button>
            <PlusIcon className="mr-2 h-4 w-4" />
            {t('transactions.addTransaction')}
          </Button>
        }
      />
    </div>
  )

  const NoResultsState = () => (
    <div className="bg-card text-card-foreground border-border shadow-soft flex flex-col items-center justify-center rounded-2xl border py-12 text-center">
      <CreditCard className="text-muted-foreground/40 mb-4 h-16 w-16" />
      <h3 className="text-foreground mb-2 text-lg font-semibold">
        {t('transactions.noResultsFiltered')}
      </h3>
      <p className="text-muted-foreground mb-6 max-w-sm">
        {t('transactions.noResultsFilteredDesc')}
      </p>
      <Button variant="outline" onClick={clearFilters}>
        <X className="mr-2 h-4 w-4" />
        {t('transactions.clearFilters')}
      </Button>
    </div>
  )

  return (
    <div className="flex w-full flex-col items-center justify-center rounded-md p-4 md:mt-4 md:w-11/12 md:p-8">
      <div className="flex w-full justify-end">
        <AddTransactionDialog
          trigger={
            <Button>
              <PlusIcon className="size-4" />
              {t('transactions.addTransaction')}
            </Button>
          }
        />
      </div>

      {!loading && combinedItems.length > 0 && (
        <div className="mt-6 grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input
            placeholder={t('transactions.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="lg:col-span-2"
          />
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('transactions.allAccounts')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>
                {t('transactions.allAccounts')}
              </SelectItem>
              {accountOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('transactions.allCategories')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>
                {t('transactions.allCategories')}
              </SelectItem>
              {categoryOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <DatePicker
                value={dateFrom}
                onChange={setDateFrom}
                placeholder={t('transactions.dateFrom')}
              />
            </div>
            <div className="min-w-0 flex-1">
              <DatePicker
                value={dateTo}
                onChange={setDateTo}
                placeholder={t('transactions.dateTo')}
              />
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className={`justify-self-start lg:col-span-5 ${
              hasActiveFilters ? '' : 'invisible'
            }`}
          >
            <X className="mr-2 h-4 w-4" />
            {t('transactions.clearFilters')}
          </Button>
        </div>
      )}

      <div className="mt-6 w-full">
        {loading ? (
          <div className="flex justify-center">
            <Loader />
          </div>
        ) : combinedItems.length === 0 ? (
          <EmptyState />
        ) : (
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="all" className="shrink-0">
                {t('transactions.all')} ({combinedItems.length})
              </TabsTrigger>
              <TabsTrigger value="income" className="shrink-0">
                {t('transactions.income')} ({filterItemsByType('income').length}
                )
              </TabsTrigger>
              <TabsTrigger value="expense" className="shrink-0">
                {t('transactions.expense')} (
                {filterItemsByType('expense').length})
              </TabsTrigger>
              <TabsTrigger value="transfer" className="shrink-0">
                {t('transactions.transfer')} (
                {filterItemsByType('transfer').length})
              </TabsTrigger>
            </TabsList>

            {['all', 'income', 'expense', 'transfer'].map((tabType) => {
              const filteredItems = filterItemsByType(
                tabType as 'all' | 'income' | 'expense' | 'transfer'
              )
              const paginatedItems = paginate(filteredItems, currentPage)
              const totalPages = getTotalPages(filteredItems)

              return (
                <TabsContent key={tabType} value={tabType} className="mt-6">
                  {filteredItems.length === 0 ? (
                    hasActiveFilters ? (
                      <NoResultsState />
                    ) : (
                      <EmptyState />
                    )
                  ) : (
                    <>
                      <div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <SortableTableHead
                                active={sort.key === 'description'}
                                direction={sort.direction}
                                onSort={() => toggleSort('description')}
                              >
                                {t('transactions.table.description')}
                              </SortableTableHead>
                              <SortableTableHead
                                active={sort.key === 'account'}
                                direction={sort.direction}
                                onSort={() => toggleSort('account')}
                              >
                                {t('transactions.table.account')}
                              </SortableTableHead>
                              <SortableTableHead
                                active={sort.key === 'type'}
                                direction={sort.direction}
                                onSort={() => toggleSort('type')}
                              >
                                {t('transactions.table.type')}
                              </SortableTableHead>
                              <SortableTableHead
                                active={sort.key === 'category'}
                                direction={sort.direction}
                                onSort={() => toggleSort('category')}
                              >
                                {t('transactions.table.category')}
                              </SortableTableHead>
                              <SortableTableHead
                                active={sort.key === 'amount'}
                                direction={sort.direction}
                                onSort={() => toggleSort('amount')}
                              >
                                {t('transactions.table.amount')}
                              </SortableTableHead>
                              <SortableTableHead
                                active={sort.key === 'date'}
                                direction={sort.direction}
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
                            {paginatedItems.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">
                                  {item.itemType === 'transaction'
                                    ? item.description || item.categoryName
                                    : item.note || t('overview.transfer')}
                                </TableCell>
                                <TableCell>
                                  {item.itemType === 'transaction' ? (
                                    item.sourceName || '-'
                                  ) : (
                                    <span className="text-xs">
                                      {item.fromAccountName} →{' '}
                                      {item.toAccountName}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {item.itemType === 'transaction' ? (
                                    <span
                                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                        item.type === 'income'
                                          ? 'bg-green-100 text-green-800'
                                          : 'bg-red-100 text-red-800'
                                      }`}
                                    >
                                      {item.type === 'income'
                                        ? t('transactions.income')
                                        : t('transactions.expense')}
                                    </span>
                                  ) : (
                                    <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                                      {t('overview.transfer')}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {item.itemType === 'transaction'
                                    ? item.categoryName || '-'
                                    : '-'}
                                </TableCell>
                                <TableCell
                                  className={
                                    item.itemType === 'transaction'
                                      ? item.type === 'income'
                                        ? 'text-green-600'
                                        : 'text-red-600'
                                      : 'text-blue-600'
                                  }
                                >
                                  {item.itemType === 'transaction' &&
                                  item.type === 'income'
                                    ? '+'
                                    : ''}
                                  ${formatMoney(Number(item.amount), currency)}
                                </TableCell>
                                <TableCell>
                                  {new Date(item.date).toLocaleDateString(
                                    undefined,
                                    { timeZone: 'UTC' }
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {item.itemType === 'transaction' &&
                                  item.isDebtPayment ? (
                                    <span className="text-muted-foreground text-xs">
                                      {t('transactions.debtPaymentLocked')}
                                    </span>
                                  ) : (
                                    <TransactionRowActions
                                      item={toEditableItem(item)}
                                      onEdit={handleEdit}
                                    />
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {totalPages > 1 && (
                        <div className="mt-4 flex items-center justify-between gap-2">
                          <div className="text-muted-foreground text-sm">
                            {(currentPage - 1) * transactionsPerPage + 1}–
                            {Math.min(
                              currentPage * transactionsPerPage,
                              filteredItems.length
                            )}{' '}
                            {t('transactions.of')} {filteredItems.length}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => setCurrentPage(currentPage - 1)}
                              disabled={currentPage === 1}
                              aria-label={t('transactions.previous')}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => setCurrentPage(currentPage + 1)}
                              disabled={currentPage === totalPages}
                              aria-label={t('transactions.next')}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>
              )
            })}
          </Tabs>
        )}
      </div>

      <EditTransactionDialog
        item={editingItem}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
      />
    </div>
  )
}
