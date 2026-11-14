'use client'

import { editDebtPayment } from '@/app/dashboard/debts/actions'
import { useLanguage } from '@/components/language-provider'
import { useAccounts } from '@/lib/queries'
import { toLocalMidnight } from '@/lib/utils'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader, Pencil } from 'lucide-react'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '../ui/button'
import { CurrencyField } from '../ui/currency-field'
import { DatePicker } from '../ui/date-picker'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Form } from '../ui/form'
import { Label } from '../ui/label'
import { SelectItem } from '../ui/select'
import { SelectField } from '../ui/select-field'
import { Textarea } from '../ui/textarea'
import { useDashboardRefresh } from './refresh-provider'

export interface EditableDebtPayment {
  id: string
  accountId: string
  amount: number
  date: Date
  note: string | null
}

export function EditDebtPaymentButton({
  payment,
}: {
  payment: EditableDebtPayment
}) {
  const { t } = useLanguage()
  const { triggerRefresh } = useDashboardRefresh()
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { data: rawAccounts = [], isLoading: loadingAccounts } = useAccounts()
  // The payment's current account stays selectable even if it has since
  // been archived or locked, so re-saving doesn't force a change.
  const availableAccounts = rawAccounts.filter(
    (account) =>
      account.id === payment.accountId ||
      (!account.isArchived && !account.lockedByPlan)
  )
  const formRef = useRef<HTMLFormElement>(null)

  const schema = z.object({
    accountId: z.string().min(1, t('debts.fromAccountRequired')),
    amount: z.string().min(1, t('debts.amountRequired')),
  })
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      accountId: payment.accountId,
      amount: String(payment.amount),
    },
  })

  const openDialog = () => {
    form.reset({
      accountId: payment.accountId,
      amount: String(payment.amount),
    })
    setIsOpen(true)
  }

  const onSubmit = form.handleSubmit(async () => {
    const formData = new FormData(formRef.current!)
    setIsSubmitting(true)

    try {
      await editDebtPayment(payment.id, formData)
      toast.success(t('debts.paymentUpdated'))
      triggerRefresh()
      setIsOpen(false)
    } catch (error) {
      console.error('Error updating debt payment:', error)
      toast.error(t('debts.saveFailed'))
    }

    setIsSubmitting(false)
  })

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        aria-label={t('debts.editPayment')}
        onClick={openDialog}
      >
        <Pencil className="h-4 w-4" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('debts.editPayment')}</DialogTitle>
          </DialogHeader>
          <DialogDescription>{t('debts.editPaymentDesc')}</DialogDescription>
          <Form {...form}>
            <form
              ref={formRef}
              className="flex flex-col gap-4"
              onSubmit={onSubmit}
              noValidate
            >
              <SelectField
                name="accountId"
                label={t('debts.fromAccount')}
                placeholder={
                  loadingAccounts
                    ? t('transactions.loadingAccounts')
                    : t('transactions.selectAnAccount')
                }
              >
                {availableAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} ({account.type})
                  </SelectItem>
                ))}
              </SelectField>
              <CurrencyField
                name="amount"
                label={t('debts.paymentAmount')}
                defaultValue={String(payment.amount)}
              />
              <div className="flex flex-col gap-1">
                <Label>{t('transactions.date')}</Label>
                <DatePicker
                  name="date"
                  defaultValue={toLocalMidnight(payment.date)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label>{t('debts.note')}</Label>
                <Textarea
                  name="note"
                  className="resize-none"
                  defaultValue={payment.note ?? ''}
                />
              </div>
              <Button className="w-full" type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    {t('debts.savingPayment')}
                  </>
                ) : (
                  t('debts.saveChanges')
                )}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
