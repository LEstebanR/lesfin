import { getOverviewDataForUser } from '@/app/dashboard/overview/actions'
import { withApiUser } from '@/lib/api/http'

export const GET = withApiUser(({ userId }) => getOverviewDataForUser(userId))
