'use client'

import { useLanguage } from '@/components/language-provider'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { LanguageToggle } from '@/components/ui/language-toggle'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Link from 'next/link'

import { CategoryManager } from './category-manager'

export function Settings() {
  const { t } = useLanguage()

  return (
    <div className="flex w-full flex-col gap-4 rounded-md p-4 md:mt-4 md:w-11/12 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.language')}</CardTitle>
          <CardDescription>{t('settings.languageDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <LanguageToggle />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.mcpTitle')}</CardTitle>
          <CardDescription>{t('settings.mcpDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="?mcp">{t('settings.mcpOpenGuide')}</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.categories')}</CardTitle>
          <CardDescription>{t('settings.categoriesDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="expense" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="expense">
                {t('transactions.expense')}
              </TabsTrigger>
              <TabsTrigger value="income">
                {t('transactions.income')}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="expense" className="mt-4">
              <CategoryManager type="expense" />
            </TabsContent>
            <TabsContent value="income" className="mt-4">
              <CategoryManager type="income" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
