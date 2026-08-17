'use client'

import { AccountDetail } from '@/components/dashboard/account-detail'
import { Accounts } from '@/components/dashboard/accounts'
import { AdminView } from '@/components/dashboard/admin-view'
import { Budgets } from '@/components/dashboard/budgets'
import { DebtDetail } from '@/components/dashboard/debt-detail'
import { Debts } from '@/components/dashboard/debts'
import { Overview } from '@/components/dashboard/overview'
import { Plan } from '@/components/dashboard/plan'
import { Pricing } from '@/components/dashboard/pricing'
import { Profile } from '@/components/dashboard/profile'
import { Settings } from '@/components/dashboard/settings'
import { SpendingTrends } from '@/components/dashboard/spending-trends'
import { Subscriptions } from '@/components/dashboard/subscriptions'
import { Transactions } from '@/components/dashboard/transactions'
import { useProfile } from '@/lib/queries'
import { useSearchParams } from 'next/navigation'

export default function Dashboard() {
  const searchParams = useSearchParams()
  const currentView = Array.from(searchParams.entries())[0]?.[0] || 'overview'
  const { data: profile } = useProfile()

  return (
    <div className="flex w-full flex-col items-center justify-center">
      {currentView === 'accounts' && <Accounts />}
      {currentView === 'account' && <AccountDetail />}
      {currentView === 'transactions' && <Transactions />}
      {currentView === 'debts' && <Debts />}
      {currentView === 'debt' && <DebtDetail />}
      {currentView === 'budget' && <Budgets />}
      {currentView === 'subscriptions' && <Subscriptions />}
      {currentView === 'spending-trends' && <SpendingTrends />}
      {currentView === 'overview' && <Overview />}
      {currentView === 'profile' && <Profile />}
      {currentView === 'plan' && <Plan />}
      {currentView === 'pricing' && <Pricing />}
      {currentView === 'settings' && <Settings />}
      {currentView === 'admin' && profile?.role === 'ADMIN' && <AdminView />}
    </div>
  )
}
