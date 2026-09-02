'use client'

import { uploadAccountLogo } from '@/app/dashboard/accounts/actions'
import { useLanguage } from '@/components/language-provider'
import { ACCOUNT_ICONS } from '@/lib/account-icons'
import { ACCOUNT_COLOR_PALETTE } from '@/lib/bank-logos'
import { cn } from '@/lib/utils'
import { Loader, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '../ui/button'
import { Label } from '../ui/label'

const MAX_LOGO_SIZE = 1024 * 1024
const MAX_LOGO_DIMENSION = 1200

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not read image'))
    }
    image.src = objectUrl
  })
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('Could not compress image')),
      'image/webp',
      quality
    )
  })
}

async function optimizeLogo(file: File) {
  const image = await loadImage(file)
  const scale = Math.min(
    1,
    MAX_LOGO_DIMENSION / image.naturalWidth,
    MAX_LOGO_DIMENSION / image.naturalHeight
  )
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not prepare image')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  for (const quality of [0.8, 0.65, 0.5]) {
    const blob = await canvasBlob(canvas, quality)
    if (blob.size <= MAX_LOGO_SIZE) {
      return new File([blob], 'account-logo.webp', { type: 'image/webp' })
    }
  }

  throw new Error('Image is too large')
}

export function AccountAppearancePicker({
  color,
  onColorChange,
  logoUrl,
  onLogoChange,
  icon,
  onIconChange,
}: {
  color: string | null
  onColorChange: (color: string | null) => void
  logoUrl: string | null
  onLogoChange: (logoUrl: string | null) => void
  icon: string | null
  onIconChange: (icon: string | null) => void
}) {
  const { t } = useLanguage()
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setIsUploading(true)
    try {
      const optimizedFile = await optimizeLogo(file)
      const uploadData = new FormData()
      uploadData.append('logo', optimizedFile)
      const url = await uploadAccountLogo(uploadData)
      onIconChange(null)
      onLogoChange(url)
    } catch (error) {
      console.error('Error uploading logo:', error)
      toast.error(
        error instanceof Error && error.message === 'Image is too large'
          ? t('accounts.logoTooLarge')
          : t('accounts.logoUploadFailed')
      )
    }
    setIsUploading(false)
  }

  const applyIcon = (name: string) => {
    onLogoChange(null)
    onIconChange(icon === name ? null : name)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label>{t('accounts.color')}</Label>
        <div className="flex flex-wrap gap-2">
          {ACCOUNT_COLOR_PALETTE.map((swatch) => (
            <button
              key={swatch}
              type="button"
              className={cn(
                'ring-offset-background h-7 w-7 rounded-full transition-all',
                color === swatch && 'ring-foreground ring-2 ring-offset-2'
              )}
              style={{ backgroundColor: swatch }}
              onClick={() => onColorChange(color === swatch ? null : swatch)}
              aria-label={swatch}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label>{t('accounts.logo')}</Label>
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'bg-muted flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border'
            )}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- external/dynamic logo domains, not worth remotePatterns config
              <img
                src={logoUrl}
                alt=""
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="text-muted-foreground text-xs">—</span>
            )}
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {t('accounts.uploadLogo')}
            </Button>
            {logoUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onLogoChange(null)}
              >
                <X className="h-4 w-4" />
                {t('accounts.removeLogo')}
              </Button>
            )}
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label>{t('accounts.icon')}</Label>
        <p className="text-muted-foreground text-xs">
          {t('accounts.iconDesc')}
        </p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(ACCOUNT_ICONS).map(([name, Icon]) => (
            <button
              key={name}
              type="button"
              className={cn(
                'border-border flex h-9 w-9 items-center justify-center rounded-lg border transition-colors',
                icon === name ? 'border-foreground bg-muted' : 'hover:bg-muted'
              )}
              onClick={() => applyIcon(name)}
              aria-label={name}
              aria-pressed={icon === name}
            >
              <Icon className="h-4 w-4" style={color ? { color } : undefined} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
