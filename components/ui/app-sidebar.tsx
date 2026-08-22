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
  BadgeDollarSign,
  CreditCard,
  Home,
  Landmark,
  PiggyBank,
  Plug,
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
import { Suspense } from 'react'

import { Logo } from './logo'

function AppSidebarContent({ isAdmin }: { isAdmin: boolean }) {
  const { isMobile, setOpenMobile } = useSidebar()
  const { t } = useLanguage()
  const searchParams = useSearchParams()
  const currentView = Array.from(searchParams.entries())[0]?.[0] || 'overview'

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
    { icon: <BadgeDollarSign />, label: t('nav.pricing'), href: '?pricing' },
    { icon: <Plug />, label: t('nav.mcp'), href: '?mcp' },
    { icon: <Settings />, label: t('nav.settings'), href: '?settings' },
  ]

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="border-sidebar-border border-b p-5">
        <Logo />
      </SidebarHeader>
      <SidebarContent>
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
          <SidebarGroupLabel className="text-sidebar-foreground/45 px-2 text-[10px] font-bold tracking-[0.2em] uppercase">
            {t('nav.userSettings')}
          </SidebarGroupLabel>
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
