'use client'

import { useLanguage } from '@/components/language-provider'
import { Lock, PiggyBank, PlusIcon, Wallet } from 'lucide-react'

function MockShell({ children }: { children: React.ReactNode }) {
  return <div className="bg-card shadow-soft rounded-2xl p-5">{children}</div>
}

export function AccountsMock() {
  const { t } = useLanguage()
  const rows = [
    {
      label: t('accounts.cash'),
      amount: '$4.820.000',
      Icon: Wallet,
      color: '#10b981',
    },
    {
      label: t('accounts.savings'),
      amount: '$12.500.000',
      Icon: PiggyBank,
      color: '#3b82f6',
    },
    {
      label: t('accounts.caja'),
      amount: '$650.000',
      Icon: Lock,
      color: '#a855f7',
    },
  ]

  return (
    <MockShell>
      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className="bg-muted/50 flex items-center justify-between rounded-xl p-3"
          >
            <div className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${row.color}1a` }}
              >
                <row.Icon className="h-4 w-4" style={{ color: row.color }} />
              </span>
              <span className="text-sm font-medium">{row.label}</span>
            </div>
            <span className="text-sm font-semibold">{row.amount}</span>
          </div>
        ))}
      </div>
    </MockShell>
  )
}

export function TransactionMock() {
  const { t } = useLanguage()

  return (
    <MockShell>
      <div className="space-y-3">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">
            {t('transactions.amount')}
          </span>
          <div className="bg-muted/50 rounded-lg px-3 py-2.5 text-lg font-bold">
            $85.400
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">
            {t('transactions.category')}
          </span>
          <div className="flex flex-wrap gap-2">
            {[
              t('transactions.income'),
              t('transactions.expense'),
              t('overview.transfer'),
            ].map((label, i) => (
              <span
                key={label}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  i === 1
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
        <div className="bg-primary text-primary-foreground flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold">
          <PlusIcon className="h-4 w-4" />
          {t('transactions.addTransaction')}
        </div>
      </div>
    </MockShell>
  )
}

export function AssistantMock() {
  const { t } = useLanguage()

  return (
    <MockShell>
      <div className="space-y-3">
        <div className="flex justify-end">
          <div className="bg-primary text-primary-foreground max-w-[85%] rounded-2xl rounded-br-sm px-3 py-2 text-sm">
            {t('landing.assistantMockQuestion')}
          </div>
        </div>
        <div className="flex justify-start">
          <div className="bg-muted max-w-[85%] rounded-2xl rounded-bl-sm px-3 py-2 text-sm">
            {t('landing.assistantMockAnswer')}
          </div>
        </div>
      </div>
    </MockShell>
  )
}

export function BudgetMock() {
  const { t } = useLanguage()

  return (
    <MockShell>
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="font-medium">$2.150.000 / $2.800.000</span>
            <span className="text-muted-foreground">77%</span>
          </div>
          <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
            <div className="bg-primary h-full w-[77%] rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-muted-foreground text-xs">
              {t('overview.totalDebt')}
            </p>
            <p className="text-sm font-semibold">$3.200.000</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-muted-foreground text-xs">
              {t('subscriptions.title')}
            </p>
            <p className="text-sm font-semibold">$185.000</p>
          </div>
        </div>
      </div>
    </MockShell>
  )
}
