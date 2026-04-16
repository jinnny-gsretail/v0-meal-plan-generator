'use client'

import { useState } from 'react'
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useMealboxStore } from '@/lib/store'
import { Product, FFType } from '@/lib/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ProductManagerProps {
  category: 'ff' | 'drink' | 'dessert'
  title: string
}

export function ProductManager({ category, title }: ProductManagerProps) {
  const { products, addProduct, updateProduct, deleteProduct } = useMealboxStore()
  const categoryProducts = products.filter(p => p.category === category)
  
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newCost, setNewCost] = useState('')
  const [newFfType, setNewFfType] = useState<FFType>('김밥')
  
  const handleAdd = () => {
    if (!newName || !newCost) return
    addProduct({
      name: newName,
      cost: parseInt(newCost),
      category,
      ...(category === 'ff' ? { ffType: newFfType } : {})
    })
    setNewName('')
    setNewCost('')
    setNewFfType('김밥')
    setIsAdding(false)
  }
  
  const handleUpdate = (id: string, name: string, cost: string, ffType?: FFType) => {
    updateProduct(id, { 
      name, 
      cost: parseInt(cost),
      ...(category === 'ff' ? { ffType } : {})
    })
    setEditingId(null)
  }
  
  const getCategoryColor = () => {
    switch (category) {
      case 'ff': return 'text-ff border-ff/30 bg-ff/5'
      case 'drink': return 'text-drink border-drink/30 bg-drink/5'
      case 'dessert': return 'text-dessert border-dessert/30 bg-dessert/5'
    }
  }
  
  const getCategoryBadgeColor = () => {
    switch (category) {
      case 'ff': return 'bg-ff/20 text-ff'
      case 'drink': return 'bg-drink/20 text-drink'
      case 'dessert': return 'bg-dessert/20 text-dessert'
    }
  }

  return (
    <div className={`rounded-lg border p-4 ${getCategoryColor()}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <span className={`text-xs px-2 py-1 rounded-full ${getCategoryBadgeColor()}`}>
          {categoryProducts.length}개
        </span>
      </div>
      
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {categoryProducts.map(product => (
          <ProductRow
            key={product.id}
            product={product}
            isEditing={editingId === product.id}
            onEdit={() => setEditingId(product.id)}
            onCancel={() => setEditingId(null)}
            onSave={handleUpdate}
            onDelete={() => deleteProduct(product.id)}
            category={category}
          />
        ))}
        
        {isAdding ? (
          <div className="flex items-center gap-2 p-2 bg-secondary/50 rounded-md">
            <Input
              placeholder="상품명"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-8 flex-1 bg-background"
            />
            <Input
              placeholder="원가"
              type="number"
              value={newCost}
              onChange={(e) => setNewCost(e.target.value)}
              className="h-8 w-20 bg-background"
            />
            {category === 'ff' && (
              <Select value={newFfType} onValueChange={(v) => setNewFfType(v as FFType)}>
                <SelectTrigger className="h-8 w-24 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="김밥">김밥</SelectItem>
                  <SelectItem value="삼각김밥">삼각김밥</SelectItem>
                  <SelectItem value="도시락">도시락</SelectItem>
                  <SelectItem value="햄버거">햄버거</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Button size="sm" variant="ghost" onClick={handleAdd}>
              <Check className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="w-full border border-dashed border-muted-foreground/30 text-muted-foreground hover:text-foreground"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            상품 추가
          </Button>
        )}
      </div>
    </div>
  )
}

interface ProductRowProps {
  product: Product
  isEditing: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: (id: string, name: string, cost: string, ffType?: FFType) => void
  onDelete: () => void
  category: 'ff' | 'drink' | 'dessert'
}

function ProductRow({ product, isEditing, onEdit, onCancel, onSave, onDelete, category }: ProductRowProps) {
  const [name, setName] = useState(product.name)
  const [cost, setCost] = useState(product.cost.toString())
  const [ffType, setFfType] = useState<FFType>(product.ffType || '김밥')
  
  if (isEditing) {
    return (
      <div className="flex items-center gap-2 p-2 bg-secondary/50 rounded-md">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 flex-1 bg-background"
        />
        <Input
          type="number"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          className="h-8 w-20 bg-background"
        />
        {category === 'ff' && (
          <Select value={ffType} onValueChange={(v) => setFfType(v as FFType)}>
            <SelectTrigger className="h-8 w-24 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="김밥">김밥</SelectItem>
              <SelectItem value="삼각김밥">삼각김밥</SelectItem>
              <SelectItem value="도시락">도시락</SelectItem>
              <SelectItem value="햄버거">햄버거</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Button size="sm" variant="ghost" onClick={() => onSave(product.id, name, cost, ffType)}>
          <Check className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="w-4 h-4" />
        </Button>
      </div>
    )
  }
  
  return (
    <div className="flex items-center justify-between p-2 bg-secondary/30 rounded-md group hover:bg-secondary/50 transition-colors">
      <div className="flex items-center gap-2">
        <span className="text-sm text-foreground">{product.name}</span>
        {product.ffType && (
          <span className="text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
            {product.ffType}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {product.cost.toLocaleString()}원
        </span>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onEdit}>
            <Edit2 className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={onDelete}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}
