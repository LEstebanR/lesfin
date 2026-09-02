'use client'

import {
  getAvailableReportMonths,
  getAvailableSpendingYears,
  getMonthlyFinancialReport,
} from '@/app/dashboard/spending-trends/actions'
import { useCurrency } from '@/components/currency-provider'
import { useLanguage } from '@/components/language-provider'
import { formatMoney } from '@/lib/currency'
import { useCategoryMonthlyTotals } from '@/lib/queries'
import { Download, Table } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Loader } from '../ui/loader'

const MONTH_KEYS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
] as const

const EMPTY_ARRAY: never[] = []

export function SpendingTrends() {
  const currency = useCurrency()
  const { t } = useLanguage()
  const [year, setYear] = useState(new Date().getFullYear())
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [reportOpen, setReportOpen] = useState(false)
  const [availableMonths, setAvailableMonths] = useState<number[]>([])
  const [loadingMonths, setLoadingMonths] = useState(false)
  const [exporting, setExporting] = useState(false)
  const { data: rows = EMPTY_ARRAY, isLoading: loading } =
    useCategoryMonthlyTotals(year)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getAvailableSpendingYears().then((years) => {
      setAvailableYears(years)
      setYear((currentYear) =>
        years.length > 0 && !years.includes(currentYear)
          ? years[0]
          : currentYear
      )
    })
  }, [])

  const openReportDialog = async () => {
    setReportOpen(true)
    setLoadingMonths(true)
    try {
      const months = await getAvailableReportMonths(year)
      setAvailableMonths(months)
      setMonth((currentMonth) =>
        months.includes(currentMonth)
          ? currentMonth
          : (months[0] ?? currentMonth)
      )
    } finally {
      setLoadingMonths(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const report = await getMonthlyFinancialReport(year, month)
      const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `informe-financiero-${year}-${String(month).padStart(2, '0')}.md`
      link.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollRef.current
    if (!el || el.scrollWidth <= el.clientWidth) return
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
    el.scrollLeft += e.deltaY
    e.preventDefault()
  }

  const monthTotals = MONTH_KEYS.map((_, month) =>
    rows.reduce((sum, row) => sum + row.monthlyTotals[month], 0)
  )
  const grandTotal = monthTotals.reduce((sum, amount) => sum + amount, 0)

  return (
    <div className="flex w-full flex-col gap-6 rounded-md p-4 md:mt-4 md:w-11/12 md:p-8">
      <div className="flex w-full items-center justify-end">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={openReportDialog}>
            <Download className="h-4 w-4" />
            {t('spendingTrends.exportReport')}
          </Button>
          {availableYears.length > 0 ? (
            <select
              aria-label={t('spendingTrends.yearSelector')}
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            >
              {availableYears.map((availableYear) => (
                <option key={availableYear} value={availableYear}>
                  {availableYear}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-muted-foreground text-sm">{year}</span>
          )}
        </div>
      </div>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('spendingTrends.reportMonth')}</DialogTitle>
            <DialogDescription>
              {t('spendingTrends.reportMonthDescription', { year })}
            </DialogDescription>
          </DialogHeader>
          {loadingMonths ? (
            <Loader className="m-auto" />
          ) : availableMonths.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t('spendingTrends.noReportMonths')}
            </p>
          ) : (
            <select
              aria-label={t('spendingTrends.reportMonth')}
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
            >
              {availableMonths.map((availableMonth) => (
                <option key={availableMonth} value={availableMonth}>
                  {t(`budgets.months.${MONTH_KEYS[availableMonth - 1]}`)}
                </option>
              ))}
            </select>
          )}
          <DialogFooter>
            <Button
              onClick={handleExport}
              disabled={
                loadingMonths || exporting || availableMonths.length === 0
              }
            >
              <Download className="h-4 w-4" />
              {exporting
                ? t('spendingTrends.exporting')
                : t('spendingTrends.downloadReport')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? (
        <Loader className="m-auto" />
      ) : rows.length === 0 ? (
        <div className="bg-card text-card-foreground border-border shadow-soft flex flex-col items-center justify-center rounded-2xl border py-10 text-center">
          <Table className="text-muted-foreground/40 mb-3 h-12 w-12" />
          <p className="text-muted-foreground text-sm">
            {t('spendingTrends.noData')}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto" ref={scrollRef} onWheel={handleWheel}>
          <table className="w-full min-w-[1400px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="bg-background sticky left-0 border-b px-4 py-2 text-left font-medium">
                  {t('transactions.category')}
                </th>
                {MONTH_KEYS.map((key) => (
                  <th
                    key={key}
                    className="border-b px-4 py-2 text-right font-medium"
                  >
                    {t(`budgets.months.${key}`).slice(0, 3)}
                  </th>
                ))}
                <th className="border-b px-4 py-2 text-right font-medium">
                  {t('spendingTrends.total')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const rowTotal = row.monthlyTotals.reduce((a, b) => a + b, 0)
                return (
                  <tr key={row.categoryId}>
                    <td className="bg-background sticky left-0 border-b px-4 py-2 font-medium">
                      {row.categoryName}
                    </td>
                    {row.monthlyTotals.map((amount, i) => (
                      <td
                        key={i}
                        className="text-muted-foreground border-b px-4 py-2 text-right"
                      >
                        {amount > 0 ? `$${formatMoney(amount, currency)}` : '—'}
                      </td>
                    ))}
                    <td className="border-b px-4 py-2 text-right font-semibold">
                      ${formatMoney(rowTotal, currency)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="bg-background sticky left-0 border-t-2 px-4 py-2 font-semibold">
                  {t('spendingTrends.total')}
                </td>
                {monthTotals.map((amount, i) => (
                  <td
                    key={i}
                    className="border-t-2 px-4 py-2 text-right font-semibold"
                  >
                    ${formatMoney(amount, currency)}
                  </td>
                ))}
                <td className="border-t-2 px-4 py-2 text-right font-bold">
                  ${formatMoney(grandTotal, currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
