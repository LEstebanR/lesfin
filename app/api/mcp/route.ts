import { getAccountsForUser } from '@/app/dashboard/accounts/actions'
import {
  getBudgetOverviewForUser,
  getCashRunwayForUser,
  getDailyFinancialAgendaForUser,
  getDuePaymentsForUser,
} from '@/app/dashboard/budgets/actions'
import {
  createCategoryForUser,
  findOrCreateSubcategoryForUser,
  getCategoriesForUser,
} from '@/app/dashboard/categories/actions'
import { getDebtsForUser } from '@/app/dashboard/debts/actions'
import { getOverviewDataForUser } from '@/app/dashboard/overview/actions'
import { getMonthlyFinancialReportForUser } from '@/app/dashboard/spending-trends/actions'
import {
  type SubscriptionPatch,
  createSubscriptionForUser,
  deleteSubscriptionForUser,
  getSubscriptionsForUser,
  updateSubscriptionForUser,
} from '@/app/dashboard/subscriptions/actions'
import { createSubscriptionSchema } from '@/app/dashboard/subscriptions/schemas'
import {
  type TransactionPatch,
  type TransferPatch,
  createTransactionForUser,
  createTransferForUser,
  deleteTransactionForUser,
  deleteTransferForUser,
  getTransactionsForUser,
  getTransfersForUser,
  updateTransactionForUser,
  updateTransferForUser,
} from '@/app/dashboard/transactions/actions'
import {
  transactionSchema,
  transferSchema,
} from '@/app/dashboard/transactions/schemas'
import { verifyMcpToken } from '@/lib/mcp-auth'
import { withToolHandler } from '@/lib/mcp-errors'
import { withIdempotency } from '@/lib/mcp-idempotency'
import { prisma } from '@/lib/prisma'
import { getTodayInTimezone } from '@/lib/user-date'
import type { ServerContext } from '@modelcontextprotocol/server'
import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import { z } from 'zod'

const RECENT_TRANSACTIONS_LIMIT = 50

const anyRecord = z.record(z.string(), z.unknown())
const idempotencyKeyField = z
  .string()
  .optional()
  .describe(
    'Optional client-generated key. Calling this tool again with the same key returns the original result instead of creating a duplicate — use it when retrying after a timeout or network error.'
  )

function requireUserId(ctx: ServerContext) {
  const userId = ctx.http?.authInfo?.extra?.userId
  if (typeof userId !== 'string') throw new Error('Not authenticated')
  return userId
}

