import {
  createTransferForUser,
  getTransfersForUser,
} from '@/app/dashboard/transactions/actions'
import { transferSchema } from '@/app/dashboard/transactions/schemas'
import { readJson, withApiUser } from '@/lib/api/http'
import {
  createTransferBody,
  searchParamsObject,
  transferListQuery,
} from '@/lib/api/schemas'

export const GET = withApiUser(({ request, userId }) => {
  const filters = transferListQuery.parse(searchParamsObject(request))
  return getTransfersForUser(userId, filters)
})

export const POST = withApiUser(async ({ request, userId }) => {
  const body = createTransferBody.parse(await readJson(request))
  const transfer = await createTransferForUser(
    userId,
    transferSchema.parse(body)
  )
  return Response.json(transfer, { status: 201 })
})
