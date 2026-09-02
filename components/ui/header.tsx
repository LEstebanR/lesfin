'use client'

import { useLanguage } from '@/components/language-provider'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LanguageToggle } from '@/components/ui/language-toggle'
import { Logo } from '@/components/ui/logo'
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { authClient } from '@/lib/auth-client'
import { AvatarFallback } from '@radix-ui/react-avatar'
import { LogIn, LogOut, MenuIcon, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

import { Avatar, AvatarImage } from './avatar'

type HeaderUser = {
  name: string
  email: string
  image?: string | null
}

function DashboardHeaderContent({ user }: { user?: HeaderUser | null }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentView = Array.from(searchParams.entries())[0]?.[0]
  const { t } = useLanguage()
  const { state, isMobile } = useSidebar()

  const handleLogout = async () => {
    await authClient.signOut()
    router.push('/')
  }

  const viewTitleKey = currentView?.replace(/-([a-z])/g, (_, c) =>
    c.toUpperCase()
  )
  const viewTitle = viewTitleKey
    ? (t(`nav.${viewTitleKey}`) ?? viewTitleKey)
    : t('nav.accounts')

  const sidebarOffset =
    !isMobile && state === 'expanded' ? 'var(--sidebar-width)' : '0px'

  return (
    <header
      className="bg-background/90 fixed top-0 right-0 z-50 flex h-16 items-center justify-between border-b px-5 backdrop-blur transition-[left] duration-200 ease-linear"
      style={{ left: sidebarOffset }}
    >
      <div className="flex items-center gap-4">
        <SidebarTrigger />
      </div>
      <h2 className="truncate text-xs font-black tracking-[0.18em] uppercase">
        {viewTitle}
      </h2>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Avatar className="cursor-pointer">
              <AvatarImage src={user?.image ?? ''} alt={user?.name} />
              <AvatarFallback>
                {user?.name?.charAt(0).toUpperCase() ?? ''}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="mt-2 rounded-t-none">
            <DropdownMenuLabel className="text-bold py-0">
              {user?.name}
            </DropdownMenuLabel>
            <DropdownMenuLabel className="text-muted-foreground py-0">
              {user?.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              {t('header.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

function LandingHeaderContent() {
  const { t } = useLanguage()

  return (
    <header className="bg-background sticky top-0 z-50 flex h-14 w-full items-center justify-between border-b px-4">
      <div className="gap-4w-full mx-auto flex w-full border-spacing-7 items-center justify-between md:w-8/12">
        <Link className="cursor-pointer" href="/">
          <Logo />
        </Link>
        <div className="hidden items-center gap-4 md:flex">
          <Link
            href="/pricing"
            className="text-muted-foreground hover:text-foreground text-sm font-medium"
          >
            {t('header.pricing')}
          </Link>
          <LanguageToggle />
          <Link href="/login">
            <Button variant="outline">{t('header.login')}</Button>
          </Link>
          <Link href="/signup">
            <Button>{t('header.signup')}</Button>
          </Link>
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <LanguageToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <MenuIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="mt-3 w-[calc(100vw-2rem)] rounded-t-none"
            >
              <Link href="/pricing" className="flex items-center gap-2">
                <DropdownMenuItem>{t('header.pricing')}</DropdownMenuItem>
              </Link>
              <Link href="/login" className="flex items-center gap-2">
                <DropdownMenuItem>
                  <LogIn className="h-4 w-4" />
                  {t('header.login')}
                </DropdownMenuItem>
              </Link>
              <Link href="/signup" className="flex items-center gap-2">
                <DropdownMenuItem>
                  <UserPlus className="h-4 w-4" />
                  {t('header.signup')}
                </DropdownMenuItem>
              </Link>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

export function Header(props: { user?: HeaderUser | null; path?: string }) {
  return (
    <Suspense fallback={<div className="h-14 w-full border-b" />}>
      {props.path === '/' ? (
        <LandingHeaderContent />
      ) : (
        <DashboardHeaderContent user={props.user} />
      )}
    </Suspense>
  )
}
