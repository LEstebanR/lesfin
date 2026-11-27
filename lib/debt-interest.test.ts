import { type Prisma } from '@prisma/client'
import { describe, expect, it } from 'bun:test'

import {
  buildDebtLedger,
  interestPeriod,
  isValidInterestRate,
  monthlyRate,
  parsePercentInput,
  projectPayoff,
  suggestInterest,
} from './debt-interest'
import {
  applyInterestCharge,
  revertInterestCharge,
  updateInterestCharge,
} from './debt-interest-charges'

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

describe('parsePercentInput', () => {
  it.each([
    ['24,5', 0.245],
    ['24.5', 0.245],
    ['24,5 %', 0.245],
    ['2%', 0.02],
    ['0', 0],
  ])('reads %p as %p', (raw, expected) => {
    expect(parsePercentInput(raw)).toBeCloseTo(expected, 10)
  })

  it.each(['1.5,2', '24 5', '1.000,5', 'abc', '-3', ''])(
    'rejects %p instead of keeping a prefix',
    (raw) => {
      expect(parsePercentInput(raw)).toBeNaN()
    }
  )
})

describe('interest rates', () => {
  it.each([-0.01, 10.01, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid rate %p',
    (rate) => {
      expect(isValidInterestRate(rate)).toBe(false)
      expect(() => monthlyRate(rate, 'monthly')).toThrow()
    }
  )

  it('converts each rate type to a monthly rate', () => {
    expect(monthlyRate(0.268242, 'effective_annual')).toBeCloseTo(0.02, 5)
    expect(monthlyRate(0.24, 'nominal_annual')).toBeCloseTo(0.02, 10)
    expect(monthlyRate(0.02, 'monthly')).toBe(0.02)
    expect(monthlyRate(0, 'effective_annual')).toBe(0)
  })

  it('suggests balance × monthly rate, and nothing on a paid debt', () => {
    expect(suggestInterest(1000, 0.02, 'monthly')).toBe(20)
    expect(suggestInterest(0, 0.02, 'monthly')).toBe(0)
  })

  it('derives the period from the UTC month', () => {
    expect(interestPeriod(d('2026-11-30'))).toBe('2026-11')
    expect(interestPeriod(d('2026-01-01'))).toBe('2026-01')
  })
})

describe('projectPayoff', () => {
  const base = {
    rate: 0.02,
    rateType: 'monthly' as const,
    from: d('2026-11-25'),
  }

  it('reports paid, missing rate and missing payment', () => {
    expect(
      projectPayoff({ ...base, balance: 0, monthlyPayment: 100 }).status
    ).toBe('paid_off')
    expect(
      projectPayoff({ ...base, balance: 100, rate: null, monthlyPayment: 10 })
        .status
    ).toBe('no_rate')
    expect(
      projectPayoff({ ...base, balance: 100, monthlyPayment: null }).status
    ).toBe('no_payment')
  })

  it('never pays off when the payment does not cover the interest', () => {
    expect(
      projectPayoff({ ...base, balance: 1000, monthlyPayment: 20 })
    ).toEqual({
      status: 'never',
      monthlyInterest: 20,
    })
  })

  it('projects months, interest and payoff date', () => {
    const result = projectPayoff({
      ...base,
      rate: 0,
      balance: 300,
      monthlyPayment: 100,
    })
    expect(result).toEqual({
      status: 'ok',
      months: 3,
      totalInterest: 0,
      payoffDate: d('2027-02-01'),
    })

    const withInterest = projectPayoff({
      ...base,
      balance: 1000,
      monthlyPayment: 100,
    })
    expect(withInterest.status).toBe('ok')
    if (withInterest.status === 'ok') {
      expect(withInterest.months).toBe(12)
      expect(withInterest.totalInterest).toBeGreaterThan(0)
    }
  })
})

describe('buildDebtLedger', () => {
  it('rebuilds the balance chronologically regardless of input order', () => {
    const ledger = buildDebtLedger(1000, [
      { id: 'p2', kind: 'payment', amount: 300, date: d('2026-10-15') },
      { id: 'i1', kind: 'interest', amount: 20, date: d('2026-09-30') },
      { id: 'c1', kind: 'purchase', amount: 50, date: d('2026-09-10') },
      { id: 'p1', kind: 'payment', amount: 100, date: d('2026-09-30') },
    ])

    expect(ledger.entries.map((e) => e.id)).toEqual(['c1', 'i1', 'p1', 'p2'])
    expect(ledger.entries.map((e) => e.balance)).toEqual([1050, 1070, 970, 670])
    expect(ledger.totals).toEqual({
      purchases: 50,
      interest: 20,
      payments: 400,
    })
    expect(ledger.balance).toBe(670)
  })

  it('applies interest before a payment on the same day', () => {
    const ledger = buildDebtLedger(100, [
      { id: 'p', kind: 'payment', amount: 102, date: d('2026-11-01') },
      { id: 'i', kind: 'interest', amount: 2, date: d('2026-11-01') },
    ])
    expect(ledger.entries.map((e) => e.balance)).toEqual([102, 0])
  })
})

type Row = Record<string, unknown> & { id: string }

// Minimal in-memory stand-in for the slice of Prisma.TransactionClient that
// interest charges touch.
function seed(remainingBalance = 1000) {
  const tables: Record<string, Row[]> = {
    debt: [
      {
        id: 'debt-1',
        userId: 'user-1',
        remainingBalance,
        createdAt: d('2026-08-01'),
      },
    ],
    debtInterestCharge: [],
    transaction: [],
    budgetItem: [{ id: 'future-budget', debtId: 'debt-1' }],
  }
  let nextId = 0
  const matches = (row: Row, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => row[key] === value)

  const model = (name: string) => ({
    findFirst: async ({ where }: { where: Record<string, unknown> }) =>
      tables[name].find((r) => matches(r, where)) ?? null,
    findFirstOrThrow: async ({ where }: { where: Record<string, unknown> }) => {
      const row = tables[name].find((r) => matches(r, where))
      if (!row) throw new Error(`${name} not found`)
      return row
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const row = { id: `${name}-${++nextId}`, ...data }
      tables[name].push(row)
      return row
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string }
      data: Record<string, unknown>
    }) => {
      const row = tables[name].find((r) => r.id === where.id)
      if (!row) throw new Error(`${name} not found`)
      for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === 'object' && !(value instanceof Date)) {
          const op = value as { increment?: number; decrement?: number }
          row[key] =
            Number(row[key]) + (op.increment ?? 0) - (op.decrement ?? 0)
        } else {
          row[key] = value
        }
      }
      return row
    },
    delete: async ({ where }: { where: { id: string } }) => {
      tables[name] = tables[name].filter((r) => r.id !== where.id)
    },
    // Every seeded budget item is a future one, so the date filter is moot.
    deleteMany: async ({ where }: { where: { debtId: string } }) => {
      const before = tables[name].length
      tables[name] = tables[name].filter((r) => r.debtId !== where.debtId)
      return { count: before - tables[name].length }
    },
  })

  const tx = Object.fromEntries(
    Object.keys(tables).map((name) => [name, model(name)])
  ) as unknown as Prisma.TransactionClient
  return { tx, tables }
}

