// Interest conventions for debts (#12). Pure functions only — no Prisma — so
// the dashboard, the MCP server and the tests share the exact same math.
//
// Conventions:
// - A rate is stored as a fraction (0.245 = 24.5%) plus a type that says how
//   to turn it into the monthly rate:
//     effective_annual (EA):  (1 + r)^(1/12) - 1
//     nominal_annual:         r / 12   (compounded monthly)
//     monthly:                r
// - Interest is accrued monthly: one charge per debt and period ('YYYY-MM'),
//   taken from the charge date. The amount on the statement always wins; the
//   suggestion (balance × monthly rate) is only a starting point.
// - An accrual raises the balance but never counts as a payment or as a
//   consumption expense.
// - Payoff projection: each month the balance grows by the monthly rate and
//   then the monthly payment (the debt's minimum payment) is subtracted, until
//   it reaches zero. It doesn't model future purchases, fees, or the daily
//   interest some cards use, so it's an estimate.

export const INTEREST_RATE_TYPES = [
  'effective_annual',
  'nominal_annual',
  'monthly',
] as const
export type InterestRateType = (typeof INTEREST_RATE_TYPES)[number]

export const ACCRUAL_FREQUENCIES = ['monthly'] as const
export type AccrualFrequency = (typeof ACCRUAL_FREQUENCIES)[number]

export const INTEREST_SOURCES = ['manual', 'statement', 'estimated'] as const
export type InterestSource = (typeof INTEREST_SOURCES)[number]

// Mirrors the debt_interest_rate_range CHECK constraint (1000%).
export const MAX_INTEREST_RATE = 10

export const MAX_PROJECTION_MONTHS = 600

const round2 = (value: number) => Math.round(value * 100) / 100

export function isValidInterestRate(rate: number): boolean {
  return Number.isFinite(rate) && rate >= 0 && rate <= MAX_INTEREST_RATE
}

// Form input as a percentage: "24,5", "24.5" or "24,5 %" → 0.245. Anything
// else (thousands separators, several numbers, stray characters) is NaN, so
// validation rejects it instead of parseFloat silently keeping a prefix.
export function parsePercentInput(raw: string): number {
  const cleaned = raw.trim().replace(/\s*%$/, '')
  if (!/^\d+([.,]\d+)?$/.test(cleaned)) return Number.NaN
  return Number(cleaned.replace(',', '.')) / 100
}

export function monthlyRate(rate: number, type: InterestRateType): number {
  if (!isValidInterestRate(rate)) {
    throw new Error(`Invalid interest rate: ${rate}`)
  }
  switch (type) {
    case 'effective_annual':
      return Math.pow(1 + rate, 1 / 12) - 1
    case 'nominal_annual':
      return rate / 12
    case 'monthly':
      return rate
  }
}

// Interest periods are calendar months in UTC, matching how dates are stored
// (date inputs become midnight UTC) and the migration's to_char backfill.
export function interestPeriod(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function suggestInterest(
  balance: number,
  rate: number,
  type: InterestRateType
): number {
  if (balance <= 0) return 0
  return round2(balance * monthlyRate(rate, type))
}

export type PayoffProjection =
  | { status: 'paid_off' }
  | { status: 'no_rate' }
  | { status: 'no_payment' }
  // The payment doesn't cover the monthly interest: the debt never shrinks.
  | { status: 'never'; monthlyInterest: number }
  | { status: 'too_long'; months: number }
  | {
      status: 'ok'
      months: number
      totalInterest: number
      payoffDate: Date
    }

export function projectPayoff({
  balance,
  rate,
  rateType,
  monthlyPayment,
  from = new Date(),
}: {
  balance: number
  rate: number | null
  rateType: InterestRateType | null
  monthlyPayment: number | null
  from?: Date
}): PayoffProjection {
  if (balance <= 0) return { status: 'paid_off' }
  if (rate === null || rateType === null) return { status: 'no_rate' }
  if (!monthlyPayment || monthlyPayment <= 0) return { status: 'no_payment' }

  const i = monthlyRate(rate, rateType)
  const firstInterest = round2(balance * i)
  if (monthlyPayment <= firstInterest) {
    return { status: 'never', monthlyInterest: firstInterest }
  }

  let remaining = balance
  let totalInterest = 0
  let months = 0
  while (remaining > 0.005 && months < MAX_PROJECTION_MONTHS) {
    const interest = round2(remaining * i)
    totalInterest += interest
    remaining = round2(remaining + interest - monthlyPayment)
    months += 1
  }
  if (remaining > 0.005) return { status: 'too_long', months }

  const payoffDate = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + months, 1)
  )
  return {
    status: 'ok',
    months,
    totalInterest: round2(totalInterest),
    payoffDate,
  }
}

export type LedgerEventKind = 'purchase' | 'interest' | 'payment'

export type LedgerEvent = {
  id: string
  kind: LedgerEventKind
  amount: number
  date: Date
  description?: string | null
}

export type LedgerEntry = LedgerEvent & {
  // Signed effect on the balance: + for purchases/interest, - for payments.
  delta: number
  balance: number
}

export type DebtLedger = {
  entries: LedgerEntry[]
  openingBalance: number
  totals: { purchases: number; interest: number; payments: number }
  // The balance rebuilt from the opening balance and every movement.
  balance: number
}

// Same-day tie-break: purchases, then interest, then payments — so a payment
// made the day interest posts is applied after it, as on a statement.
const KIND_ORDER: Record<LedgerEventKind, number> = {
  purchase: 0,
  interest: 1,
  payment: 2,
}

// Rebuilds a debt's balance chronologically from its opening balance (the
// originalAmount entered at creation) and its movements, whatever order they
// were recorded in. remainingBalance stays the stored source of truth (see
// #48); this is for the evolution view and for spotting drift against it.
export function buildDebtLedger(
  openingBalance: number,
  events: LedgerEvent[]
): DebtLedger {
  const sorted = [...events].sort((a, b) => {
    const byDate = a.date.getTime() - b.date.getTime()
    if (byDate !== 0) return byDate
    return KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
  })

  const totals = { purchases: 0, interest: 0, payments: 0 }
  let balance = openingBalance
  const entries = sorted.map((event) => {
    const delta = event.kind === 'payment' ? -event.amount : event.amount
    balance = round2(balance + delta)
    if (event.kind === 'purchase') totals.purchases += event.amount
    if (event.kind === 'interest') totals.interest += event.amount
    if (event.kind === 'payment') totals.payments += event.amount
    return { ...event, delta, balance }
  })

  return {
    entries,
    openingBalance,
    totals: {
      purchases: round2(totals.purchases),
      interest: round2(totals.interest),
      payments: round2(totals.payments),
    },
    balance,
  }
}
