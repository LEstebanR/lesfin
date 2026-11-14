'use client'

import { useLanguage } from '@/components/language-provider'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { GoogleSignInButton } from '@/components/ui/google-sign-in-button'
import { LegalNotice } from '@/components/ui/legal-notice'
import { Logo } from '@/components/ui/logo'
import Link from 'next/link'

export default function Signup() {
  const { t } = useLanguage()

  return (
    <div className="mx-auto mt-24 flex w-full flex-col items-center gap-4 px-4">
      <Link href="/" className="cursor-pointer">
        <Logo />
      </Link>
      <Card className="flex w-full flex-col md:w-4/12">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-bold">
            {t('auth.signupTitle')}
          </CardTitle>
          <CardDescription className="text-muted-foreground text-center text-lg">
            {t('auth.signupSubtitle')}
          </CardDescription>
          <CardContent className="mt-4">
            <GoogleSignInButton />
            <LegalNotice />
          </CardContent>
        </CardHeader>
      </Card>
    </div>
  )
}
