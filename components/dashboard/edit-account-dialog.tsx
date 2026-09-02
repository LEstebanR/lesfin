'use client'

import { updateAccount } from '@/app/dashboard/accounts/actions'
import { useLanguage } from '@/components/language-provider'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Form } from '../ui/form'
import { Label } from '../ui/label'
import { SelectItem } from '../ui/select'
import { SelectField } from '../ui/select-field'
import { TextField } from '../ui/text-field'
import { Textarea } from '../ui/textarea'
import { AccountAppearancePicker } from './account-appearance-picker'
import { useDashboardRefresh } from './refresh-provider'

interface Account {
  id: string
  name: string
  type: string
  description?: string | null
  color?: string | null
  logoUrl?: string | null
  icon?: string | null
}

export function EditAccountDialog({
  account,
  open,
  onOpenChange,
}: {
  account: Account | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useLanguage()
  const { triggerRefresh } = useDashboardRefresh()
  const [description, setDescription] = useState(account?.description ?? '')
  const [color, setColor] = useState<string | null>(account?.color ?? null)
  const [logoUrl, setLogoUrl] = useState<string | null>(
    account?.logoUrl ?? null
  )
  const [icon, setIcon] = useState<string | null>(account?.icon ?? null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const schema = z.object({
    name: z.string().trim().min(1, t('accounts.accountNameRequired')),
    type: z.string().min(1, t('accounts.accountTypeRequired')),
  })
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: account?.name ?? '', type: account?.type ?? '' },
  })

  // This dialog has no DialogTrigger — the parent opens it by flipping the
  // controlled `open` prop directly, which Radix's onOpenChange never fires
  // for (only its own internal close/open does). Sync fields off the
  // account prop itself instead, whenever a different account comes in.
  useEffect(() => {
    if (!account) return
    form.reset({ name: account.name, type: account.type })
    setDescription(account.description ?? '')
    setColor(account.color ?? null)
    setLogoUrl(account.logoUrl ?? null)
    setIcon(account.icon ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id])

  const onSubmit = form.handleSubmit(async (data) => {
    if (!account) return
    setIsSubmitting(true)

    try {
      await updateAccount(account.id, {
        name: data.name,
        type: data.type,
        description: description || null,
        color,
        logoUrl,
        icon,
      })
      toast.success(t('accounts.typeUpdated'))
      triggerRefresh()
      onOpenChange(false)
    } catch (error) {
      console.error('Error updating account:', error)
      toast.error(t('accounts.typeUpdateFailed'))
    }

    setIsSubmitting(false)
  })

  if (!account) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('accounts.changeType', { name: account.name })}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
            <TextField
              name="name"
              label={t('accounts.accountName')}
              type="text"
            />
            <SelectField
              name="type"
              label={t('accounts.accountType')}
              placeholder={t('accounts.selectAccountType')}
            >
              <SelectItem value="cash">{t('accounts.cash')}</SelectItem>
              <SelectItem value="savings">{t('accounts.savings')}</SelectItem>
              <SelectItem value="caja">{t('accounts.caja')}</SelectItem>
            </SelectField>
            <div className="flex flex-col gap-1">
              <Label>{t('accounts.description')}</Label>
              <Textarea
                className="resize-none"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <AccountAppearancePicker
              color={color}
              onColorChange={setColor}
              logoUrl={logoUrl}
              onLogoChange={setLogoUrl}
              icon={icon}
              onIconChange={setIcon}
            />
            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                t('accounts.saveChanges')
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
