'use client'

import { createMcpApiKey, revokeMcpApiKey } from '@/app/dashboard/mcp/actions'
import { useLanguage } from '@/components/language-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { queryKeys, useMcpApiKeys } from '@/lib/queries'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Copy, KeyRound, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'

const READ_TOOLS = [
  'get_overview',
  'get_monthly_report',
  'get_budget_overview',
  'get_cash_runway',
  'get_daily_financial_agenda',
  'get_due_payments',
  'get_current_date',
  'list_accounts',
  'list_transactions',
  'list_transfers',
  'list_categories',
  'list_debts',
  'list_subscriptions',
]

const WRITE_TOOLS = [
  'create_transaction',
  'create_transfer',
  'create_subscription',
  'update_transaction',
  'update_transfer',
  'update_subscription',
  'delete_transaction',
  'delete_transfer',
  'delete_subscription',
]

function CopyableBlock({ value }: { value: string }) {
  const { t } = useLanguage()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="bg-muted flex items-start gap-2 rounded-md p-3">
      <pre className="min-w-0 flex-1 overflow-x-auto font-mono text-xs whitespace-pre-wrap">
        {value}
      </pre>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        aria-label={t('mcpGuide.copy')}
        className="shrink-0"
      >
        {copied ? <Check className="text-primary" /> : <Copy />}
        <span className="sr-only sm:not-sr-only">
          {copied ? t('mcpGuide.copied') : t('mcpGuide.copy')}
        </span>
      </Button>
    </div>
  )
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="space-y-2">
      {items.map((item, index) => (
        <li key={item} className="flex gap-3 text-sm">
          <span className="bg-primary/10 text-primary flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
            {index + 1}
          </span>
          <span className="text-muted-foreground pt-px">{item}</span>
        </li>
      ))}
    </ol>
  )
}

function SectionHeading({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mt-4">
      <h2 className="text-xs font-black tracking-[0.18em] uppercase">
        {title}
      </h2>
      <p className="text-muted-foreground mt-2 text-sm">{description}</p>
    </div>
  )
}

