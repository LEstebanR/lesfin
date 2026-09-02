'use client'

import { createAccount } from '@/app/dashboard/accounts/actions'
import { useCurrency } from '@/components/currency-provider'
import { useLanguage } from '@/components/language-provider'
import { formatMoney } from '@/lib/currency'
import { isPlanLimitError } from '@/lib/plan-limits-shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader } from 'lucide-react'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '../ui/button'
import { CurrencyField } from '../ui/currency-field'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog'
import { Form } from '../ui/form'
import { Label } from '../ui/label'
import { SelectItem } from '../ui/select'
import { SelectField } from '../ui/select-field'
import { TextField } from '../ui/text-field'
import { Textarea } from '../ui/textarea'
import { AccountAppearancePicker } from './account-appearance-picker'
import { useDashboardRefresh } from './refresh-provider'

export function AddAccountDialog({
  trigger,
  defaultType,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: {
  trigger?: React.ReactNode
  defaultType?: 'cash' | 'savings' | 'caja'
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const currency = useCurrency()
  const { t } = useLanguage()
  const { triggerRefresh } = useDashboardRefresh()
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = controlledOpen ?? internalOpen
  const setIsOpen = setControlledOpen ?? setInternalOpen
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [color, setColor] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [icon, setIcon] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const schema = z.object({
    accountName: z.string().trim().min(1, t('accounts.accountNameRequired')),
    accountType: z.string().min(1, t('accounts.accountTypeRequired')),
    initialBalance: z.string().min(1, t('accounts.initialBalanceRequired')),
  })
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      accountName: '',
      accountType: defaultType ?? 'savings',
      initialBalance: '0',
    },
  })
  const resetAppearance = () => {
    form.reset({
      accountName: '',
      accountType: defaultType ?? 'savings',
      initialBalance: '0',
    })
    setColor(null)
    setLogoUrl(null)
    setIcon(null)
  }

  const onSubmit = form.handleSubmit(async () => {
    setIsSubmitting(true)
    const formData = new FormData(formRef.current!)

    try {
      const account = await createAccount(formData)
      toast.success(t('accounts.accountCreated', { name: account.name }), {
        description: t('accounts.accountCreatedDesc', {
          amount: formatMoney(account.currentBalance, currency),
        }),
      })
      triggerRefresh()
      resetAppearance()
      setIsOpen(false)
    } catch (error) {
      console.error('Insert error:', error)
      toast.error(
        isPlanLimitError(error)
          ? t('accounts.accountLimitReached')
          : t('accounts.accountCreateFailed')
      )
    }

    setIsSubmitting(false)
  })

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('accounts.addAccount')}</DialogTitle>
        </DialogHeader>
        <DialogDescription>{t('accounts.dialogDescription')}</DialogDescription>
        <Form {...form}>
          <form
            ref={formRef}
            className="flex flex-col gap-4"
            onSubmit={onSubmit}
            noValidate
          >
            <TextField
              name="accountName"
              label={t('accounts.accountName')}
              type="text"
            />
            <SelectField
              name="accountType"
              label={t('accounts.accountType')}
              placeholder={t('accounts.selectAccountType')}
            >
              <SelectItem value="cash">{t('accounts.cash')}</SelectItem>
              <SelectItem value="savings">{t('accounts.savings')}</SelectItem>
              <SelectItem value="caja">{t('accounts.caja')}</SelectItem>
            </SelectField>
            <CurrencyField
              name="initialBalance"
              label={t('accounts.initialBalance')}
            />
            <div className="flex flex-col gap-1">
              <Label>{t('accounts.description')}</Label>
              <Textarea name="description" className="resize-none" />
            </div>
            <AccountAppearancePicker
              color={color}
              onColorChange={setColor}
              logoUrl={logoUrl}
              onLogoChange={setLogoUrl}
              icon={icon}
              onIconChange={setIcon}
            />
            <input type="hidden" name="color" value={color ?? ''} />
            <input type="hidden" name="logoUrl" value={logoUrl ?? ''} />
            <input type="hidden" name="icon" value={icon ?? ''} />
            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                  {t('accounts.creatingAccount')}
                </>
              ) : (
                t('accounts.addAccount')
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
