import {
  deleteTransferForUser,
  updateTransferForUser,
} from '@/app/dashboard/transactions/domain'
import { noContent, readJson, withApiUser } from '@/lib/api/http'
import { updateTransferBody } from '@/lib/api/schemas'

// updateTransferForUser merges the patch with the stored row and runs the
// full transferSchema on the result.
export const PATCH = withApiUser<{ id: string }>(
  async ({ request, userId, params }) => {
    const patch = updateTransferBody.parse(await readJson(request))
    return updateTransferForUser(userId, params.id, patch)
  }
)

export const DELETE = withApiUser<{ id: string }>(
  async ({ userId, params }) => {
    await deleteTransferForUser(userId, params.id)
    return noContent()
  }
)
