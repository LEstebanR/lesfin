'use client'

import { useLanguage } from '@/components/language-provider'
import { INTEREST_RATE_TYPES, type InterestRateType } from '@/lib/debt-interest'

import { Input } from '../ui/input'
import { Label } from '../ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'

// Uncontrolled fields read through FormData by createDebt/updateDebt: the rate
// goes as a percentage ("24,5") and the server turns it into a fraction.
export function InterestTermsFields({
  interestRate,
  interestRateType,
}: {
  interestRate?: number | null
  interestRateType?: InterestRateType | null
}) {
  const { t } = useLanguage()
  const defaultPercent =
    interestRate != null ? String(Math.round(interestRate * 1e6) / 1e4) : ''

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="interestRate">{t('debts.interestRate')}</Label>
          <Input
            id="interestRate"
            name="interestRate"
            type="text"
            inputMode="decimal"
            placeholder="24,5"
            defaultValue={defaultPercent}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label>{t('debts.interestRateType')}</Label>
          <Select
            name="interestRateType"
            defaultValue={interestRateType ?? 'effective_annual'}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTEREST_RATE_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(`debts.rateType_${type}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        {t('debts.interestRateHint')}
      </p>
    </div>
  )
}
