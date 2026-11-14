import { type Prisma } from '@prisma/client'
import { describe, expect, it } from 'bun:test'

import {
  applyDebtPayment,
  revertDebtPayment,
  updateDebtPayment,
} from './debt-payments'

type Row = Record<string, unknown> & { id: string }

// Minimal in-memory stand-in for the slice of Prisma.TransactionClient that
// debt payments touch: enough to assert on balances and created rows.
function createFakeTx(seed: { debts: Row[]; accounts: Row[] }) {
  const tables: Record<string, Row[]> = {
    debt: seed.debts.map((r) => ({ ...r })),
    account: seed.accounts.map((r) => ({ ...r })),
    category: [],
    transaction: [],
    debtPayment: [],
    budgetItem: [],
  }
  let nextId = 0

  const matches = (row: Row, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => {
      if (key === 'name' && value && typeof value === 'object') {
        const { equals } = value as { equals: string }
        return String(row.name).toLowerCase() === equals.toLowerCase()
      }
      return row[key] === value
    })

  const applyData = (row: Row, data: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && !(value instanceof Date)) {
        const op = value as { increment?: number; decrement?: number }
        row[key] = Number(row[key]) + (op.increment ?? 0) - (op.decrement ?? 0)
      } else {
        row[key] = value
      }
    }
    return row
  }

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
      return applyData(row, data)
    },
    delete: async ({ where }: { where: { id: string } }) => {
      tables[name] = tables[name].filter((r) => r.id !== where.id)
    },
    deleteMany: async () => ({ count: 0 }),
  })

  const tx = Object.fromEntries(
    Object.keys(tables).map((name) => [name, model(name)])
  ) as unknown as Prisma.TransactionClient

  return { tx, tables }
}

const USER = 'user-1'

function seed(debtType: 'loan' | 'credit_card') {
  return createFakeTx({
    debts: [
      {
        id: 'debt-1',
        userId: USER,
        name: 'Deuda X',
        type: debtType,
        remainingBalance: 1000,
      },
    ],
    accounts: [
      { id: 'acc-1', userId: USER, currentBalance: 500 },
      { id: 'acc-2', userId: USER, currentBalance: 900 },
      { id: 'acc-other', userId: 'user-2', currentBalance: 100 },
    ],
  })
}

const payment = {
  debtId: 'debt-1',
  accountId: 'acc-1',
  amount: 200,
  date: new Date('2026-11-01T00:00:00.000Z'),
  note: null,
}

describe('applyDebtPayment', () => {
  it.each(['loan', 'credit_card'] as const)(
    'mirrors a %s payment as a "Deuda" expense',
    async (type) => {
      const { tx, tables } = seed(type)
      const created = await applyDebtPayment(tx, USER, payment)

      expect(tables.transaction).toHaveLength(1)
      expect(tables.transaction[0]).toMatchObject({
        type: 'expense',
        amount: 200,
        accountId: 'acc-1',
        description: 'Pago: Deuda X',
      })
      expect(tables.category[0]).toMatchObject({ name: 'Deuda' })
      expect(created.transactionId).toBe(tables.transaction[0].id)
    }
  )

  it.each(['loan', 'credit_card'] as const)(
    'lowers account and debt balances for a %s payment',
    async (type) => {
      const { tx, tables } = seed(type)
      await applyDebtPayment(tx, USER, payment)

      expect(tables.account[0].currentBalance).toBe(300)
      expect(tables.debt[0].remainingBalance).toBe(800)
    }
  )

  it("rejects paying another user's debt", async () => {
    const { tx, tables } = seed('loan')
    await expect(applyDebtPayment(tx, 'user-2', payment)).rejects.toThrow()
    expect(tables.debtPayment).toHaveLength(0)
  })
})

describe('revertDebtPayment', () => {
  it.each(['loan', 'credit_card'] as const)(
    'restores balances and removes every record of a %s payment',
    async (type) => {
      const { tx, tables } = seed(type)
      const created = await applyDebtPayment(tx, USER, payment)
      await revertDebtPayment(tx, USER, created.id)

      expect(tables.account[0].currentBalance).toBe(500)
      expect(tables.debt[0].remainingBalance).toBe(1000)
      expect(tables.debtPayment).toHaveLength(0)
      expect(tables.transaction).toHaveLength(0)
    }
  )

  it("rejects reverting another user's payment", async () => {
    const { tx, tables } = seed('loan')
    const created = await applyDebtPayment(tx, USER, payment)

    await expect(revertDebtPayment(tx, 'user-2', created.id)).rejects.toThrow()
    expect(tables.debtPayment).toHaveLength(1)
  })
})

describe('updateDebtPayment', () => {
  it('re-applies a new amount to both balances and the mirrored expense', async () => {
    const { tx, tables } = seed('loan')
    const created = await applyDebtPayment(tx, USER, payment)
    const updated = await updateDebtPayment(tx, USER, created.id, {
      amount: 350,
    })

    expect(updated.id).toBe(created.id)
    expect(tables.account[0].currentBalance).toBe(150)
    expect(tables.debt[0].remainingBalance).toBe(650)
    expect(tables.transaction).toHaveLength(1)
    expect(tables.transaction[0]).toMatchObject({ amount: 350 })
  })

  it('moves the payment to another account', async () => {
    const { tx, tables } = seed('credit_card')
    const created = await applyDebtPayment(tx, USER, payment)
    await updateDebtPayment(tx, USER, created.id, { accountId: 'acc-2' })

    expect(tables.account[0].currentBalance).toBe(500)
    expect(tables.account[1].currentBalance).toBe(700)
    expect(tables.debt[0].remainingBalance).toBe(800)
    expect(tables.transaction[0]).toMatchObject({ accountId: 'acc-2' })
  })

  it('keeps exactly one mirrored expense after several edits', async () => {
    const { tx, tables } = seed('loan')
    const created = await applyDebtPayment(tx, USER, payment)
    const date = new Date('2026-11-10T00:00:00.000Z')
    await updateDebtPayment(tx, USER, created.id, { amount: 100 })
    await updateDebtPayment(tx, USER, created.id, { date, note: 'Cuota' })

    expect(tables.debtPayment).toHaveLength(1)
    expect(tables.transaction).toHaveLength(1)
    expect(tables.transaction[0]).toMatchObject({
      amount: 100,
      date,
      description: 'Cuota',
    })
    expect(tables.debt[0].remainingBalance).toBe(900)
  })

  it('leaves balances untouched when re-saved without changes', async () => {
    const { tx, tables } = seed('loan')
    const created = await applyDebtPayment(tx, USER, payment)
    await updateDebtPayment(tx, USER, created.id, {})

    expect(tables.account[0].currentBalance).toBe(300)
    expect(tables.debt[0].remainingBalance).toBe(800)
  })

  it("rejects editing another user's payment", async () => {
    const { tx, tables } = seed('loan')
    const created = await applyDebtPayment(tx, USER, payment)

    await expect(
      updateDebtPayment(tx, 'user-2', created.id, { amount: 1 })
    ).rejects.toThrow()
    expect(tables.debt[0].remainingBalance).toBe(800)
  })

  it("rejects moving a payment to another user's account", async () => {
    const { tx, tables } = seed('loan')
    const created = await applyDebtPayment(tx, USER, payment)

    await expect(
      updateDebtPayment(tx, USER, created.id, { accountId: 'acc-other' })
    ).rejects.toThrow()
    expect(tables.account[0].currentBalance).toBe(300)
    expect(tables.account[2].currentBalance).toBe(100)
  })
})
