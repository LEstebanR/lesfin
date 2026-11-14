// Read-only snapshot of every account and debt balance, one per line and in
// a stable order, so two runs can be diffed to prove a deploy or migration
// left balances untouched:
//
//   bun scripts/snapshot-balances.ts > before.txt
//   # deploy / migrate
//   bun scripts/snapshot-balances.ts > after.txt
//   diff before.txt after.txt
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const [accounts, debts] = await Promise.all([
    prisma.account.findMany({
      select: { id: true, name: true, currentBalance: true },
      orderBy: { id: 'asc' },
    }),
    prisma.debt.findMany({
      select: { id: true, name: true, type: true, remainingBalance: true },
      orderBy: { id: 'asc' },
    }),
  ])

  for (const a of accounts) {
    console.log(`account ${a.id}  ${a.name}  ${Number(a.currentBalance)}`)
  }
  for (const d of debts) {
    console.log(
      `debt ${d.id}  ${d.name} (${d.type})  ${Number(d.remainingBalance)}`
    )
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
