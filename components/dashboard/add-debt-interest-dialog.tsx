'use client'

import {
  createDebtInterestCharge,
  editDebtInterestCharge,
} from '@/app/dashboard/debts/actions'
import { useCurrency } from '@/components/currency-provider'
import { useLanguage } from '@/components/language-provider'
import { formatMoney, parseCurrencyInput } from '@/lib/currency'
import {
  INTEREST_SOURCES,
  type InterestSource,
  interestPeriod,
} from '@/lib/debt-interest'
import { toLocalMidnight } from '@/lib/utils'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader } from 'lucide-react'
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
  DialogTrigger,
} from '../ui/dialog'
import { Form } from '../ui/form'
import { Label } from '../ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { Textarea } from '../ui/textarea'
import { useDashboardRefresh } from './refresh-provider'

interface Debt {
  id: string
  name: string
  suggestedInterest?: number | null
}

interface InterestCharge {
  id: string
  amount: number
  date: Date
  period: string
  source: string
  note: string | null
}

// Records a new interest charge, or edits `charge` when given. takenPeriods
// ('YYYY-MM') lets the form flag a month that already has a charge before
// reaching the server, which rejects it anyway.
export function AddDebtInterestDialog({
  debt,
  charge,
  takenPeriods = [],
  trigger,
}: {
  debt: Debt
  charge?: InterestCharge
  takenPeriods?: string[]
  trigger: React.ReactNode
}) {
  const currency = useCurrency()
  const { t } = useLanguage()
  const { triggerRefresh } = useDashboardRefresh()
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [date, setDate] = useState<Date | undefined>(
    charge ? toLocalMidnight(charge.date) : new Date()
  )
  const [formKey, setFormKey] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)
  const isEdit = !!charge

  const initialAmount = charge ? String(charge.amount) : ''
  const schema = z.object({
    amount: z.string().min(1, t('debts.amountRequired')),
  })
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { amount: initialAmount },
  })

  // Local calendar day → the same 'YYYY-MM' the server derives from the
  // submitted yyyy-MM-dd (stored as midnight UTC).
  const selectedPeriod = date
    ? interestPeriod(
        new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
      )
    : null
  const periodTaken =
    !!selectedPeriod &&
    selectedPeriod !== charge?.period &&
    takenPeriods.includes(selectedPeriod)

  const suggestion =
    !isEdit && debt.suggestedInterest && debt.suggestedInterest > 0
      ? debt.suggestedInterest
      : null
  const [suggestedSource, setSuggestedSource] = useState<InterestSource | null>(
    null
  )

  const onOpenChange = (open: boolean) => {
    if (open) {
      form.reset({ amount: initialAmount })
      setDate(charge ? toLocalMidnight(charge.date) : new Date())
      setSuggestedSource(null)
      setFormKey((key) => key + 1)
    }
    setIsOpen(open)
  }

  const onSubmit = form.handleSubmit(async () => {
    if (periodTaken) return
    const formData = new FormData(formRef.current!)
    formData.set('debtId', debt.id)
    const amount = parseCurrencyInput(formData.get('amount'))

    setIsSubmitting(true)

    try {
      if (charge) {
        await editDebtInterestCharge(charge.id, formData)
        toast.success(t('debts.interestUpdated'))
      } else {
        await createDebtInterestCharge(formData)
        toast.success(t('debts.interestRecorded'), {
          description: `+$${formatMoney(amount, currency)} • ${debt.name}`,
        })
      }
      triggerRefresh()
      setIsOpen(false)
    } catch (error) {
      console.error('Error saving debt interest:', error)
      toast.error(t('debts.saveFailed'))
    }

    setIsSubmitting(false)
  })

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('debts.editInterest') : t('debts.addInterest')}
          </DialogTitle>
        </DialogHeader>
        <DialogDescription>
          {isEdit
            ? t('debts.editInterestDesc')
            : t('debts.addInterestDesc', { name: debt.name })}
        </DialogDescription>
        <Form {...form}>
          <form
            key={formKey}
            ref={formRef}
            className="flex flex-col gap-4"
            onSubmit={onSubmit}
            noValidate
          >
            <CurrencyField
              key={`amount-${formKey}-${suggestedSource ?? ''}`}
              name="amount"
              label={t('debts.interestAmount')}
              defaultValue={
                suggestedSource && suggestion
                  ? String(suggestion)
                  : initialAmount || undefined
              }
            />
            {suggestion && (
              <div className="text-muted-foreground -mt-2 flex items-center justify-between text-xs">
                <span>
                  {t('debts.suggestedInterest', {
                    amount: formatMoney(suggestion, currency),
                  })}
                </span>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => {
                    form.setValue('amount', String(suggestion))
                    setSuggestedSource('estimated')
                  }}
                >
                  {t('debts.useSuggestion')}
                </Button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <Label>{t('transactions.date')}</Label>
                <DatePicker name="date" value={date} onChange={setDate} />
              </div>
              <div className="flex flex-col gap-1">
                <Label>{t('debts.interestSource')}</Label>
                <Select
                  key={`source-${suggestedSource ?? ''}`}
                  name="source"
                  defaultValue={
                    suggestedSource ?? charge?.source ?? 'statement'
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTEREST_SOURCES.map((source) => (
                      <SelectItem key={source} value={source}>
                        {t(`debts.source_${source}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p
              className={
                periodTaken
                  ? 'text-destructive -mt-2 text-xs'
                  : 'text-muted-foreground -mt-2 text-xs'
              }
            >
              {periodTaken
                ? t('debts.interestPeriodTaken')
                : t('debts.interestPeriodHint')}
            </p>
            <div className="flex flex-col gap-1">
              <Label>{t('debts.note')}</Label>
              <Textarea
                name="note"
                className="resize-none"
                defaultValue={charge?.note ?? ''}
              />
            </div>
            <Button
              className="w-full"
              type="submit"
              disabled={isSubmitting || periodTaken}
            >
              {isSubmitting ? (
                <>
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                  {t('debts.recordingInterest')}
                </>
              ) : isEdit ? (
                t('debts.saveChanges')
              ) : (
                t('debts.addInterest')
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