function ApiKeyManager() {
  const { t, language } = useLanguage()
  const queryClient = useQueryClient()
  const { data, isLoading } = useMcpApiKeys()

  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [newToken, setNewToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const locale = language === 'es' ? 'es-CO' : 'en-US'
  const formatDate = (value: Date | string) =>
    new Date(value).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.mcpApiKeys })

  const handleCreate = async () => {
    setError(null)
    setCreating(true)
    try {
      const created = await createMcpApiKey(name.trim() || 'default')
      setNewToken(created.token)
      setName('')
      await refresh()
    } catch (caught) {
      const message =
        caught instanceof Error && caught.message.includes('MAX_KEYS_REACHED')
          ? t('mcpGuide.keysMaxReached')
          : t('mcpGuide.keysError')
      setError(message)
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (id: string) => {
    if (!window.confirm(t('mcpGuide.keysRevokeConfirm'))) return
    setError(null)
    setRevokingId(id)
    try {
      await revokeMcpApiKey(id)
      await refresh()
    } catch {
      setError(t('mcpGuide.keysError'))
    } finally {
      setRevokingId(null)
    }
  }

  const keys = data?.keys ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('mcpGuide.keysTitle')}</CardTitle>
        <CardDescription>{t('mcpGuide.keysDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {newToken ? (
          <div className="border-primary/40 bg-primary/5 space-y-3 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <KeyRound className="text-primary h-4 w-4 shrink-0" />
              <p className="text-sm font-medium">
                {t('mcpGuide.keysNewTitle')}
              </p>
            </div>
            <CopyableBlock value={newToken} />
            <p className="text-muted-foreground text-sm">
              {t('mcpGuide.keysNewWarning')}
            </p>
            <Button size="sm" onClick={() => setNewToken(null)}>
              {t('mcpGuide.keysDone')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('mcpGuide.keysNamePlaceholder')}
              maxLength={60}
              disabled={creating}
            />
            <Button
              onClick={handleCreate}
              disabled={creating}
              className="shrink-0"
            >
              {creating
                ? t('mcpGuide.keysGenerating')
                : t('mcpGuide.keysGenerate')}
            </Button>
          </div>
        )}

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        {!isLoading && keys.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {t('mcpGuide.keysEmpty')}
          </p>
        ) : null}

        {keys.length > 0 ? (
          <ul className="divide-y">
            {keys.map((key) => (
              <li
                key={key.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{key.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {t('mcpGuide.keysCreatedAt', {
                      date: formatDate(key.createdAt),
                    })}
                    {' · '}
                    {key.lastUsedAt
                      ? t('mcpGuide.keysLastUsed', {
                          date: formatDate(key.lastUsedAt),
                        })
                      : t('mcpGuide.keysNeverUsed')}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRevoke(key.id)}
                  disabled={revokingId === key.id}
                >
                  {revokingId === key.id
                    ? t('mcpGuide.keysRevoking')
                    : t('mcpGuide.keysRevoke')}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function McpGuide() {
  const { t } = useLanguage()
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const baseUrl = origin || 'https://lesfin.app'
  const serverUrl = `${baseUrl}/api/mcp`
  const discoveryUrl = `${baseUrl}/.well-known/oauth-authorization-server`

  const claudeCommand = `claude mcp add --transport http lesfin ${serverUrl} --header "Authorization: Bearer YOUR_API_KEY"`
  const geminiCommand = `gemini mcp add --transport http lesfin ${serverUrl} --header "Authorization: Bearer YOUR_API_KEY"`
  const geminiConfig = `{
  "mcpServers": {
    "lesfin": {
      "httpUrl": "${serverUrl}",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}`

  return (
    <div className="flex w-full flex-col gap-4 rounded-md p-4 md:mt-4 md:w-11/12 md:p-8">
      <div>
        <h1 className="text-2xl font-black tracking-tight">
          {t('mcpGuide.title')}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {t('mcpGuide.intro')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('mcpGuide.serverUrlLabel')}</CardTitle>
          <CardDescription>{t('mcpGuide.serverUrlDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <CopyableBlock value={serverUrl} />
        </CardContent>
      </Card>

      <SectionHeading
        title={t('mcpGuide.appsTitle')}
        description={t('mcpGuide.appsDesc')}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{t('mcpGuide.claudeWebTitle')}</CardTitle>
            <Badge variant="secondary">{t('mcpGuide.claudeWebBadge')}</Badge>
          </div>
          <CardDescription>{t('mcpGuide.claudeWebDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Steps
            items={[
              t('mcpGuide.claudeWebStep1'),
              t('mcpGuide.claudeWebStep2'),
              t('mcpGuide.claudeWebStep3'),
              t('mcpGuide.claudeWebStep4'),
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{t('mcpGuide.chatgptTitle')}</CardTitle>
            <Badge variant="secondary">{t('mcpGuide.chatgptBadge')}</Badge>
          </div>
          <CardDescription>{t('mcpGuide.chatgptDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Steps
            items={[
              t('mcpGuide.chatgptStep1'),
              t('mcpGuide.chatgptStep2'),
              t('mcpGuide.chatgptStep3'),
              t('mcpGuide.chatgptStep4'),
              t('mcpGuide.chatgptStep5'),
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('mcpGuide.askTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {[
            t('mcpGuide.ask1'),
            t('mcpGuide.ask2'),
            t('mcpGuide.ask3'),
            t('mcpGuide.ask4'),
            t('mcpGuide.ask5'),
          ].map((example) => (
            <p
              key={example}
              className="bg-muted/50 text-muted-foreground rounded-md px-3 py-2 text-sm italic"
            >
              {example}
            </p>
          ))}
        </CardContent>
      </Card>

      <SectionHeading
        title={t('mcpGuide.advancedTitle')}
        description={t('mcpGuide.advancedDesc')}
      />

      <ApiKeyManager />

      <Card>
        <CardHeader>
          <CardTitle>{t('mcpGuide.claudeDesktopTitle')}</CardTitle>
          <CardDescription>{t('mcpGuide.claudeDesktopDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <CopyableBlock value={claudeCommand} />
          <p className="text-muted-foreground text-sm">
            {t('mcpGuide.claudeDesktopNote')}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('mcpGuide.geminiTitle')}</CardTitle>
          <CardDescription>{t('mcpGuide.geminiDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-input flex gap-3 rounded-md border border-dashed p-3">
            <TriangleAlert className="text-muted-foreground h-4 w-4 shrink-0" />
            <p className="text-muted-foreground text-sm">
              {t('mcpGuide.geminiWarning')}
            </p>
          </div>
          <CopyableBlock value={geminiCommand} />
          <p className="text-muted-foreground text-sm">
            {t('mcpGuide.geminiCheck')}
          </p>
          <div className="space-y-2 pt-2">
            <p className="text-sm font-medium">
              {t('mcpGuide.geminiAltLabel')}
            </p>
            <p className="text-muted-foreground text-sm">
              {t('mcpGuide.geminiAltDesc')}
            </p>
            <CopyableBlock value={geminiConfig} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('mcpGuide.otherTitle')}</CardTitle>
          <CardDescription>{t('mcpGuide.otherDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
            <span className="w-40 shrink-0 font-medium">
              {t('mcpGuide.otherTransport')}
            </span>
            <span className="text-muted-foreground">
              {t('mcpGuide.otherTransportValue')}
            </span>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
            <span className="w-40 shrink-0 font-medium">
              {t('mcpGuide.otherAuth')}
            </span>
            <span className="text-muted-foreground">
              {t('mcpGuide.otherAuthValue')}
            </span>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
            <span className="w-40 shrink-0 font-medium">
              {t('mcpGuide.otherDiscovery')}
            </span>
            <code className="text-muted-foreground font-mono text-xs break-all">
              {discoveryUrl}
            </code>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('mcpGuide.toolsTitle')}</CardTitle>
          <CardDescription>
            {t('mcpGuide.toolsDesc', {
              count: READ_TOOLS.length + WRITE_TOOLS.length,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('mcpGuide.toolsRead')}</p>
            <div className="flex flex-wrap gap-1.5">
              {READ_TOOLS.map((tool) => (
                <code
                  key={tool}
                  className="bg-muted rounded px-2 py-1 font-mono text-xs"
                >
                  {tool}
                </code>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('mcpGuide.toolsWrite')}</p>
            <div className="flex flex-wrap gap-1.5">
              {WRITE_TOOLS.map((tool) => (
                <code
                  key={tool}
                  className="bg-muted rounded px-2 py-1 font-mono text-xs"
                >
                  {tool}
                </code>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('mcpGuide.securityTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            {t('mcpGuide.securityDesc')}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
