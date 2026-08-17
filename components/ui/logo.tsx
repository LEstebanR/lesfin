import { cn } from '@/lib/utils'
import { Wallet } from 'lucide-react'

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg">
        <Wallet className="h-4 w-4" />
      </span>
      <span className="flex items-center text-2xl font-black tracking-tighter">
        <span className="text-primary">LES</span>
        <span className="italic">Fin</span>
      </span>
    </div>
  )
}
