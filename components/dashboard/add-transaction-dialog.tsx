'use client'

import {
  createTransaction,
  createTransfer,
} from '@/app/dashboard/transactions/actions'
import { useCurrency } from '@/components/currency-provider'
import { useLanguage } from '@/components/language-provider'
import { formatMoney, parseCurrencyInput } from '@/lib/currency'
import { isPlanLimitError } from '@/lib/plan-limits-shared'
import { useAccounts, useDebts } from '@/lib/queries'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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
import { SelectGroup, SelectItem, SelectLabel } from '../ui/select'
import { SelectField } from '../ui/select-field'
import { SubcategoryCombobox } from '../ui/subcategory-combobox'
import { Textarea } from '../ui/textarea'
import {
  DebtCategoryNotice,
  useDebtCategoryBlocked,
} from './debt-category-notice'
import { useDashboardRefresh } from './refresh-provider'

export function AddTransactionDialog({
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: {
  trigger?: React.ReactNode
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
  const { data: rawAccounts = [], isLoading: loadingAccounts } = useAccounts()
  const { data: rawDebts = [] } = useDebts()
  const availableAccounts = rawAccounts.filter(
    (account) => !account.isArchived && !account.lockedByPlan
  )
  const availableDebts = rawDebts.filter(
    (debt) => debt.type === 'credit_card' && !debt.lockedByPlan
  )
  const [categoryId, setCategoryId] = useState('')
  const [sourceType, setSourceType] = useState<'account' | 'debt'>('account')
  const [sourceId, setSourceId] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  const schema = z
    .object({
      type: z.string().min(1, t('transactions.typeRequired')),
      amount: z.string().min(1, t('transactions.amountRequired')),
      fromAccountId: z.string().optional(),
      toAccountId: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.type === 'transfer') {
        if (!data.fromAccountId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t('transactions.fromAccountRequired'),
            path: ['fromAccountId'],
          })
        }
        if (!data.toAccountId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t('transactions.toAccountRequired'),
            path: ['toAccountId'],
          })
        }
      }
    })
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: '',
      amount: '',
      fromAccountId: '',
      toAccountId: '',
    },
  })
  const transactionType = form.watch('type')
  const debtCategoryBlocked = useDebtCategoryBlocked(
    transactionType === 'expense' ? categoryId : ''
  )

  useEffect(() => {
    if (!isOpen) {
      setCategoryId('')
      setSourceType('account')
      setSourceId('')
      form.reset({ type: '', amount: '', fromAccountId: '', toAccountId: '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const onSubmit = form.handleSubmit(async (data) => {
    const formData = new FormData(formRef.current!)

    if (data.type !== 'transfer' && !formData.get('categoryId')) {
      toast.error(t('transactions.categoryRequired'))
      return
    }
    if (
      data.type !== 'transfer' &&
      !formData.get('accountId') &&
      !formData.get('debtId')
    ) {
      toast.error(t('transactions.sourceRequired'))
      return
    }

    setIsSubmitting(true)

    try {
      if (data.type === 'transfer') {
        const fromAccountId = formData.get('fromAccountId') as string
        const toAccountId = formData.get('toAccountId') as string
        const amount = parseCurrencyInput(formData.get('amount'))

        await createTransfer(formData)

        const fromAccount = availableAccounts.find(
          (a) => a.id === fromAccountId
        )
        const toAccount = availableAccounts.find((a) => a.id === toAccountId)

        toast.success(t('transactions.transferCompleted'), {
          description: t('transactions.transferCompletedDesc', {
            amount: formatMoney(amount, currency),
            from: fromAccount?.name || t('transactions.account'),
            to: toAccount?.name || t('transactions.account'),
          }),
        })
      } else {
        const amount = parseCurrencyInput(formData.get('amount'))

        await createTransaction(formData)

        const source =
          sourceType === 'account'
            ? availableAccounts.find((a) => a.id === sourceId)
            : availableDebts.find((d) => d.id === sourceId)
        const typeLabel =
          data.type === 'income'
            ? t('transactions.income')
            : t('transactions.expense')

        toast.success(
          t('transactions.transactionCreated', { type: typeLabel }),
          {
            description: `${data.type === 'income' ? '+' : '-'}$${formatMoney(amount, currency)} • ${source?.name || t('transactions.account')}`,
          }
        )
      }

      triggerRefresh()
      setIsOpen(false)
    } catch (error) {
      console.error('Error creating transaction/transfer:', error)
      toast.error(
        isPlanLimitError(error)
          ? t('transactions.transactionLimitReached')
          : t('transactions.saveFailed')
      )
    }

    setIsSubmitting(false)
  })

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen} modal={false}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('transactions.addTransaction')}</DialogTitle>
        </DialogHeader>
        <DialogDescription>{t('accounts.description')}</DialogDescription>
        <Form {...form}>
          <form
            ref={formRef}
            className="flex flex-col gap-4"
            onSubmit={onSubmit}
            noValidate
          >
            <SelectField
              name="type"
              label={t('transactions.transactionType')}
              placeholder={t('transactions.selectTransactionType')}
              onValueChange={() => {
                setCategoryId('')
                setSourceType('account')
                setSourceId('')
              }}
            >
              <SelectItem value="income">{t('transactions.income')}</SelectItem>
              <SelectItem value="expense">
                {t('transactions.expense')}
              </SelectItem>
              <SelectItem value="transfer">
                {t('transactions.transfer')}
              </SelectItem>
            </SelectField>

            {transactionType === 'transfer' ? (
              <>
                <SelectField
                  name="fromAccountId"
                  label={t('transactions.fromAccount')}
                  placeholder={
                    loadingAccounts
                      ? t('transactions.loadingAccounts')
                      : t('transactions.selectSourceAccount')
                  }
                >
                  {availableAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} ({account.type})
                    </SelectItem>
                  ))}
                </SelectField>
                <SelectField
                  name="toAccountId"
                  label={t('transactions.toAccount')}
                  placeholder={
                    loadingAccounts
                      ? t('transactions.loadingAccounts')
                      : t('transactions.selectDestinationAccount')
                  }
                >
                  {availableAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} ({account.type})
                    </SelectItem>
                  ))}
                </SelectField>
              </>
            ) : (
              transactionType && (
                <div className="flex flex-col gap-1">
                  <Label>{t('transactions.account')}</Label>
                  <SelectField
                    name="sourceKey"
                    placeholder={
                      loadingAccounts
                        ? t('transactions.loadingAccounts')
                        : t('transactions.selectAnAccount')
                    }
                    onValueChange={(value) => {
                      const [type, id] = value.split(':')
                      setSourceType(type as 'account' | 'debt')
                      setSourceId(id)
                    }}
                  >
                    <SelectGroup>
                      <SelectLabel>{t('transactions.accounts')}</SelectLabel>
                      {availableAccounts.map((account) => (
                        <SelectItem
                          key={account.id}
                          value={`account:${account.id}`}
                        >
                          {account.name} ({account.type})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    {transactionType === 'expense' &&
                      availableDebts.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>
                            {t('transactions.creditCards')}
                          </SelectLabel>
                          {availableDebts.map((debt) => (
                            <SelectItem key={debt.id} value={`debt:${debt.id}`}>
                              {debt.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                  </SelectField>
                  <input
                    type="hidden"
                    name="accountId"
                    value={sourceType === 'account' ? sourceId : ''}
                  />
                  <input
                    type="hidden"
                    name="debtId"
                    value={sourceType === 'debt' ? sourceId : ''}
                  />
                </div>
              )
            )}
            <CurrencyField name="amount" label={t('transactions.amount')} />
            <div className="flex flex-col gap-1">
              <Label>{t('transactions.date')}</Label>
              <DatePicker name="date" />
            </div>
            {(transactionType === 'income' ||
              transactionType === 'expense') && (
              <>
                <div className="flex flex-col gap-1">
                  <Label>{t('transactions.category')}</Label>
                  <CategoryCombobox
                    name="categoryId"
                    type={transactionType}
                    onChange={setCategoryId}
                  />
                </div>
                {debtCategoryBlocked && <DebtCategoryNotice />}
                <div className="flex flex-col gap-1">
                  <Label>{t('transactions.subcategory')}</Label>
                  <SubcategoryCombobox
                    name="subcategoryId"
                    categoryId={categoryId}
                  />
                </div>
              </>
            )}
            <div className="flex flex-col gap-1">
              <Label>{t('transactions.description')}</Label>
              <Textarea name="description" className="resize-none" />
            </div>
            <Button
              className="w-full"
              type="submit"
              disabled={isSubmitting || debtCategoryBlocked}
            >
              {isSubmitting ? (
                <>
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                  {t('transactions.creatingTransaction')}
                </>
              ) : (
                t('transactions.addTransaction')
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
