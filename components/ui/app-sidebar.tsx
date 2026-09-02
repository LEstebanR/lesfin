'use client'

import { FeedbackDialog } from '@/components/dashboard/feedback-dialog'
import { useLanguage } from '@/components/language-provider'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  ChevronDown,
  CreditCard,
  Home,
  Landmark,
  PiggyBank,
  Repeat,
  Settings,
  Shield,
  Sparkles,
  TrendingUp,
  User,
  Wallet,
} from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'

import { Logo } from './logo'

function AppSidebarContent({ isAdmin }: { isAdmin: boolean }) {
  const { isMobile, setOpenMobile } = useSidebar()
  const { t } = useLanguage()
  const searchParams = useSearchParams()
  const currentView = Array.from(searchParams.entries())[0]?.[0] || 'overview'
  const contentRef = useRef<HTMLDivElement>(null)
  const [showScrollHint, setShowScrollHint] = useState(false)

  useEffect(() => {
    const content = contentRef.current
    if (!content || !isMobile) return

    const updateScrollHint = () => {
      const canScroll = content.scrollHeight > content.clientHeight + 4
      const hasMoreBelow =
        content.scrollTop + content.clientHeight < content.scrollHeight - 4
      setShowScrollHint(canScroll && hasMoreBelow)
    }

    updateScrollHint()
    content.addEventListener('scroll', updateScrollHint, { passive: true })
    window.addEventListener('resize', updateScrollHint)
    const resizeObserver = new ResizeObserver(updateScrollHint)
    resizeObserver.observe(content)
    return () => {
      content.removeEventListener('scroll', updateScrollHint)
      window.removeEventListener('resize', updateScrollHint)
      resizeObserver.disconnect()
    }
  }, [isMobile])

  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false)
  }

  const optionsMenu = [
    { icon: <Home />, label: t('nav.overview'), href: '?overview' },
    { icon: <Wallet />, label: t('nav.accounts'), href: '?accounts' },
    {
      icon: <CreditCard />,
      label: t('nav.transactions'),
      href: '?transactions',
    },
    { icon: <Landmark />, label: t('nav.debts'), href: '?debts' },
    { icon: <PiggyBank />, label: t('nav.budget'), href: '?budget' },
    {
      icon: <Repeat />,
      label: t('nav.subscriptions'),
      href: '?subscriptions',
    },
    {
      icon: <TrendingUp />,
      label: t('nav.spendingTrends'),
      href: '?spending-trends',
    },
  ]

  const optionsSettings = [
    { icon: <User />, label: t('nav.profile'), href: '?profile' },
    { icon: <Sparkles />, label: t('nav.plan'), href: '?plan' },
    { icon: <Settings />, label: t('nav.settings'), href: '?settings' },
  ]

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="border-sidebar-border border-b p-5">
        <Logo />
      </SidebarHeader>
      <SidebarContent ref={contentRef}>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/45 px-2 text-[10px] font-bold tracking-[0.2em] uppercase">
            {t('nav.menu')}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {optionsMenu.map((option) => {
                const isActive = currentView === option.href.slice(1)
                return (
                  <SidebarMenuItem key={option.href}>
                    <SidebarMenuButton
                      className="cursor-pointer"
                      isActive={isActive}
                      asChild
                    >
                      <Link href={option.href} onClick={closeOnMobile}>
                        {option.icon} {option.label}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
              <SidebarMenuItem>
                <FeedbackDialog />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {showScrollHint && (
          <div className="from-sidebar via-sidebar/95 pointer-events-none sticky bottom-0 z-10 -mt-10 flex h-10 items-end justify-center bg-gradient-to-t to-transparent pb-1 text-[10px] font-bold tracking-[0.16em] uppercase md:hidden">
            <span className="bg-sidebar/90 text-sidebar-foreground/60 flex items-center gap-1 rounded-full px-2 py-1 backdrop-blur-sm">
              {t('nav.scrollForMore')}
              <ChevronDown className="h-3 w-3" />
            </span>
          </div>
        )}
      </SidebarContent>
      <SidebarFooter>
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="cursor-pointer"
                    isActive={currentView === 'admin'}
                    asChild
                  >
                    <Link href="?admin" onClick={closeOnMobile}>
                      <Shield /> {t('nav.admin')}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {optionsSettings.map((option) => {
                const isActive = currentView === option.href.slice(1)
                return (
                  <SidebarMenuItem key={option.href}>
                    <SidebarMenuButton
                      className="cursor-pointer"
                      isActive={isActive}
                      asChild
                    >
                      <Link href={option.href} onClick={closeOnMobile}>
                        {option.icon} {option.label}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  )
}

export function AppSidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  return (
    <Suspense fallback={<Sidebar className="" />}>
      <AppSidebarContent isAdmin={isAdmin} />
    </Suspense>
  )
}
