import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'

import { prisma } from './prisma'

const productionURL = 'https://lesfin.app'

export const baseURL =
  process.env.BETTER_AUTH_URL ??
  (process.env.NODE_ENV === 'production'
    ? productionURL
    : 'http://localhost:3000')

const trustedOrigins = [
  baseURL,
  productionURL,
  'https://www.lesfin.app',
  'https://personal-finances-chi.vercel.app',
  'https://personal-finances-lestebanrs-projects.vercel.app',
  'https://personal-finances-git-main-lestebanrs-projects.vercel.app',
]

export const auth = betterAuth({
  baseURL,
  trustedOrigins,
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  account: {
    modelName: 'authAccount',
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
})
