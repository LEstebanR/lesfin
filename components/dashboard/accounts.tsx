'use client'

import { useCurrency } from '@/components/currency-provider'
import { useLanguage } from '@/components/language-provider'
import { getAccountIcon } from '@/lib/account-icons'
import { formatMoney } from '@/lib/currency'
import { useAccounts } from '@/lib/queries'
import { cn } from '@/lib/utils'
import {
  ArrowUpRight,
  Lock,
  Pencil,
  PiggyBank,
  PlusIcon,
  Wallet,
} from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { Button } from '../ui/button'
import { Loader } from '../ui/loader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { AddAccountDialog } from './add-account-dialog'
import { EditAccountDialog } from './edit-account-dialog'

interface Account {
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
  createdAt: Date
  isArchived: boolean
}

export function Accounts() {
  const currency = useCurrency()
  const { t } = useLanguage()
  const { data: accounts = [], isLoading: loading } = useAccounts()
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)

  const filterAccountsByType = (type: 'all' | 'cash' | 'savings' | 'caja') => {
    const filtered =
      type === 'all' ? accounts : accounts.filter((a) => a.type === type)
    return [...filtered].sort((a, b) => b.currentBalance - a.currentBalance)
  }

  const getAccountTypeMeta = (type: string) => {
    if (type === 'cash') return { Icon: Wallet, label: t('accounts.cash') }
    if (type === 'caja') return { Icon: Lock, label: t('accounts.caja') }
    return { Icon: PiggyBank, label: t('accounts.savings') }
  }

  const AccountCard = ({ account }: { account: Account }) => {
    const { Icon: TypeIcon, label: typeLabel } = getAccountTypeMeta(
      account.type
    )
    const Icon = getAccountIcon(account.icon) ?? TypeIcon
    const accountColor = account.color ?? 'var(--primary)'

    return (
      <div
        className="bg-card text-card-foreground group hover:shadow-lift relative flex min-h-64 flex-col justify-between overflow-hidden rounded-2xl border p-5 shadow-none transition-all duration-300 hover:-translate-y-1"
        style={
          account.color
            ? {
                borderColor: `${account.color}55`,
                background: `linear-gradient(145deg, ${account.color}18 0%, transparent 48%), var(--card)`,
              }
            : undefined
        }
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {account.logoUrl ? (
              <div
                className="bg-card h-14 w-14 overflow-hidden rounded-2xl border p-2 shadow-sm"
                style={{ borderColor: `${accountColor}55` }}
              >
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
                  'flex h-14 w-14 items-center justify-center rounded-2xl',
                  !account.color && 'bg-primary text-primary-foreground'
                )}
                style={
                  account.color ? { backgroundColor: account.color } : undefined
                }
              >
                <Icon
                  className="h-7 w-7"
                  style={
                    account.color
                      ? {
                          color: 'white',
                          filter: 'drop-shadow(0 1px 1px rgb(0 0 0 / 0.2))',
                        }
                      : undefined
                  }
                />
              </div>
            )}
            <div>
              <p className="text-muted-foreground text-[10px] font-black tracking-[0.18em] uppercase">
                {typeLabel}
              </p>
              <p className="mt-1 max-w-32 truncate text-sm font-bold">
                {account.name}
              </p>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full opacity-60 transition-opacity group-hover:opacity-100"
            onClick={() => setEditingAccount(account)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>

        <Link href={`?account&id=${account.id}`} className="block">
          <div className="mt-8">
            <p className="text-muted-foreground mb-2 text-[10px] font-black tracking-[0.18em] uppercase">
              {t('accounts.currentBalance')}
            </p>
            <p
              className={`text-4xl font-black tracking-tighter tabular-nums ${
                account.currentBalance < 0 ? 'text-red-600' : 'text-foreground'
              }`}
            >
              ${formatMoney(Number(account.currentBalance), currency)}
            </p>
          </div>
          <div className="border-foreground/10 mt-5 flex items-center justify-between border-t pt-3">
            <span className="text-muted-foreground text-xs font-medium">
              LESFin account
            </span>
            <ArrowUpRight className="text-muted-foreground h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
        </Link>
      </div>
    )
  }

  const EmptyState = ({
    type,
  }: {
    type: 'all' | 'cash' | 'savings' | 'caja'
  }) => {
    const EmptyIcon = type === 'all' ? Wallet : getAccountTypeMeta(type).Icon
    const typeLabel =
      type === 'all' ? t('accounts.all') : getAccountTypeMeta(type).label

    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <EmptyIcon className="text-muted-foreground/40 mb-4 h-16 w-16" />
        <h3 className="text-foreground mb-2 text-lg font-semibold">
          {t('accounts.noAccountsYet', { type: typeLabel })}
        </h3>
        <p className="text-muted-foreground mb-6 max-w-sm">
          {t('accounts.noAccountsYetDesc', { type: typeLabel.toLowerCase() })}
        </p>
        <AddAccountDialog
          defaultType={type === 'all' ? undefined : type}
          trigger={
            <Button>
              <PlusIcon className="mr-2 h-4 w-4" />
              {t('accounts.createTypeAccount', { type: typeLabel })}
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col items-center justify-center rounded-md p-4 md:mt-4 md:w-11/12 md:p-8">
      <div className="flex w-full justify-end">
        <AddAccountDialog
          trigger={
            <Button>
              <PlusIcon className="size-4" />
              {t('accounts.addAccount')}
            </Button>
          }
        />
      </div>

      <div className="mt-6 w-full">
        {loading ? (
          <Loader className="m-auto" />
        ) : accounts.length === 0 ? (
          <EmptyState type="all" />
        ) : (
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">
                {t('accounts.all')} ({accounts.length})
              </TabsTrigger>
              <TabsTrigger value="cash">
                {t('accounts.cash')} ({filterAccountsByType('cash').length})
              </TabsTrigger>
              <TabsTrigger value="savings">
                {t('accounts.savings')} (
                {filterAccountsByType('savings').length})
              </TabsTrigger>
              <TabsTrigger value="caja">
                {t('accounts.caja')} ({filterAccountsByType('caja').length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-6">
              <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                {filterAccountsByType('all').map((account) => (
                  <AccountCard key={account.id} account={account} />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="cash" className="mt-6">
              {filterAccountsByType('cash').length === 0 ? (
                <EmptyState type="cash" />
              ) : (
                <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                  {filterAccountsByType('cash').map((account) => (
                    <AccountCard key={account.id} account={account} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="savings" className="mt-6">
              {filterAccountsByType('savings').length === 0 ? (
                <EmptyState type="savings" />
              ) : (
                <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                  {filterAccountsByType('savings').map((account) => (
                    <AccountCard key={account.id} account={account} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="caja" className="mt-6">
              {filterAccountsByType('caja').length === 0 ? (
                <EmptyState type="caja" />
              ) : (
                <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                  {filterAccountsByType('caja').map((account) => (
                    <AccountCard key={account.id} account={account} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      <EditAccountDialog
        account={editingAccount}
        open={!!editingAccount}
        onOpenChange={(open) => {
          if (!open) setEditingAccount(null)
        }}
      />
    </div>
  )
}
