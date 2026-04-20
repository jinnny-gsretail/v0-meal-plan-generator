'use client'

import { useState, useCallback } from 'react'
import { Plus, Trash2, Edit2, Check, X, Upload, Image as ImageIcon, Loader2 } from 'lucide-react'
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
  const { products, addProduct, addProducts, updateProduct, deleteProduct, clearProducts } = useMealboxStore()
  const categoryProducts = products.filter(p => p.category === category)
  
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newCost, setNewCost] = useState('')
  const [newFfType, setNewFfType] = useState<FFType>('김밥')
  const [newGroup, setNewGroup] = useState('')
  
  // 이미지 업로드 관련 상태
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  
  const handleAdd = () => {
    if (!newName || !newCost) return
    addProduct({
      name: newName,
      cost: parseInt(newCost),
      category,
      ...(category === 'ff' ? { ffType: newFfType } : { group: newGroup || undefined })
    })
    setNewName('')
    setNewCost('')
    setNewFfType('김밥')
    setNewGroup('')
    setIsAdding(false)
  }
  
  const handleUpdate = (id: string, name: string, cost: string, ffType?: FFType, group?: string) => {
    updateProduct(id, { 
      name, 
      cost: parseInt(cost),
      ...(category === 'ff' ? { ffType } : { group })
    })
    setEditingId(null)
  }
  
  // 이미지 파일을 Base64로 변환
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }
  
  // 이미지 파싱 API 호출
  const parseImage = async (file: File) => {
    setIsProcessing(true)
    setUploadError(null)
    
    try {
      const base64 = await fileToBase64(file)
      
      const response = await fetch('/api/parse-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, category })
      })
      
      if (!response.ok) {
        throw new Error('이미지 분석에 실패했습니다')
      }
      
      const data = await response.json()
      
      if (data.products && data.products.length > 0) {
        // 기존 해당 카테고리 상품 삭제 후 새로 추가
        clearProducts(category)
        addProducts(data.products)
      } else {
        setUploadError('이미지에서 상품을 찾을 수 없습니다')
      }
    } catch (error) {
      console.error('Image parse error:', error)
      setUploadError('이미지 처리 중 오류가 발생했습니다')
    } finally {
      setIsProcessing(false)
    }
  }
  
  // 드래그 앤 드롭 핸들러
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    
    const files = Array.from(e.dataTransfer.files)
    const imageFile = files.find(f => f.type.startsWith('image/'))
    
    if (imageFile) {
      parseImage(imageFile)
    } else {
      setUploadError('이미지 파일만 업로드 가능합니다')
    }
  }, [category])
  
  // 파일 선택 핸들러
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      parseImage(file)
    }
    e.target.value = '' // 같은 파일 재선택 가능하도록
  }, [category])
  
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
    <div 
      className={`rounded-lg border p-4 ${getCategoryColor()} ${isDragging ? 'ring-2 ring-primary ring-offset-2' : ''} transition-all`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <div className="flex items-center gap-2">
          {/* 이미지 업로드 버튼 */}
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
              disabled={isProcessing}
            />
            <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-muted hover:bg-muted/80 transition-colors ${isProcessing ? 'opacity-50' : ''}`}>
              {isProcessing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <ImageIcon className="w-3 h-3" />
              )}
              <span>이미지</span>
            </div>
          </label>
          <span className={`text-xs px-2 py-1 rounded-full ${getCategoryBadgeColor()}`}>
            {categoryProducts.length}개
          </span>
        </div>
      </div>
      
      {/* 드래그 오버레이 */}
      {isDragging && (
        <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center z-10">
          <div className="text-center">
            <Upload className="w-8 h-8 mx-auto mb-2 text-primary" />
            <p className="text-sm text-primary font-medium">이미지를 여기에 놓으세요</p>
          </div>
        </div>
      )}
      
      {/* 에러 메시지 */}
      {uploadError && (
        <div className="mb-3 p-2 bg-destructive/10 border border-destructive/30 rounded text-xs text-destructive">
          {uploadError}
          <button onClick={() => setUploadError(null)} className="ml-2 underline">닫기</button>
        </div>
      )}
      
      {/* 처리 중 표시 */}
      {isProcessing && (
        <div className="mb-3 p-3 bg-primary/10 border border-primary/30 rounded flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-xs text-primary">이미지에서 상품 정보를 추출하는 중...</span>
        </div>
      )}
      
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
            showFfType={category === 'ff'}
            showGroup={category !== 'ff'}
          />
        ))}
        
        {isAdding ? (
          <div className="flex items-center gap-2 p-2 bg-secondary/50 rounded-md flex-wrap">
            <Input
              placeholder="상품명"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-8 flex-1 min-w-[120px] bg-background"
            />
            <Input
              placeholder="원가"
              type="number"
              value={newCost}
              onChange={(e) => setNewCost(e.target.value)}
              className="h-8 w-20 bg-background"
            />
            {category === 'ff' ? (
              <Select value={newFfType} onValueChange={(v) => setNewFfType(v as FFType)}>
                <SelectTrigger className="h-8 w-24 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="김밥">김밥</SelectItem>
                  <SelectItem value="주먹밥">주먹밥</SelectItem>
                  <SelectItem value="샌드">샌드</SelectItem>
                  <SelectItem value="버거">버거</SelectItem>
                  <SelectItem value="도시락">도시락</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input
                placeholder="그룹"
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                className="h-8 w-24 bg-background"
              />
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
      
      {/* 이미지 업로드 안내 (상품이 없을 때) */}
      {categoryProducts.length === 0 && !isAdding && !isProcessing && (
        <p className="text-xs text-muted-foreground text-center mt-2">
          이미지를 드래그하거나 위 버튼으로 업로드하세요
        </p>
      )}
    </div>
  )
}

interface ProductRowProps {
  product: Product
  isEditing: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: (id: string, name: string, cost: string, ffType?: FFType, group?: string) => void
  onDelete: () => void
  showFfType: boolean
  showGroup: boolean
}

function ProductRow({ product, isEditing, onEdit, onCancel, onSave, onDelete, showFfType, showGroup }: ProductRowProps) {
  const [name, setName] = useState(product.name)
  const [cost, setCost] = useState(product.cost.toString())
  const [ffType, setFfType] = useState<FFType>(product.ffType || '김밥')
  const [group, setGroup] = useState(product.group || '')
  
  if (isEditing) {
    return (
      <div className="flex items-center gap-2 p-2 bg-secondary/50 rounded-md flex-wrap">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 flex-1 min-w-[120px] bg-background"
        />
        <Input
          type="number"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          className="h-8 w-20 bg-background"
        />
        {showFfType && (
          <Select value={ffType} onValueChange={(v) => setFfType(v as FFType)}>
            <SelectTrigger className="h-8 w-24 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="김밥">김밥</SelectItem>
              <SelectItem value="주먹밥">주먹밥</SelectItem>
              <SelectItem value="샌드">샌드</SelectItem>
              <SelectItem value="버거">버거</SelectItem>
              <SelectItem value="도시락">도시락</SelectItem>
            </SelectContent>
          </Select>
        )}
        {showGroup && (
          <Input
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            placeholder="그룹"
            className="h-8 w-24 bg-background"
          />
        )}
        <Button size="sm" variant="ghost" onClick={() => onSave(product.id, name, cost, ffType, group)}>
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
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-sm text-foreground truncate">{product.name}</span>
        {product.ffType && (
          <span className="text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground shrink-0">
            {product.ffType}
          </span>
        )}
        {product.group && (
          <span className="text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground shrink-0">
            {product.group}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
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
