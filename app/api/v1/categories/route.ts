import { getCategoriesForUser } from '@/app/dashboard/categories/domain'
import { withApiUser } from '@/lib/api/http'
import { categoryListQuery, searchParamsObject } from '@/lib/api/schemas'

export const GET = withApiUser(({ request, userId }) => {
  const { type } = categoryListQuery.parse(searchParamsObject(request))
  return getCategoriesForUser(userId, type)
})
