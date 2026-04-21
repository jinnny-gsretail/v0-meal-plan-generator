'use client'

import { useState, useCallback } from 'react'
import { ClipboardPaste, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMealboxStore } from '@/lib/store'
import { FFType } from '@/lib/types'

interface ParsedProduct {
  name: string
  cost: number
  category: 'ff' | 'drink' | 'dessert'
  ffType?: FFType
  group?: string
}

interface ParseResult {
  success: boolean
  message: string
  data?: ParsedProduct[]
}

const validFFTypes: FFType[] = ['김밥', '주먹밥', '샌드', '버거', '도시락']

export function ExcelUploader() {
  const { setProducts, products } = useMealboxStore()
  const [ffText, setFfText] = useState('')
  const [drinkText, setDrinkText] = useState('')
  const [dessertText, setDessertText] = useState('')
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)

  const parseTextData = useCallback((text: string, category: 'ff' | 'drink' | 'dessert'): ParsedProduct[] => {
    const lines = text.trim().split('\n').filter(line => line.trim())
    const products: ParsedProduct[] = []
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      // 탭 또는 여러 공백으로 구분
      const parts = line.split(/\t+|\s{2,}/).map(p => p.trim()).filter(Boolean)
      
      if (parts.length < 3) {
        // 탭이 없으면 마지막 숫자를 원가로 추출 시도
        const match = line.match(/^(.+?)\s+(\d+)\s*$/)
        if (match) {
          // 2개 컬럼인 경우 (상품명, 원가) - 첫 번째 행이 헤더인지 확인
          const name = match[1].trim()
          const cost = parseInt(match[2])
          
          if (name && !isNaN(cost) && cost > 0) {
            // 헤더 행 스킵 (상품명, 원가, 중분류, 그룹 등의 키워드가 있으면)
            if (name.includes('상품명') || name.includes('원가') || name.includes('중분류') || name.includes('그룹')) {
              continue
            }
            products.push({ name, cost, category })
          }
        }
        continue
      }
      
      // 3개 이상 컬럼: 첫번째=중분류/그룹, 두번째=상품명, 세번째=원가
      const firstCol = parts[0]
      const name = parts[1]
      const cost = parseInt(parts[2])
      
      // 헤더 행 스킵
      if (firstCol.includes('중분류') || firstCol.includes('그룹') || name.includes('상품명') || parts[2].includes('원가')) {
        continue
      }
      
      if (!name || isNaN(cost) || cost <= 0) continue
      
      const product: ParsedProduct = { name, cost, category }
      
      if (category === 'ff') {
        if (validFFTypes.includes(firstCol as FFType)) {
          product.ffType = firstCol as FFType
        }
      } else {
        product.group = firstCol
      }
      
      products.push(product)
    }
    
    return products
  }, [])

  const handleApply = useCallback(() => {
    const allProducts: ParsedProduct[] = []
    
    if (ffText.trim()) {
      allProducts.push(...parseTextData(ffText, 'ff'))
    }
    if (drinkText.trim()) {
      allProducts.push(...parseTextData(drinkText, 'drink'))
    }
    if (dessertText.trim()) {
      allProducts.push(...parseTextData(dessertText, 'dessert'))
    }
    
    if (allProducts.length === 0) {
      setParseResult({
        success: false,
        message: '유효한 상품 데이터를 찾을 수 없습니다. 형식을 확인해주세요.'
      })
      return
    }
    
    setProducts(allProducts)
    setParseResult({
      success: true,
      message: `${allProducts.length}개의 상품이 등록되었습니다.`,
      data: allProducts
    })
  }, [ffText, drinkText, dessertText, parseTextData, setProducts])

  const handleClear = useCallback(() => {
    setFfText('')
    setDrinkText('')
    setDessertText('')
    setParseResult(null)
  }, [])

  const getCategoryCounts = () => {
    const ff = products.filter(p => p.category === 'ff').length
    const drink = products.filter(p => p.category === 'drink').length
    const dessert = products.filter(p => p.category === 'dessert').length
    return { ff, drink, dessert }
  }

  const counts = getCategoryCounts()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">텍스트로 상품 등록</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleClear}>
            <Trash2 className="w-4 h-4 mr-2" />
            초기화
          </Button>
          <Button size="sm" onClick={handleApply}>
            <ClipboardPaste className="w-4 h-4 mr-2" />
            상품 등록
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* FF 입력 */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            FF (김밥/주먹밥/샌드/버거/도시락)
          </label>
          <textarea
            value={ffText}
            onChange={(e) => setFfText(e.target.value)}
            placeholder={`중분류\t상품명\t원가
김밥\t참치김밥\t1200
주먹밥\t불고기주먹밥\t800
샌드\t햄치즈샌드\t1100`}
            className="w-full h-40 p-3 text-sm bg-background border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <p className="text-xs text-muted-foreground">
            엑셀에서 복사하여 붙여넣기 (탭으로 구분)
          </p>
        </div>

        {/* 음료 입력 */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            음료
          </label>
          <textarea
            value={drinkText}
            onChange={(e) => setDrinkText(e.target.value)}
            placeholder={`그룹\t상품명\t원가
주스\t사과주스\t300
탄산\t콜라\t400
건강\t두유\t350`}
            className="w-full h-40 p-3 text-sm bg-background border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <p className="text-xs text-muted-foreground">
            엑셀에서 복사하여 붙여넣기 (탭으로 구분)
          </p>
        </div>

        {/* 디저트 입력 */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            디저트
          </label>
          <textarea
            value={dessertText}
            onChange={(e) => setDessertText(e.target.value)}
            placeholder={`그룹\t상품명\t원가
당류\t초코쿠키\t200
프레시\t요거트\t300
단백질\t견과류\t400`}
            className="w-full h-40 p-3 text-sm bg-background border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <p className="text-xs text-muted-foreground">
            엑셀에서 복사하여 붙여넣기 (탭으로 구분)
          </p>
        </div>
      </div>

      {parseResult && (
        <div className={`
          flex items-start gap-3 p-4 rounded-lg
          ${parseResult.success 
            ? 'bg-green-500/10 border border-green-500/30' 
            : 'bg-destructive/10 border border-destructive/30'
          }
        `}>
          {parseResult.success ? (
            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p className={parseResult.success ? 'text-green-500' : 'text-destructive'}>
              {parseResult.message}
            </p>
            {parseResult.success && (
              <p className="text-sm text-muted-foreground mt-1">
                FF: {counts.ff}개, 음료: {counts.drink}개, 디저트: {counts.dessert}개
              </p>
            )}
          </div>
        </div>
      )}

      <div className="p-4 bg-muted/50 rounded-lg">
        <h4 className="font-medium text-foreground mb-2">입력 형식 안내</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>- 엑셀에서 데이터를 복사하여 각 카테고리 입력창에 붙여넣기</li>
          <li>- FF: <span className="text-primary">중분류</span>(김밥/주먹밥/샌드/버거/도시락), 상품명, 원가 순서</li>
          <li>- 음료/디저트: <span className="text-primary">그룹</span>, 상품명, 원가 순서</li>
          <li>- 각 컬럼은 탭(Tab)으로 구분됩니다</li>
          <li>- 첫 번째 행이 헤더인 경우 자동으로 무시됩니다</li>
        </ul>
      </div>
    </div>
  )
}
