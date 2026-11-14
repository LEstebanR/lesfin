'use client'

import { useLanguage } from '@/components/language-provider'
import Link from 'next/link'

export function LegalNotice() {
  const { t } = useLanguage()

  return (
    <p className="text-muted-foreground mt-4 text-center text-xs leading-relaxed">
      {t('auth.legalPrefix')}{' '}
      <Link href="/terms" className="text-foreground underline">
        {t('auth.legalTerms')}
      </Link>{' '}
      {t('auth.legalAnd')}{' '}
      <Link href="/privacy" className="text-foreground underline">
        {t('auth.legalPrivacy')}
      </Link>
      .
    </p>
  )
}
