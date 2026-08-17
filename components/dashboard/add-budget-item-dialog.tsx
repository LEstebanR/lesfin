'use client'

import {
  cancelRecurringExpense,
  convertBudgetItemToRecurring,
  createBudgetItem,
  createRecurringExpense,
  updateBudgetItem,
} from '@/app/dashboard/budgets/actions'
import { useLanguage } from '@/components/language-provider'
import { toLocalMidnight } from '@/lib/utils'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader, PlusIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '../ui/button'
import { CategoryCombobox } from '../ui/category-combobox'
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
import { SelectItem } from '../ui/select'
import { SelectField } from '../ui/select-field'
import { SubcategoryCombobox } from '../ui/subcategory-combobox'
import { Switch } from '../ui/switch'
import { TextField } from '../ui/text-field'

export interface EditableBudgetItem {
  id: string
  categoryId: string
  subcategoryId: string | null
  date: Date
  amount: number
  description: string
  subscriptionId: string | null
  recurringExpenseId: string | null
  debtId: string | null
}

export function AddBudgetItemDialog({
  trigger,
  defaultDate,
  item,
  onSaved,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: {
  trigger?: React.ReactNode
  defaultDate?: Date
  item?: EditableBudgetItem | null
  onSaved: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const { t } = useLanguage()
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = controlledOpen ?? internalOpen
  const setIsOpen = setControlledOpen ?? setInternalOpen
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? '')
  const [isRecurring, setIsRecurring] = useState(false)
  const isEditing = !!item
  const canConvertToRecurring =
    isEditing &&
    !item.subscriptionId &&
    !item.recurringExpenseId &&
    !item.debtId
  const formRef = useRef<HTMLFormElement>(null)

  const schema = z
    .object({
      amount: z.string().min(1, t('budgets.amountRequired')),
      description: z.string().optional(),
      frequency: z.string().optional(),
      intervalWeeks: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      if (isRecurring && !data.description?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('budgets.nameRequired'),
          path: ['description'],
        })
      }
      if (isRecurring && data.frequency === 'custom' && !data.intervalWeeks) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('budgets.intervalWeeksRequired'),
          path: ['intervalWeeks'],
        })
      }
    })
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: item ? String(item.amount) : '',
      description: item?.description ?? '',
      frequency: 'monthly',
      intervalWeeks: '4',
    },
  })
  const frequency = form.watch('frequency')

  const onSubmit = form.handleSubmit(async () => {
    setIsSubmitting(true)
    const formData = new FormData(formRef.current!)

    try {
      if (item) {
        if (isRecurring) {
          await convertBudgetItemToRecurring(item.id, formData)
          toast.success(t('budgets.convertedToRecurring'))
        } else {
          await updateBudgetItem(item.id, formData)
          toast.success(t('budgets.itemUpdated'))
        }
      } else if (isRecurring) {
        await createRecurringExpense(formData)
        toast.success(t('budgets.recurringExpenseCreated'))
      } else {
        await createBudgetItem(formData)
        toast.success(t('budgets.itemCreated'))
      }
      onSaved()
      setIsOpen(false)
      setIsRecurring(false)
      form.reset({
        amount: '',
        description: '',
        frequency: 'monthly',
        intervalWeeks: '4',
      })
    } catch (error) {
      console.error('Error saving budget item:', error)
      toast.error(t('budgets.itemSaveFailed'))
    }

    setIsSubmitting(false)
  })

  const handleCancelRecurring = async () => {
    if (!item?.recurringExpenseId) return
    setIsCancelling(true)
    try {
      await cancelRecurringExpense(item.recurringExpenseId)
      toast.success(t('budgets.recurringCancelled'))
      onSaved()
      setIsOpen(false)
    } catch (error) {
      console.error('Error cancelling recurring expense:', error)
      toast.error(t('budgets.recurringCancelFailed'))
    }
    setIsCancelling(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen} modal={false}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('budgets.editItem') : t('budgets.addItem')}
          </DialogTitle>
        </DialogHeader>
        <DialogDescription>{t('budgets.addItemDesc')}</DialogDescription>
        <Form {...form}>
          <form
            ref={formRef}
            className="flex flex-col gap-4"
            onSubmit={onSubmit}
            noValidate
          >
            <div className="flex flex-col gap-1">
              <Label>{t('transactions.date')}</Label>
              <DatePicker
                name="date"
                defaultValue={item ? toLocalMidnight(item.date) : defaultDate}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t('transactions.category')}</Label>
              <CategoryCombobox
                name="categoryId"
                type="expense"
                defaultValue={item?.categoryId}
                onChange={setCategoryId}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t('transactions.subcategory')}</Label>
              <SubcategoryCombobox
                name="subcategoryId"
                categoryId={categoryId}
                defaultValue={item?.subcategoryId ?? undefined}
              />
            </div>
            <CurrencyField name="amount" label={t('debts.paymentAmount')} />
            <TextField
              name="description"
              label={
                isRecurring ? t('debts.name') : t('budgets.descriptionOptional')
              }
              type="text"
            />
            {(!isEditing || canConvertToRecurring) && (
              <div className="bg-muted/50 flex flex-col gap-3 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="isRecurring" className="font-normal">
                    {isEditing
                      ? t('budgets.convertToRecurring')
                      : t('budgets.isRecurring')}
                  </Label>
                  <Switch
                    id="isRecurring"
                    checked={isRecurring}
                    onCheckedChange={setIsRecurring}
                  />
                </div>
                {isRecurring && (
                  <>
                    <SelectField
                      name="frequency"
                      label={t('subscriptions.frequency')}
                    >
                      <SelectItem value="monthly">
                        {t('subscriptions.monthly')}
                      </SelectItem>
                      <SelectItem value="weekly">
                        {t('subscriptions.weekly')}
                      </SelectItem>
                      <SelectItem value="custom">
                        {t('budgets.everyNWeeks')}
                      </SelectItem>
                    </SelectField>
                    {frequency === 'custom' && (
                      <TextField
                        name="intervalWeeks"
                        label={t('budgets.intervalWeeksLabel')}
                        type="number"
                        min={2}
                        max={52}
                      />
                    )}
                    <p className="text-muted-foreground text-xs">
                      {t('budgets.recurringNote')}
                    </p>
                  </>
                )}
              </div>
            )}
            {isEditing && item.recurringExpenseId && (
              <div className="bg-muted/50 flex flex-col gap-2 rounded-lg p-3">
                <p className="text-muted-foreground text-xs">
                  {t('budgets.thisItemIsRecurring')}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isCancelling}
                  onClick={handleCancelRecurring}
                >
                  {isCancelling ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : (
                    t('budgets.cancelRecurring')
                  )}
                </Button>
              </div>
            )}
            {isEditing && item.debtId && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-muted-foreground text-xs">
                  {t('budgets.thisItemIsFromDebt', { name: item.description })}
                </p>
              </div>
            )}
            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing
                    ? t('budgets.savingChanges')
                    : t('budgets.creatingItem')}
                </>
              ) : isEditing ? (
                t('budgets.saveChanges')
              ) : (
                <>
                  <PlusIcon className="h-4 w-4" />
                  {t('budgets.addItem')}
                </>
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
