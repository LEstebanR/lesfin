import {
  createAccountForUser,
  getAccountsForUser,
} from '@/app/dashboard/accounts/actions'
import { readJson, withApiUser } from '@/lib/api/http'
import { createAccountBody } from '@/lib/api/schemas'

export const GET = withApiUser(({ userId }) => getAccountsForUser(userId))

export const POST = withApiUser(async ({ request, userId }) => {
  const body = createAccountBody.parse(await readJson(request))
  const account = await createAccountForUser(userId, {
    accountName: body.name,
    accountType: body.type,
    initialBalance: body.initialBalance,
    description: body.description,
    color: body.color,
    logoUrl: body.logoUrl,
    icon: body.icon,
  })
  return Response.json(account, { status: 201 })
})
