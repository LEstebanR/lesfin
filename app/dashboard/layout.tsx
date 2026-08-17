import { getAccounts } from '@/app/dashboard/accounts/actions'
import {
  getBudgetDailyActuals,
  getBudgetItems,
  getBudgetOverview,
} from '@/app/dashboard/budgets/actions'
import { getCategories } from '@/app/dashboard/categories/actions'
import { getDebts } from '@/app/dashboard/debts/actions'
import { getOverviewData } from '@/app/dashboard/overview/actions'
import { getPlanUsage } from '@/app/dashboard/plan/actions'
import { getProfile, updateLanguage } from '@/app/dashboard/profile/actions'
import { getCategoryMonthlyTotals } from '@/app/dashboard/spending-trends/actions'
import { getSubscriptions } from '@/app/dashboard/subscriptions/actions'
import {
  getTransactions,
  getTransfers,
} from '@/app/dashboard/transactions/actions'
import { CurrencyProvider } from '@/components/currency-provider'
import { QuickAddFab } from '@/components/dashboard/quick-add-fab'
import { LanguageProvider } from '@/components/language-provider'
import { QueryProvider } from '@/components/query-provider'
import { AppSidebar } from '@/components/ui/app-sidebar'
import { Footer } from '@/components/ui/footer'
import { Header } from '@/components/ui/header'
import { SidebarProvider } from '@/components/ui/sidebar'
import { prisma } from '@/lib/prisma'
import { queryKeys } from '@/lib/queries'
import { getServerSession } from '@/lib/session'
import type { Language } from '@/lib/translations'
import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from '@tanstack/react-query'
import type { Metadata } from 'next'

// Authenticated, per-user data — never indexable, on top of the /dashboard
// disallow rule in app/robots.ts.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession()
  const user = session
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { currency: true, language: true, role: true },
      })
    : undefined

  const queryClient = new QueryClient()
  if (session) {
    // "Current" month/year mirrors how the client components derive them
    // (new Date() in the browser's local timezone, not the user's saved
    // timezone) so the prefetched cache key matches what useBudgetOverview /
    // useBudgetItems / useBudgetDailyActuals / useCategoryMonthlyTotals
    // request on mount. A mismatch near a month/year boundary just means a
    // wasted prefetch, not a bug — the client still fetches its own key.
    const now = new Date()
    const month = now.getMonth() + 1
    const year = now.getFullYear()

    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.accounts,
        queryFn: getAccounts,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.overview,
        queryFn: getOverviewData,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.transactions,
        queryFn: getTransactions,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.transfers,
        queryFn: getTransfers,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.debts,
        queryFn: getDebts,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.subscriptions,
        queryFn: getSubscriptions,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.categories('income'),
        queryFn: () => getCategories('income'),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.categories('expense'),
        queryFn: () => getCategories('expense'),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.profile,
        queryFn: getProfile,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.planUsage,
        queryFn: getPlanUsage,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.budgetOverview(month, year),
        queryFn: () => getBudgetOverview(month, year),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.budgetItems(month, year),
        queryFn: () => getBudgetItems(month, year),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.budgetDailyActuals(month, year),
        queryFn: () => getBudgetDailyActuals(month, year),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.categoryMonthlyTotals(year),
        queryFn: () => getCategoryMonthlyTotals(year),
      }),
    ])
  }

  return (
    <div className="flex flex-col">
      <LanguageProvider
        initialLanguage={user?.language as Language | undefined}
        onChange={session ? updateLanguage : undefined}
      >
        <SidebarProvider>
          <AppSidebar isAdmin={user?.role === 'ADMIN'} />
          <main className="bg-background flex min-h-svh w-full min-w-0 flex-col pt-16">
            <Header user={session?.user} />
            <CurrencyProvider currency={user?.currency ?? 'usd'}>
              <QueryProvider>
                <HydrationBoundary state={dehydrate(queryClient)}>
                  <div className="flex-1">{children}</div>
                  <QuickAddFab />
                </HydrationBoundary>
              </QueryProvider>
            </CurrencyProvider>
            <Footer />
          </main>
        </SidebarProvider>
      </LanguageProvider>
    </div>
  )
}
