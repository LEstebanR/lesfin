import { updateAccountForUser } from '@/app/dashboard/accounts/actions'
import { readJson, withApiUser } from '@/lib/api/http'
import { updateAccountBody } from '@/lib/api/schemas'

export const PATCH = withApiUser<{ id: string }>(
  async ({ request, userId, params }) => {
    const patch = updateAccountBody.parse(await readJson(request))
    return updateAccountForUser(userId, params.id, patch)
  }
)
