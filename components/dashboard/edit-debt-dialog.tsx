'use client'

import { deleteDebt, updateDebt } from '@/app/dashboard/debts/actions'
import { useLanguage } from '@/components/language-provider'
import { type InterestRateType } from '@/lib/debt-interest'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog'
import { Button } from '../ui/button'
import { CurrencyField } from '../ui/currency-field'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Form } from '../ui/form'
import { TextField } from '../ui/text-field'
import { InterestTermsFields } from './interest-terms-fields'
import { useDashboardRefresh } from './refresh-provider'

interface Debt {
  id: string
  name: string
  type: string
  minimumPayment: number | null
  paymentDueDay: number | null
  creditLimit: number | null
  interestRate: number | null
  interestRateType: InterestRateType | null
}

function toFormValues(debt: Debt | null) {
  return {
    name: debt?.name ?? '',
    minimumPayment:
      debt?.minimumPayment != null ? String(debt.minimumPayment) : '',
    paymentDueDay:
      debt?.paymentDueDay != null ? String(debt.paymentDueDay) : '',
    creditLimit: debt?.creditLimit != null ? String(debt.creditLimit) : '',
  }
}

export function EditDebtDialog({
  debt,
  open,
  onOpenChange,
}: {
  debt: Debt | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useLanguage()
  const { triggerRefresh } = useDashboardRefresh()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const schema = z.object({
    name: z.string().trim().min(1, t('debts.nameRequired')),
    minimumPayment: z.string().optional(),
    paymentDueDay: z.string().optional(),
    creditLimit: z.string().optional(),
  })
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(debt),
  })

  useEffect(() => {
    form.reset(toFormValues(debt))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debt])

  const onSubmit = form.handleSubmit(async () => {
    if (!debt) return
    setIsSubmitting(true)
    const formData = new FormData(formRef.current!)

    try {
      await updateDebt(debt.id, formData)
      toast.success(t('debts.updateSuccess'))
      triggerRefresh()
      onOpenChange(false)
    } catch (error) {
      console.error('Error updating debt:', error)
      toast.error(t('debts.updateFailed'))
    }

    setIsSubmitting(false)
  })

  const handleDelete = async () => {
    if (!debt) return
    try {
      await deleteDebt(debt.id)
      toast.success(t('debts.deleteSuccess'))
      triggerRefresh()
      onOpenChange(false)
    } catch (error) {
      console.error('Error deleting debt:', error)
      toast.error(t('debts.deleteFailed'))
    }
  }

  if (!debt) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('debts.editDebt')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            ref={formRef}
            className="flex flex-col gap-4"
            onSubmit={onSubmit}
            noValidate
          >
            <TextField name="name" label={t('debts.name')} type="text" />
            {debt.type === 'credit_card' && (
              <CurrencyField
                key={`creditLimit-${debt.id}`}
                name="creditLimit"
                label={t('debts.creditLimit')}
                defaultValue={
                  debt.creditLimit != null
                    ? String(debt.creditLimit)
                    : undefined
                }
              />
            )}
            <div className="grid grid-cols-2 gap-4">
              <CurrencyField
                key={`minimumPayment-${debt.id}`}
                name="minimumPayment"
                label={t('debts.minimumPayment')}
                defaultValue={
                  debt.minimumPayment != null
                    ? String(debt.minimumPayment)
                    : undefined
                }
              />
              <TextField
                name="paymentDueDay"
                label={t('debts.paymentDueDay')}
                type="number"
                min={1}
                max={31}
                placeholder={t('debts.dayOfMonth')}
              />
            </div>
            <InterestTermsFields
              key={`interest-${debt.id}-${debt.interestRate}-${debt.interestRateType}`}
              interestRate={debt.interestRate}
              interestRateType={debt.interestRateType}
            />
            <div className="flex gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" className="flex-1">
                    <Trash2 className="h-4 w-4" />
                    {t('debts.delete')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t('debts.deleteConfirmTitle')}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('debts.deleteConfirmDescription')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('debts.cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>
                      {t('debts.delete')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button className="flex-1" type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  t('debts.saveChanges')
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
