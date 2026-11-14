'use client'

import { deleteDebtPayment } from '@/app/dashboard/debts/actions'
import { useLanguage } from '@/components/language-provider'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'
import { Button } from '../ui/button'
import { useDashboardRefresh } from './refresh-provider'

export function DeleteDebtPaymentButton({ paymentId }: { paymentId: string }) {
  const { t } = useLanguage()
  const { triggerRefresh } = useDashboardRefresh()
  const [isOpen, setIsOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteDebtPayment(paymentId)
      triggerRefresh()
      toast.success(t('debts.paymentDeleted'))
      setIsOpen(false)
    } catch (error) {
      console.error('Error deleting debt payment:', error)
      toast.error(t('debts.paymentDeleteFailed'))
    }
    setIsDeleting(false)
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="text-destructive hover:text-destructive h-8 w-8"
        aria-label={t('debts.deletePayment')}
        onClick={() => setIsOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('debts.deletePaymentConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('debts.deletePaymentConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('debts.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {t('debts.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
