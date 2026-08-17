'use client'

import {
  createCategory,
  deleteCategory,
  deleteSubcategory,
  findOrCreateSubcategory,
  updateCategory,
  updateSubcategory,
} from '@/app/dashboard/categories/actions'
import { useLanguage } from '@/components/language-provider'
import { useCategories } from '@/lib/queries'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
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
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

interface Subcategory {
  id: string
  name: string
}

interface Category {
  id: string
  name: string
  subcategories: Subcategory[]
}

function InlineRename({
  value,
  onSave,
  onCancel,
}: {
  value: string
  onSave: (value: string) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(value)

  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault()
        if (draft.trim()) onSave(draft.trim())
      }}
    >
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="h-8"
      />
      <Button type="submit" size="icon" variant="ghost" className="h-8 w-8">
        <Check className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        onClick={onCancel}
      >
        <X className="h-4 w-4" />
      </Button>
    </form>
  )
}

function SubcategoryRow({
  subcategory,
  onChanged,
}: {
  subcategory: Subcategory
  onChanged: () => void
}) {
  const { t } = useLanguage()
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  const handleRename = async (name: string) => {
    try {
      await updateSubcategory(subcategory.id, name)
      onChanged()
    } catch (error) {
      console.error('Error renaming subcategory:', error)
      toast.error(t('settings.updateFailed'))
    }
    setIsEditing(false)
  }

  const handleDelete = async () => {
    try {
      await deleteSubcategory(subcategory.id)
      onChanged()
    } catch (error) {
      console.error('Error deleting subcategory:', error)
      toast.error(t('settings.deleteInUse'))
    }
    setIsDeleteOpen(false)
  }

  if (isEditing) {
    return (
      <InlineRename
        value={subcategory.name}
        onSave={handleRename}
        onCancel={() => setIsEditing(false)}
      />
    )
  }

  return (
    <Badge variant="secondary" className="gap-1 py-1 pr-1 pl-2.5">
      {subcategory.name}
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        aria-label={t('settings.rename')}
        className="hover:text-foreground text-muted-foreground ml-1"
      >
        <Pencil className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={() => setIsDeleteOpen(true)}
        aria-label={t('settings.delete')}
        className="hover:text-destructive text-muted-foreground"
      >
        <X className="h-3 w-3" />
      </button>
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('settings.deleteConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.deleteConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('settings.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              {t('settings.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Badge>
  )
}

function CategoryRow({
  category,
  onChanged,
}: {
  category: Category
  onChanged: () => void
}) {
  const { t } = useLanguage()
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isAddingSubcategory, setIsAddingSubcategory] = useState(false)
  const [newSubcategory, setNewSubcategory] = useState('')

  const handleRename = async (name: string) => {
    try {
      await updateCategory(category.id, name)
      onChanged()
    } catch (error) {
      console.error('Error renaming category:', error)
      toast.error(t('settings.updateFailed'))
    }
    setIsEditing(false)
  }

  const handleDelete = async () => {
    try {
      await deleteCategory(category.id)
      onChanged()
    } catch (error) {
      console.error('Error deleting category:', error)
      toast.error(t('settings.deleteInUse'))
    }
    setIsDeleteOpen(false)
  }

  const handleAddSubcategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSubcategory.trim()) return
    try {
      await findOrCreateSubcategory(category.id, newSubcategory.trim())
      setNewSubcategory('')
      setIsAddingSubcategory(false)
      onChanged()
    } catch (error) {
      console.error('Error adding subcategory:', error)
      toast.error(t('settings.updateFailed'))
    }
  }

  return (
    <div className="bg-muted/50 rounded-lg p-3">
      <div className="flex items-center justify-between gap-2">
        {isEditing ? (
          <InlineRename
            value={category.name}
            onSave={handleRename}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <>
            <p className="font-medium">{category.name}</p>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                aria-label={t('settings.rename')}
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="text-destructive hover:text-destructive h-8 w-8"
                aria-label={t('settings.delete')}
                onClick={() => setIsDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {category.subcategories.map((subcategory) => (
          <SubcategoryRow
            key={subcategory.id}
            subcategory={subcategory}
            onChanged={onChanged}
          />
        ))}
        {isAddingSubcategory ? (
          <form
            className="flex items-center gap-1"
            onSubmit={handleAddSubcategory}
          >
            <Input
              autoFocus
              value={newSubcategory}
              onChange={(e) => setNewSubcategory(e.target.value)}
              placeholder={t('settings.subcategoryName')}
              className="h-8 w-40"
            />
            <Button
              type="submit"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => {
                setIsAddingSubcategory(false)
                setNewSubcategory('')
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7"
            onClick={() => setIsAddingSubcategory(true)}
          >
            <Plus className="h-3 w-3" />
            {t('settings.addSubcategory')}
          </Button>
        )}
      </div>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('settings.deleteConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.deleteConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('settings.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              {t('settings.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export function CategoryManager({ type }: { type: 'income' | 'expense' }) {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const { data: categories = [], isLoading: loading } = useCategories(type)
  const [newCategory, setNewCategory] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['categories'] })

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCategory.trim()) return
    setIsSubmitting(true)
    try {
      await createCategory(newCategory.trim(), type)
      setNewCategory('')
      invalidate()
    } catch (error) {
      console.error('Error creating category:', error)
      toast.error(t('settings.updateFailed'))
    }
    setIsSubmitting(false)
  }

  if (loading) {
    return (
      <p className="text-muted-foreground text-sm">{t('settings.loading')}</p>
    )
  }

  return (
    <div className="space-y-3">
      {categories.map((category) => (
        <CategoryRow
          key={category.id}
          category={category}
          onChanged={invalidate}
        />
      ))}

      <form className="flex items-center gap-2" onSubmit={handleAddCategory}>
        <Input
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          placeholder={t('settings.categoryName')}
        />
        <Button type="submit" disabled={isSubmitting}>
          <Plus className="h-4 w-4" />
          {t('settings.addCategory')}
        </Button>
      </form>
    </div>
  )
}
