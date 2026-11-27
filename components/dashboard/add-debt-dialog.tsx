'use client'

import { createDebt } from '@/app/dashboard/debts/actions'
import { useLanguage } from '@/components/language-provider'
import { isPlanLimitError } from '@/lib/plan-limits-shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader, PlusIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '../ui/button'
import { CurrencyField } from '../ui/currency-field'
import { CurrencyInput } from '../ui/currency-input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog'
import { Form } from '../ui/form'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { TextField } from '../ui/text-field'
import { InterestTermsFields } from './interest-terms-fields'
import { useDashboardRefresh } from './refresh-provider'

export function AddDebtDialog({
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: {
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const { t } = useLanguage()
  const { triggerRefresh } = useDashboardRefresh()
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = controlledOpen ?? internalOpen
  const setIsOpen = setControlledOpen ?? setInternalOpen
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [debtType, setDebtType] = useState('loan')
  const formRef = useRef<HTMLFormElement>(null)

  const schema = z.object({
    name: z.string().trim().min(1, t('debts.nameRequired')),
    originalAmount: z.string().min(1, t('debts.originalAmountRequired')),
  })
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', originalAmount: '' },
  })

  const onSubmit = form.handleSubmit(async () => {
    setIsSubmitting(true)
    const formData = new FormData(formRef.current!)

    try {
      await createDebt(formData)
      toast.success(t('debts.debtCreated'))
      triggerRefresh()
      form.reset({ name: '', originalAmount: '' })
      setDebtType('loan')
      setIsOpen(false)
    } catch (error) {
      console.error('Error creating debt:', error)
      toast.error(
        isPlanLimitError(error)
          ? t('debts.debtLimitReached')
          : t('debts.saveFailed')
      )
    }

    setIsSubmitting(false)
  })

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('debts.addDebt')}</DialogTitle>
        </DialogHeader>
        <DialogDescription>{t('debts.dialogDescription')}</DialogDescription>
        <Form {...form}>
          <form
            ref={formRef}
            className="flex flex-col gap-4"
            onSubmit={onSubmit}
            noValidate
          >
            <TextField name="name" label={t('debts.name')} type="text" />
            <div className="flex flex-col gap-1">
              <Label>{t('debts.type')}</Label>
              <Select
                name="type"
                defaultValue="loan"
                onValueChange={setDebtType}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="loan">{t('debts.loan')}</SelectItem>
                  <SelectItem value="credit_card">
                    {t('debts.creditCard')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <CurrencyField
              name="originalAmount"
              label={t('debts.originalAmount')}
            />
            {debtType === 'credit_card' && (
              <div className="flex flex-col gap-1">
                <Label>{t('debts.creditLimit')}</Label>
                <CurrencyInput name="creditLimit" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <Label>{t('debts.minimumPayment')}</Label>
                <CurrencyInput name="minimumPayment" />
              </div>
              <div className="flex flex-col gap-1">
                <Label>{t('debts.paymentDueDay')}</Label>
                <Input
                  type="number"
                  name="paymentDueDay"
                  min={1}
                  max={31}
                  placeholder={t('debts.dayOfMonth')}
                />
              </div>
            </div>
            <InterestTermsFields />
            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                  {t('debts.creatingDebt')}
                </>
              ) : (
                <>
                  <PlusIcon className="h-4 w-4" />
                  {t('debts.addDebt')}
                </>
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