async function enrichTransaction(transaction: {
  categoryId: string
  subcategoryId: string | null
  accountId: string | null
  debtId: string | null
  [key: string]: unknown
}) {
  const [category, subcategory, account, debt] = await Promise.all([
    prisma.category.findUnique({ where: { id: transaction.categoryId } }),
    transaction.subcategoryId
      ? prisma.subcategory.findUnique({
          where: { id: transaction.subcategoryId },
        })
      : null,
    transaction.accountId
      ? prisma.account.findUnique({ where: { id: transaction.accountId } })
      : null,
    transaction.debtId
      ? prisma.debt.findUnique({ where: { id: transaction.debtId } })
      : null,
  ])

  return {
    ...transaction,
    categoryName: category?.name ?? null,
    subcategoryName: subcategory?.name ?? null,
    accountName: account?.name ?? null,
    debtName: debt?.name ?? null,
  }
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      'get_current_date',
      {
        title: 'Get current date',
        description:
          "Get today's date, timezone, and currency for this user. Call this before using any tool that takes a year/month/date instead of guessing today's date — the server's clock may be in a different timezone than the user's.",
        inputSchema: z.object({}),
        outputSchema: z.object({
          date: z.string(),
          timezone: z.string(),
          currency: z.string(),
        }),
        annotations: { readOnlyHint: true },
      },
      withToolHandler('get_current_date', async (_args, ctx) => {
        const user = await prisma.user.findUniqueOrThrow({
          where: { id: requireUserId(ctx) },
          select: { timezone: true, currency: true },
        })
        const structuredContent = {
          date: getTodayInTimezone(user.timezone),
          timezone: user.timezone,
          currency: user.currency,
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
          structuredContent,
        }
      })
    )

    server.registerTool(
      'list_accounts',
      {
        title: 'List accounts',
        description:
          "List the user's cash/bank/savings accounts with their current balances. Use this to answer 'how much do I have' or to look up an account's ID before create_transaction/create_transfer. Does not include debts (credit cards, loans) — use list_debts for those, or get_overview for a combined snapshot.",
        inputSchema: z.object({}),
        outputSchema: z.object({ accounts: z.array(anyRecord) }),
        annotations: { readOnlyHint: true },
      },
      withToolHandler('list_accounts', async (_args, ctx) => {
        const accounts = await getAccountsForUser(requireUserId(ctx))
        const structuredContent = { accounts }
        return {
          content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
          structuredContent,
        }
      })
    )

    server.registerTool(
      'get_overview',
      {
        title: 'Get financial overview',
        description:
          "Get a single snapshot: accounts with balances, recent transactions/transfers, and total debt. Use this for a general 'how am I doing financially' question when you don't need a specific breakdown. For budget-vs-actual use get_budget_overview; for upcoming payments use get_due_payments or get_daily_financial_agenda; for 'can I afford it until payday' use get_cash_runway.",
        inputSchema: z.object({}),
        outputSchema: anyRecord,
        annotations: { readOnlyHint: true },
      },
      withToolHandler('get_overview', async (_args, ctx) => {
        const overview = await getOverviewDataForUser(requireUserId(ctx))
        return {
          content: [{ type: 'text', text: JSON.stringify(overview) }],
          structuredContent: overview,
        }
      })
    )

    server.registerTool(
      'list_transactions',
      {
        title: 'List transactions',
        description: `List past income/expense transactions, optionally filtered by year, month, and/or account. Use this to look up or audit what was already recorded — for what's coming up, use get_due_payments or get_daily_financial_agenda instead. Without a year filter, returns only the ${RECENT_TRANSACTIONS_LIMIT} most recently added — check totalCount/truncated in the response and pass a year to see the rest.`,
        inputSchema: z.object({
          year: z.number().int().optional(),
          month: z.number().int().min(1).max(12).optional(),
          accountId: z.string().uuid().optional(),
        }),
        outputSchema: z.object({
          transactions: z.array(anyRecord),
          totalCount: z.number(),
          truncated: z.boolean(),
        }),
        annotations: { readOnlyHint: true },
      },
      withToolHandler('list_transactions', async (args, ctx) => {
        const all = await getTransactionsForUser(requireUserId(ctx), args)
        const truncated = !args.year && all.length > RECENT_TRANSACTIONS_LIMIT
        const structuredContent = {
          transactions: truncated
            ? all.slice(0, RECENT_TRANSACTIONS_LIMIT)
            : all,
          totalCount: all.length,
          truncated,
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
          structuredContent,
        }
      })
    )

    server.registerTool(
      'list_transfers',
      {
        title: 'List transfers',
        description:
          "List past transfers between the user's own accounts (not income/expense transactions), optionally filtered by year and month.",
        inputSchema: z.object({
          year: z.number().int().optional(),
          month: z.number().int().min(1).max(12).optional(),
        }),
        outputSchema: z.object({ transfers: z.array(anyRecord) }),
        annotations: { readOnlyHint: true },
      },
      withToolHandler('list_transfers', async (args, ctx) => {
        const transfers = await getTransfersForUser(requireUserId(ctx), args)
        const structuredContent = { transfers }
        return {
          content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
          structuredContent,
        }
      })
    )

    server.registerTool(
      'list_subscriptions',
      {
        title: 'List subscriptions',
        description:
          "List recurring subscriptions and their terms (name, amount, frequency, due date, active/cancelled). Use this to see what subscriptions exist or to look up an ID before update_subscription/delete_subscription. For 'what subscription payments are due on/around a date', prefer get_due_payments or get_daily_financial_agenda instead of computing due dates from this list yourself.",
        inputSchema: z.object({}),
        outputSchema: z.object({ subscriptions: z.array(anyRecord) }),
        annotations: { readOnlyHint: true },
      },
      withToolHandler('list_subscriptions', async (_args, ctx) => {
        const subscriptions = await getSubscriptionsForUser(requireUserId(ctx))
        const structuredContent = { subscriptions }
        return {
          content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
          structuredContent,
        }
      })
    )

    server.registerTool(
      'list_debts',
      {
        title: 'List debts',
        description:
          "List loans and credit cards with outstanding balance, minimum payment, and due day. Use this for questions about debt balances, interest, or overall debt load. For 'what payments are due on a specific date or range', prefer get_due_payments instead of computing due dates from paymentDueDay yourself — it also excludes debts that are fully paid off.",
        inputSchema: z.object({}),
        outputSchema: z.object({ debts: z.array(anyRecord) }),
        annotations: { readOnlyHint: true },
      },
      withToolHandler('list_debts', async (_args, ctx) => {
        const debts = await getDebtsForUser(requireUserId(ctx))
        const structuredContent = { debts }
        return {
          content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
          structuredContent,
        }
      })
    )

    server.registerTool(
      'list_categories',
      {
        title: 'List categories',
        description:
          'List income/expense categories and subcategories, with their IDs. You can also just pass categoryName/subcategoryName directly to create_transaction instead of looking up IDs here first.',
        inputSchema: z.object({
          type: z.enum(['income', 'expense']).optional(),
        }),
        outputSchema: z.object({ categories: z.array(anyRecord) }),
        annotations: { readOnlyHint: true },
      },
      withToolHandler('list_categories', async ({ type }, ctx) => {
        const categories = await getCategoriesForUser(requireUserId(ctx), type)
        const structuredContent = { categories }
        return {
          content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
          structuredContent,
        }
      })
    )

    server.registerTool(
      'get_budget_overview',
      {
        title: 'Get budget overview',
        description:
          "Get budgeted vs. actual spending per expense category for a given month — totals only, not broken down by day. Use this to answer 'am I over budget' or 'how much do I have left in category X this month'. For 'what did I plan to spend tomorrow/this week' or any other date-specific planned-expense question, this tool cannot answer it — use get_due_payments or get_daily_financial_agenda instead. For a forward-looking 'can I afford this until payday' question, use get_cash_runway instead, which already factors this in.",
        inputSchema: z.object({
          year: z.number().int(),
          month: z.number().int().min(1).max(12),
        }),
        outputSchema: z.object({ budget: z.array(anyRecord) }),
        annotations: { readOnlyHint: true },
      },
      withToolHandler('get_budget_overview', async ({ year, month }, ctx) => {
        const budget = await getBudgetOverviewForUser(
          requireUserId(ctx),
          month,
          year
        )
        const structuredContent = { budget }
        return {
          content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
          structuredContent,
        }
      })
    )

    server.registerTool(
      'get_monthly_report',
      {
        title: 'Get monthly financial report',
        description:
          'Get a Markdown financial report (balances, debts, income/expenses, movements) for a given month. Use this when the user wants a written summary/narrative of a month rather than raw structured data.',
        inputSchema: z.object({
          year: z.number().int(),
          month: z.number().int().min(1).max(12),
        }),
        outputSchema: z.object({ report: z.string() }),
        annotations: { readOnlyHint: true },
      },
      withToolHandler('get_monthly_report', async ({ year, month }, ctx) => {
        const report = await getMonthlyFinancialReportForUser(
          requireUserId(ctx),
          year,
          month
        )
        const structuredContent = { report }
        return {
          content: [{ type: 'text', text: report }],
          structuredContent,
        }
      })
    )

    server.registerTool(
      'get_due_payments',
      {
        title: 'Get due payments in a date range',
        description:
          "List every payment planned/coming due between two dates — loan and credit card minimum payments, subscriptions, recurring expenses, AND one-off expenses the user planned for a specific date from the Budget view (sourceType: manual) — in one call, with a total. This is the budget broken down by day, not just by category: use it whenever the user asks something like 'what do I owe this week', 'what's due between these dates', or 'what did I plan to spend tomorrow' instead of reading get_budget_overview's per-category totals (which don't say which day within the month). Already excludes debts that are fully paid off. For a single day split by source type (plus scheduled income), use get_daily_financial_agenda. For 'can I afford it until then', use get_cash_runway.",
        inputSchema: z.object({
          startDate: z.string().describe('ISO date, e.g. 2026-08-13'),
          endDate: z.string().describe('ISO date, e.g. 2026-08-20'),
        }),
        outputSchema: z.object({
          payments: z.array(anyRecord),
          total: z.number(),
        }),
        annotations: { readOnlyHint: true },
      },
      withToolHandler(
        'get_due_payments',
        async ({ startDate, endDate }, ctx) => {
          const structuredContent = await getDuePaymentsForUser(
            requireUserId(ctx),
            new Date(startDate),
            new Date(endDate)
          )
          return {
            content: [
              { type: 'text', text: JSON.stringify(structuredContent) },
            ],
            structuredContent,
          }
        }
      )
    )

    server.registerTool(
      'get_daily_financial_agenda',
      {
        title: 'Get financial agenda for a day',
        description:
          "Answer 'what do I have to pay/receive on this day' (today, tomorrow, or any specific date) in one call: due debt/credit-card payments, subscriptions charging that day, other scheduled expenses, and scheduled income, each in its own list plus totals. scheduledIncome is currently always empty — there's no recurring-income tracking in the app yet. For a date range instead of a single day, use get_due_payments.",
        inputSchema: z.object({
          date: z.string().describe('ISO date, e.g. 2026-08-14'),
        }),
        outputSchema: anyRecord,
        annotations: { readOnlyHint: true },
      },
      withToolHandler('get_daily_financial_agenda', async ({ date }, ctx) => {
        const structuredContent = await getDailyFinancialAgendaForUser(
          requireUserId(ctx),
          new Date(date)
        )
        return {
          content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
          structuredContent,
        }
      })
    )

    server.registerTool(
      'get_cash_runway',
      {
        title: 'Get cash runway until a date',
        description:
          "Answer 'do I make it to the end of the month / to my next paycheck' or 'how much can I spend without touching X'. Combines current account balances, this month's remaining category budget, and scheduled payments up to untilDate into a single projectedRemaining figure and a comfortable/tight/insufficient status. Pass excludeAccounts (account IDs or exact names, e.g. \"Fondo de emergencia\") to leave specific accounts out of the available balance.",
        inputSchema: z.object({
          untilDate: z.string().describe('ISO date, e.g. 2026-08-31'),
          excludeAccounts: z
            .array(z.string())
            .optional()
            .describe('Account IDs or exact account names to exclude'),
        }),
        outputSchema: z.object({
          availableBalance: z.number(),
          remainingBudget: z.number(),
          scheduledPayments: z.number(),
          projectedRemaining: z.number(),
          daysRemaining: z.number(),
          status: z.enum(['comfortable', 'tight', 'insufficient']),
        }),
        annotations: { readOnlyHint: true },
      },
      withToolHandler(
        'get_cash_runway',
        async ({ untilDate, excludeAccounts }, ctx) => {
          const structuredContent = await getCashRunwayForUser(
            requireUserId(ctx),
            new Date(untilDate),
            excludeAccounts
          )
          return {
            content: [
              { type: 'text', text: JSON.stringify(structuredContent) },
            ],
            structuredContent,
          }
        }
      )
    )

    server.registerTool(
      'create_transaction',
      {
        title: 'Create transaction',
        description:
          'Record an income or expense transaction against an account or debt. This moves real money in the app — confirm the amount, account, and category with the user before calling. Pass either categoryId or categoryName (a new category is created if the name doesn’t exist yet); same for subcategoryId/subcategoryName. To fix a mistake in an existing transaction, use update_transaction instead of creating a compensating entry.',
        inputSchema: z.object({
          accountId: z.string().uuid().nullable(),
          debtId: z.string().uuid().nullable(),
          amount: z.number().positive(),
          type: z.enum(['income', 'expense']),
          categoryId: z.string().uuid().nullish(),
          categoryName: z.string().nullish(),
          subcategoryId: z.string().uuid().nullish(),
          subcategoryName: z.string().nullish(),
          description: z.string(),
          date: z.string(),
          idempotencyKey: idempotencyKeyField,
        }),
        outputSchema: anyRecord,
        annotations: { readOnlyHint: false, destructiveHint: true },
      },
      withToolHandler('create_transaction', async (args, ctx) => {
        const userId = requireUserId(ctx)

        return withIdempotency(
          userId,
          'create_transaction',
          args.idempotencyKey,
          async () => {
            if (!args.categoryId && !args.categoryName) {
              throw new Error('Provide either categoryId or categoryName')
            }
            const categoryId = args.categoryId
              ? args.categoryId
              : (
                  await createCategoryForUser(
                    userId,
                    args.categoryName!,
                    args.type
                  )
                ).id

            let subcategoryId: string | null = args.subcategoryId ?? null
            if (!subcategoryId && args.subcategoryName) {
              subcategoryId = (
                await findOrCreateSubcategoryForUser(
                  userId,
                  categoryId,
                  args.subcategoryName
                )
              ).id
            }

            const parsed = transactionSchema.parse({
              accountId: args.accountId,
              debtId: args.debtId,
              amount: args.amount,
              type: args.type,
              categoryId,
              subcategoryId,
              description: args.description,
              date: new Date(args.date),
            })

            const transaction = await createTransactionForUser(userId, parsed)
            const structuredContent = await enrichTransaction(transaction)
            return {
              content: [
                { type: 'text', text: JSON.stringify(structuredContent) },
              ],
              structuredContent,
            }
          }
        )
      })
    )

    server.registerTool(
      'update_transaction',
      {
        title: 'Update transaction',
        description:
          "Correct a transaction that was recorded wrong — wrong account/debt, amount, category, description, or date — without creating compensating entries. Only send the fields that changed; anything omitted keeps its current value, except that sending accountId or debtId replaces the whole money source (the other one is cleared) — this is how you move a transaction from one account/debt to another, e.g. 'this was actually paid from Nequi, not Bancolombia'. This moves real money in the app — confirm with the user before calling. Cannot edit a transaction that mirrors a debt payment (edit the debt payment from the dashboard instead).",
        inputSchema: z.object({
          transactionId: z.string().uuid(),
          accountId: z.string().uuid().nullish(),
          debtId: z.string().uuid().nullish(),
          amount: z.number().positive().optional(),
          categoryId: z.string().uuid().optional(),
          subcategoryId: z.string().uuid().nullish(),
          description: z.string().optional(),
          date: z.string().optional(),
        }),
        outputSchema: anyRecord,
        annotations: { readOnlyHint: false, destructiveHint: true },
      },
      withToolHandler('update_transaction', async (args, ctx) => {
        const userId = requireUserId(ctx)

        const patch: TransactionPatch = {}
        if ('accountId' in args) patch.accountId = args.accountId ?? null
        if ('debtId' in args) patch.debtId = args.debtId ?? null
        if (args.amount !== undefined) patch.amount = args.amount
        if (args.categoryId !== undefined) patch.categoryId = args.categoryId
        if ('subcategoryId' in args) {
          patch.subcategoryId = args.subcategoryId ?? null
        }
        if (args.description !== undefined) {
          patch.description = args.description
        }
        if (args.date !== undefined) patch.date = new Date(args.date)

        const transaction = await updateTransactionForUser(
          userId,
          args.transactionId,
          patch
        )
        const structuredContent = await enrichTransaction(transaction)
        return {
          content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
          structuredContent,
        }
      })
    )

    server.registerTool(
      'delete_transaction',
      {
        title: 'Delete transaction',
        description:
          'Permanently delete a transaction and reverse its effect on the account/debt balance it was posted to. This moves real money in the app — confirm with the user before calling. Cannot delete a transaction that mirrors a debt payment (delete the debt payment from the dashboard instead).',
        inputSchema: z.object({ transactionId: z.string().uuid() }),
        outputSchema: z.object({ success: z.boolean() }),
        annotations: { readOnlyHint: false, destructiveHint: true },
      },
      withToolHandler('delete_transaction', async ({ transactionId }, ctx) => {
        await deleteTransactionForUser(requireUserId(ctx), transactionId)
        const structuredContent = { success: true }
        return {
          content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
          structuredContent,
        }
      })
    )

    server.registerTool(
      'create_transfer',
      {
        title: 'Create transfer',
        description:
          'Move money from one account to another. This moves real money in the app — confirm the amount and both accounts with the user before calling. To fix a mistake in an existing transfer, use update_transfer instead of creating a compensating entry.',
        inputSchema: z.object({
          fromAccountId: z.string().uuid(),
          toAccountId: z.string().uuid(),
          amount: z.number().positive(),
          date: z.string(),
          note: z.string().optional(),
          idempotencyKey: idempotencyKeyField,
        }),
        outputSchema: anyRecord,
        annotations: { readOnlyHint: false, destructiveHint: true },
      },
      withToolHandler('create_transfer', async (args, ctx) => {
        const userId = requireUserId(ctx)

        return withIdempotency(
          userId,
          'create_transfer',
          args.idempotencyKey,
          async () => {
            const parsed = transferSchema.parse({
              ...args,
              date: new Date(args.date),
            })

            const transfer = await createTransferForUser(userId, parsed)
            const [fromAccount, toAccount] = await Promise.all([
              prisma.account.findUnique({
                where: { id: transfer.fromAccountId },
              }),
              prisma.account.findUnique({
                where: { id: transfer.toAccountId },
              }),
            ])
            const structuredContent = {
              ...transfer,
              fromAccountName: fromAccount?.name ?? null,
              toAccountName: toAccount?.name ?? null,
            }
            return {
              content: [
                { type: 'text', text: JSON.stringify(structuredContent) },
              ],
              structuredContent,
            }
          }
        )
      })
    )

    server.registerTool(
      'update_transfer',
      {
        title: 'Update transfer',
        description:
          'Correct a transfer that was recorded wrong (wrong source/destination account, amount, or date) by reversing the original balance change and applying the corrected one, without extra compensating entries. Only send the fields that changed. This moves real money in the app — confirm with the user before calling.',
        inputSchema: z.object({
          transferId: z.string().uuid(),
          fromAccountId: z.string().uuid().optional(),
          toAccountId: z.string().uuid().optional(),
          amount: z.number().positive().optional(),
          date: z.string().optional(),
          note: z.string().nullish(),
        }),
        outputSchema: anyRecord,
        annotations: { readOnlyHint: false, destructiveHint: true },
      },
      withToolHandler('update_transfer', async (args, ctx) => {
        const userId = requireUserId(ctx)

        const patch: TransferPatch = {}
        if (args.fromAccountId !== undefined) {
          patch.fromAccountId = args.fromAccountId
        }
        if (args.toAccountId !== undefined) {
          patch.toAccountId = args.toAccountId
        }
        if (args.amount !== undefined) patch.amount = args.amount
        if (args.date !== undefined) patch.date = new Date(args.date)
        if ('note' in args) patch.note = args.note ?? null

        const transfer = await updateTransferForUser(
          userId,
          args.transferId,
          patch
        )
        const [fromAccount, toAccount] = await Promise.all([
          prisma.account.findUnique({ where: { id: transfer.fromAccountId } }),
          prisma.account.findUnique({ where: { id: transfer.toAccountId } }),
        ])
        const structuredContent = {
          ...transfer,
          fromAccountName: fromAccount?.name ?? null,
          toAccountName: toAccount?.name ?? null,
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
          structuredContent,
        }
      })
    )

    server.registerTool(
      'delete_transfer',
      {
        title: 'Delete transfer',
        description:
          "Permanently delete a transfer and reverse its effect on both accounts' balances. Confirm with the user before calling.",
        inputSchema: z.object({ transferId: z.string().uuid() }),
        outputSchema: z.object({ success: z.boolean() }),
        annotations: { readOnlyHint: false, destructiveHint: true },
      },
      withToolHandler('delete_transfer', async ({ transferId }, ctx) => {
        await deleteTransferForUser(requireUserId(ctx), transferId)
        const structuredContent = { success: true }
        return {
          content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
          structuredContent,
        }
      })
    )

    server.registerTool(
      'create_subscription',
      {
        title: 'Create subscription',
        description:
          'Create a recurring subscription (streaming, memberships, etc.) charged to an account or credit card on a schedule. Requires exactly one payment source: accountId or debtId, not both. This does not create a transaction by itself — its occurrences show up via get_due_payments/get_daily_financial_agenda/get_budget_overview as they come due.',
        inputSchema: z.object({
          name: z.string(),
          amount: z.number().positive(),
          frequency: z.enum(['monthly', 'yearly']),
          dueDay: z.number().int().min(1).max(31),
          dueMonth: z.number().int().min(1).max(12).nullish(),
          startDate: z.string(),
          accountId: z.string().uuid().nullish(),
          debtId: z.string().uuid().nullish(),
          categoryId: z.string().uuid(),
          subcategoryId: z.string().uuid().nullish(),
          isActive: z.boolean().optional(),
          idempotencyKey: idempotencyKeyField,
        }),
        outputSchema: anyRecord,
        annotations: { readOnlyHint: false, destructiveHint: true },
      },
      withToolHandler('create_subscription', async (args, ctx) => {
        const userId = requireUserId(ctx)

        return withIdempotency(
          userId,
          'create_subscription',
          args.idempotencyKey,
          async () => {
            const parsed = createSubscriptionSchema.parse({
              name: args.name,
              categoryId: args.categoryId,
              subcategoryId: args.subcategoryId ?? null,
              amount: args.amount,
              frequency: args.frequency,
              dueDay: args.dueDay,
              dueMonth:
                args.frequency === 'yearly' ? (args.dueMonth ?? null) : null,
              accountId: args.accountId ?? null,
              debtId: args.debtId ?? null,
              startDate: new Date(args.startDate),
              isActive: args.isActive,
            })

            const subscription = await createSubscriptionForUser(userId, parsed)
            return {
              content: [{ type: 'text', text: JSON.stringify(subscription) }],
              structuredContent: subscription,
            }
          }
        )
      })
    )

    server.registerTool(
      'update_subscription',
      {
        title: 'Update subscription',
        description:
          "Change a subscription's terms (name, amount, category, frequency, due day, payment source, active status). Only send the fields that changed; sending accountId or debtId replaces the whole payment source, same rule as update_transaction. Cannot change startDate. Regenerates not-yet-arrived scheduled/budgeted occurrences with the new details; past occurrences stay as the historical record.",
        inputSchema: z.object({
          subscriptionId: z.string().uuid(),
          name: z.string().optional(),
          amount: z.number().positive().optional(),
          frequency: z.enum(['monthly', 'yearly']).optional(),
          dueDay: z.number().int().min(1).max(31).optional(),
          dueMonth: z.number().int().min(1).max(12).nullish(),
          accountId: z.string().uuid().nullish(),
          debtId: z.string().uuid().nullish(),
          categoryId: z.string().uuid().optional(),
          subcategoryId: z.string().uuid().nullish(),
          isActive: z.boolean().optional(),
        }),
        outputSchema: anyRecord,
        annotations: { readOnlyHint: false, destructiveHint: true },
      },
      withToolHandler('update_subscription', async (args, ctx) => {
        const userId = requireUserId(ctx)

        const patch: SubscriptionPatch = {}
        if (args.name !== undefined) patch.name = args.name
        if (args.categoryId !== undefined) patch.categoryId = args.categoryId
        if ('subcategoryId' in args) {
          patch.subcategoryId = args.subcategoryId ?? null
        }
        if (args.amount !== undefined) patch.amount = args.amount
        if (args.frequency !== undefined) patch.frequency = args.frequency
        if (args.dueDay !== undefined) patch.dueDay = args.dueDay
        if ('dueMonth' in args) patch.dueMonth = args.dueMonth ?? null
        if ('accountId' in args) patch.accountId = args.accountId ?? null
        if ('debtId' in args) patch.debtId = args.debtId ?? null
        if (args.isActive !== undefined) patch.isActive = args.isActive

        const subscription = await updateSubscriptionForUser(
          userId,
          args.subscriptionId,
          patch
        )
        return {
          content: [{ type: 'text', text: JSON.stringify(subscription) }],
          structuredContent: subscription,
        }
      })
    )

    server.registerTool(
      'delete_subscription',
      {
        title: 'Delete subscription',
        description:
          'Permanently delete a subscription and all its budget history (past and future planned occurrences) — this cannot be undone. To just stop future charges while keeping history, call update_subscription with isActive: false instead.',
        inputSchema: z.object({ subscriptionId: z.string().uuid() }),
        outputSchema: z.object({ success: z.boolean() }),
        annotations: { readOnlyHint: false, destructiveHint: true },
      },
      withToolHandler(
        'delete_subscription',
        async ({ subscriptionId }, ctx) => {
          await deleteSubscriptionForUser(requireUserId(ctx), subscriptionId)
          const structuredContent = { success: true }
          return {
            content: [
              { type: 'text', text: JSON.stringify(structuredContent) },
            ],
            structuredContent,
          }
        }
      )
    )
  },
  { serverInfo: { name: 'personal-finances', version: '0.1.0' } }
)

const authHandler = withMcpAuth(handler, verifyMcpToken, {
  required: true,
  resourceMetadataPath: '/.well-known/oauth-protected-resource',
})

export { authHandler as GET, authHandler as POST }
