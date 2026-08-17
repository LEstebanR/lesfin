'use client'

import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'

import { TableHead } from './table'

export function SortableTableHead({
  children,
  active,
  direction,
  onSort,
  className,
}: {
  children: React.ReactNode
  active: boolean
  direction: 'asc' | 'desc'
  onSort: () => void
  className?: string
}) {
  return (
    <TableHead
      className={className}
      aria-sort={
        active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'
      }
    >
      <button
        type="button"
        className="group flex items-center gap-1 font-semibold"
        onClick={onSort}
      >
        {children}
        {active ? (
          direction === 'asc' ? (
            <ArrowUp className="text-primary h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="text-primary h-3.5 w-3.5" />
          )
        ) : (
          <ChevronsUpDown className="text-muted-foreground/50 group-hover:text-foreground h-3.5 w-3.5 transition-colors" />
        )}
      </button>
    </TableHead>
  )
}