const NOW = d('2026-11-25')
const charge = { debtId: 'debt-1', amount: 20, date: d('2026-10-31') }

describe('interest charges', () => {
  it('raises the balance without creating an expense', async () => {
    const { tx, tables } = seed()
    const created = await applyInterestCharge(tx, 'user-1', charge, NOW)

    expect(tables.debt[0].remainingBalance).toBe(1020)
    expect(tables.transaction).toHaveLength(0)
    expect(created).toMatchObject({ period: '2026-10', source: 'manual' })
  })

  it('does not duplicate a period', async () => {
    const { tx, tables } = seed()
    await applyInterestCharge(tx, 'user-1', charge, NOW)
    await expect(
      applyInterestCharge(
        tx,
        'user-1',
        { ...charge, date: d('2026-10-05') },
        NOW
      )
    ).rejects.toThrow(/already recorded/)
    expect(tables.debt[0].remainingBalance).toBe(1020)
  })

  it('rejects dates before the debt or in the future', async () => {
    const { tx } = seed()
    await expect(
      applyInterestCharge(
        tx,
        'user-1',
        { ...charge, date: d('2026-07-30') },
        NOW
      )
    ).rejects.toThrow(/before the debt/)
    await expect(
      applyInterestCharge(
        tx,
        'user-1',
        { ...charge, date: d('2026-11-27') },
        NOW
      )
    ).rejects.toThrow(/future/)
  })

  it("allows the debt's local creation day and today across UTC offsets", async () => {
    // Created 20:00 on Nov 24 in Colombia (UTC-5) = Nov 25 01:00Z.
    const { tx, tables } = seed()
    tables.debt[0].createdAt = new Date('2026-11-25T01:00:00.000Z')
    const evening = new Date('2026-11-25T01:30:00.000Z')

    await expect(
      applyInterestCharge(
        tx,
        'user-1',
        { ...charge, date: d('2026-11-24') },
        evening
      )
    ).resolves.toMatchObject({ period: '2026-11' })

    // Early morning in UTC+5: the local day is already a day ahead of UTC.
    const other = seed()
    await expect(
      applyInterestCharge(
        other.tx,
        'user-1',
        { ...charge, date: d('2026-11-26') },
        new Date('2026-11-25T20:00:00.000Z')
      )
    ).resolves.toMatchObject({ period: '2026-11' })
  })

  it('edits an older charge without re-validating its unchanged date', async () => {
    const { tx, tables } = seed()
    tables.debtInterestCharge.push({
      id: 'old',
      debtId: 'debt-1',
      userId: 'user-1',
      amount: 10,
      date: d('2026-06-30'),
      period: '2026-06',
      source: 'manual',
      note: null,
    })

    await expect(
      updateInterestCharge(tx, 'user-1', 'old', { note: 'fixed' }, NOW)
    ).resolves.toMatchObject({ note: 'fixed', period: '2026-06' })
    await expect(
      updateInterestCharge(tx, 'user-1', 'old', { date: d('2026-06-15') }, NOW)
    ).rejects.toThrow(/before the debt/)
  })

  it('refuses to remove interest that was already paid', async () => {
    const { tx, tables } = seed()
    const created = await applyInterestCharge(tx, 'user-1', charge, NOW)
    tables.debt[0].remainingBalance = 0 // paid off, interest included

    await expect(
      revertInterestCharge(tx, 'user-1', created.id)
    ).rejects.toThrow(/negative balance/)
    await expect(
      updateInterestCharge(tx, 'user-1', created.id, { amount: 5 }, NOW)
    ).rejects.toThrow(/negative balance/)
  })

  it('clears future budget items when removing interest pays the debt off', async () => {
    const { tx, tables } = seed(5)
    const created = await applyInterestCharge(tx, 'user-1', charge, NOW)
    tables.debt[0].remainingBalance = 20 // only the interest is left

    await revertInterestCharge(tx, 'user-1', created.id)

    expect(tables.debt[0].remainingBalance).toBe(0)
    expect(tables.budgetItem).toHaveLength(0)
  })

  it('maps a unique-index race to the "already recorded" error', async () => {
    const { tx } = seed()
    const raw = tx as unknown as {
      debtInterestCharge: { create: () => Promise<never> }
    }
    raw.debtInterestCharge.create = async () => {
      throw Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
      })
    }

    await expect(
      applyInterestCharge(tx, 'user-1', charge, NOW)
    ).rejects.toThrow(/Interest for 2026-10 is already recorded/)
  })

  it('rejects a charge on a paid-off debt', async () => {
    const { tx, tables } = seed(0)
    await expect(
      applyInterestCharge(tx, 'user-1', charge, NOW)
    ).rejects.toThrow(/paid off/)
    expect(tables.debtInterestCharge).toHaveLength(0)
  })

  it("rejects another user's debt", async () => {
    const { tx } = seed()
    await expect(
      applyInterestCharge(tx, 'user-2', charge, NOW)
    ).rejects.toThrow()
  })

  it('moves the balance by the difference when edited', async () => {
    const { tx, tables } = seed()
    const created = await applyInterestCharge(tx, 'user-1', charge, NOW)
    const updated = await updateInterestCharge(
      tx,
      'user-1',
      created.id,
      { amount: 35, date: d('2026-11-01') },
      NOW
    )

    expect(tables.debt[0].remainingBalance).toBe(1035)
    expect(updated).toMatchObject({ amount: 35, period: '2026-11' })
  })

  it('refuses to move a charge onto a period that already has one', async () => {
    const { tx, tables } = seed()
    const oct = await applyInterestCharge(tx, 'user-1', charge, NOW)
    await applyInterestCharge(
      tx,
      'user-1',
      { ...charge, date: d('2026-11-01') },
      NOW
    )
    await expect(
      updateInterestCharge(
        tx,
        'user-1',
        oct.id,
        { date: d('2026-11-02'), amount: 50 },
        NOW
      )
    ).rejects.toThrow(/already recorded/)
    expect(tables.debt[0].remainingBalance).toBe(1040)
  })

  it('restores the balance when deleted', async () => {
    const { tx, tables } = seed()
    const created = await applyInterestCharge(tx, 'user-1', charge, NOW)
    await revertInterestCharge(tx, 'user-1', created.id)

    expect(tables.debt[0].remainingBalance).toBe(1000)
    expect(tables.debtInterestCharge).toHaveLength(0)
  })
})
