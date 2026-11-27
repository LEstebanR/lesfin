import {
  createTransactionForUser,
  getTransactionsForUser,
} from '@/app/dashboard/transactions/domain'
import { transactionSchema } from '@/app/dashboard/transactions/schemas'
import { readJson, withApiUser } from '@/lib/api/http'
import {
  createTransactionBody,
  searchParamsObject,
  transactionListQuery,
} from '@/lib/api/schemas'

export const GET = withApiUser(({ request, userId }) => {
  const filters = transactionListQuery.parse(searchParamsObject(request))
  return getTransactionsForUser(userId, filters)
})

export const POST = withApiUser(async ({ request, userId }) => {
  const body = createTransactionBody.parse(await readJson(request))
  const transaction = await createTransactionForUser(
    userId,
    transactionSchema.parse(body)
  )
  return Response.json(transaction, { status: 201 })
})
