import { getAccounts } from '@/app/dashboard/accounts/actions'
import {
  getAdminFeedback,
  getAdminStats,
  getAdminUsers,
} from '@/app/dashboard/admin/actions'
import {
  getBudgetDailyActuals,
  getBudgetItems,
  getBudgetOverview,
} from '@/app/dashboard/budgets/actions'
import {
  getCategories,
  getSubcategories,
} from '@/app/dashboard/categories/actions'
import {
  getDebtInterestCharges,
  getDebtPayments,
  getDebts,
} from '@/app/dashboard/debts/actions'
import { getMcpApiKeys } from '@/app/dashboard/mcp/actions'
import { getOverviewData } from '@/app/dashboard/overview/actions'
import { getPlanUsage } from '@/app/dashboard/plan/actions'
import { getProfile } from '@/app/dashboard/profile/actions'
import { getCategoryMonthlyTotals } from '@/app/dashboard/spending-trends/actions'
import { getSubscriptions } from '@/app/dashboard/subscriptions/actions'
import {
  getTransactions,
  getTransfers,
} from '@/app/dashboard/transactions/actions'
import { useLanguage } from '@/components/language-provider'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

export const queryKeys = {
  accounts: ['accounts'] as const,
  debts: ['debts'] as const,
  debtPayments: (debtId: string) => ['debt-payments', debtId] as const,
  debtInterestCharges: (debtId: string) =>
    ['debt-interest-charges', debtId] as const,
  subscriptions: ['subscriptions'] as const,
  categories: (type?: 'income' | 'expense') => ['categories', type] as const,
  subcategories: (categoryId: string) => ['subcategories', categoryId] as const,
  transactions: ['transactions'] as const,
  transfers: ['transfers'] as const,
  overview: ['overview'] as const,
  profile: ['profile'] as const,
  planUsage: ['plan-usage'] as const,
  mcpApiKeys: ['mcp-api-keys'] as const,
  budgetOverview: (month: number, year: number) =>
    ['budget-overview', month, year] as const,
  budgetItems: (month: number, year: number) =>
    ['budget-items', month, year] as const,
  budgetDailyActuals: (month: number, year: number) =>
    ['budget-daily-actuals', month, year] as const,
  categoryMonthlyTotals: (year: number) =>
    ['category-monthly-totals', year] as const,
  adminStats: ['admin-stats'] as const,
  adminUsers: (page: number, search: string) =>
    ['admin-users', page, search] as const,
  adminFeedback: ['admin-feedback'] as const,
}

export function useAccounts() {
  return useQuery({ queryKey: queryKeys.accounts, queryFn: getAccounts })
}

export function useDebts() {
  return useQuery({ queryKey: queryKeys.debts, queryFn: getDebts })
}

export function useDebtPayments(debtId: string) {
  return useQuery({
    queryKey: queryKeys.debtPayments(debtId),
    queryFn: () => getDebtPayments(debtId),
    enabled: !!debtId,
  })
}

export function useDebtInterestCharges(debtId: string) {
  return useQuery({
    queryKey: queryKeys.debtInterestCharges(debtId),
    queryFn: () => getDebtInterestCharges(debtId),
    enabled: !!debtId,
  })
}

export function useSubscriptions() {
  return useQuery({
    queryKey: queryKeys.subscriptions,
    queryFn: getSubscriptions,
  })
}

export function useCategories(type?: 'income' | 'expense') {
  const { language } = useLanguage()

  return useQuery({
    queryKey: [...queryKeys.categories(type), language],
    queryFn: () => getCategories(type),
  })
}

export function useSubcategories(categoryId: string) {
  return useQuery({
    queryKey: queryKeys.subcategories(categoryId),
    queryFn: () => getSubcategories(categoryId),
    enabled: !!categoryId,
  })
}

export function useTransactions() {
  return useQuery({
    queryKey: queryKeys.transactions,
    queryFn: getTransactions,
  })
}

export function useTransfers() {
  return useQuery({ queryKey: queryKeys.transfers, queryFn: getTransfers })
}

export function useOverviewData() {
  return useQuery({ queryKey: queryKeys.overview, queryFn: getOverviewData })
}

export function useProfile() {
  return useQuery({ queryKey: queryKeys.profile, queryFn: getProfile })
}

export function usePlanUsage() {
  return useQuery({ queryKey: queryKeys.planUsage, queryFn: getPlanUsage })
}

export function useMcpApiKeys() {
  return useQuery({ queryKey: queryKeys.mcpApiKeys, queryFn: getMcpApiKeys })
}

export function useBudgetOverview(month: number, year: number) {
  return useQuery({
    queryKey: queryKeys.budgetOverview(month, year),
    queryFn: () => getBudgetOverview(month, year),
    placeholderData: keepPreviousData,
  })
}

export function useBudgetItems(month: number, year: number) {
  return useQuery({
    queryKey: queryKeys.budgetItems(month, year),
    queryFn: () => getBudgetItems(month, year),
    placeholderData: keepPreviousData,
  })
}

export function useBudgetDailyActuals(month: number, year: number) {
  return useQuery({
    queryKey: queryKeys.budgetDailyActuals(month, year),
    queryFn: () => getBudgetDailyActuals(month, year),
    placeholderData: keepPreviousData,
  })
}

export function useCategoryMonthlyTotals(year: number) {
  return useQuery({
    queryKey: queryKeys.categoryMonthlyTotals(year),
    queryFn: () => getCategoryMonthlyTotals(year),
    placeholderData: keepPreviousData,
  })
}

export function useAdminStats() {
  return useQuery({ queryKey: queryKeys.adminStats, queryFn: getAdminStats })
}

export function useAdminUsers(page: number, search: string) {
  return useQuery({
    queryKey: queryKeys.adminUsers(page, search),
    queryFn: () => getAdminUsers(page, search),
    placeholderData: keepPreviousData,
  })
}

export function useAdminFeedback() {
  return useQuery({
    queryKey: queryKeys.adminFeedback,
    queryFn: getAdminFeedback,
  })
}
