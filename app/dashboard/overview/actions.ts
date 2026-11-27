'use server'

import { getOverviewDataForUser } from '@/app/dashboard/overview/domain'
import { getServerSession } from '@/lib/session'

export async function getOverviewData() {
  const session = await getServerSession()
  if (!session) throw new Error('Not authenticated')

  return getOverviewDataForUser(session.user.id)
}
