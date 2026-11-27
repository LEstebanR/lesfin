import {
  deleteTransactionForUser,
  updateTransactionForUser,
} from '@/app/dashboard/transactions/domain'
import { noContent, readJson, withApiUser } from '@/lib/api/http'
import { updateTransactionBody } from '@/lib/api/schemas'

// updateTransactionForUser merges the patch with the stored row and runs
// the full transactionSchema on the result.
export const PATCH = withApiUser<{ id: string }>(
  async ({ request, userId, params }) => {
    const patch = updateTransactionBody.parse(await readJson(request))
    return updateTransactionForUser(userId, params.id, patch)
  }
)

export const DELETE = withApiUser<{ id: string }>(
  async ({ userId, params }) => {
    await deleteTransactionForUser(userId, params.id)
    return noContent()
  }
)
