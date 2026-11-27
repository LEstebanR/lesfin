import { getOverviewDataForUser } from '@/app/dashboard/overview/domain'
import { withApiUser } from '@/lib/api/http'

export const GET = withApiUser(({ userId }) => getOverviewDataForUser(userId))
