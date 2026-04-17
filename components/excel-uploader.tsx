'use client'

import { useState, useCallback } from 'react'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMealboxStore } from '@/lib/store'
import { FFType } from '@/lib/types'
import * as XLSX from 'xlsx'

interface ParsedProduct {
  name: string
  cost: number
  category: 'ff' | 'drink' | 'dessert'
  ffType?: FFType // FF의 중분류
  group?: string // 음료/디저트의 그룹
}

interface UploadResult {
  success: boolean
  message: string
  data?: ParsedProduct[]
}

const validFFTypes: FFType[] = ['김밥', '주먹밥', '샌드', '버거', '도시락']

export function ExcelUploader() {
  const { setProducts, products } = useMealboxStore()
  const [isDragging, setIsDragging] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const parseExcelFile = async (file: File): Promise<UploadResult> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result
          const workbook = XLSX.read(data, { type: 'binary' })
          
          const parsedProducts: ParsedProduct[] = []
          
          // Process each sheet (FF, 음료, 디저트)
          const categoryMap: { [key: string]: 'ff' | 'drink' | 'dessert' } = {
            'ff': 'ff',
            'FF': 'ff',
            '음료': 'drink',
            '디저트': 'dessert',
            'drink': 'drink',
            'dessert': 'dessert'
          }
          
          workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName]
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]
            
            if (jsonData.length < 2) return // Skip empty sheets
            
            // Find category from sheet name
            let category = categoryMap[sheetName]
            
            if (!category) {
              // Try to find category from first row
              const firstRow = jsonData[0] as string[]
              const categoryCell = firstRow.find(cell => 
                typeof cell === 'string' && categoryMap[cell.toLowerCase()]
              )
              if (categoryCell) {
                category = categoryMap[categoryCell.toLowerCase()]
              }
            }
            
            if (!category) return // Skip if category not found
            
            // Parse rows (skip header row)
            for (let i = 1; i < jsonData.length; i++) {
              const row = jsonData[i] as (string | number)[]
              if (!row || row.length < 3) continue
              
              // FF: 중분류, 상품명, 원가
              // 음료/디저트: 그룹, 상품명, 원가
              const firstCol = String(row[0] || '').trim()
              const name = String(row[1] || '').trim()
              const cost = parseInt(String(row[2] || '0'))
              
              if (!name || isNaN(cost)) continue
              
              const product: ParsedProduct = {
                name,
                cost,
                category
              }
              
              if (category === 'ff') {
                // FF: 첫번째 컬럼이 중분류(타입)
                if (validFFTypes.includes(firstCol as FFType)) {
                  product.ffType = firstCol as FFType
                }
              } else {
                // 음료/디저트: 첫번째 컬럼이 그룹
                product.group = firstCol
              }
              
              parsedProducts.push(product)
            }
          })
          
          if (parsedProducts.length === 0) {
            resolve({
              success: false,
              message: '유효한 상품 데이터를 찾을 수 없습니다. 시트 이름(FF, 음료, 디저트)과 데이터 형식을 확인해주세요.'
            })
          } else {
            resolve({
              success: true,
              message: `${parsedProducts.length}개의 상품을 찾았습니다.`,
              data: parsedProducts
            })
          }
        } catch (error) {
          resolve({
            success: false,
            message: '파일 처리 중 오류가 발생했습니다. 올바른 엑셀 파일인지 확인해주세요.'
          })
        }
      }
      
      reader.onerror = () => {
        resolve({
          success: false,
          message: '파일을 읽을 수 없습니다.'
        })
      }
      
      reader.readAsBinaryString(file)
    })
  }

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setUploadResult({
        success: false,
        message: '엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.'
      })
      return
    }

    setIsProcessing(true)
    setUploadResult(null)

    const result = await parseExcelFile(file)
    setUploadResult(result)

    if (result.success && result.data) {
      setProducts(result.data)
    }

    setIsProcessing(false)
  }, [setProducts])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFile(file)
    }
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFile(file)
    }
    e.target.value = ''
  }, [handleFile])

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new()
    
    // FF sheet: 중분류, 상품명, 원가
    const ffData = [
      ['중분류', '상품명', '원가'],
      ['주먹밥', '깐부)직화불닭발주먹밥', 657],
      ['주먹밥', '삼각)갈비양념불고기', 457],
      ['주먹밥', '삼각)더바삭한김전주비빔', 413],
      ['김밥', '참치김밥', 1200],
      ['김밥', '소고기김밥', 1500],
      ['샌드', '햄치즈샌드', 1100],
      ['샌드', '에그샌드', 1000],
      ['버거', '치킨버거', 1800],
      ['버거', '불고기버거', 1600],
      ['도시락', '불고기도시락', 2500],
      ['도시락', '제육도시락', 2300],
    ]
    const ffSheet = XLSX.utils.aoa_to_sheet(ffData)
    XLSX.utils.book_append_sheet(wb, ffSheet, 'FF')
    
    // 음료 sheet: 그룹, 상품명, 원가
    const drinkData = [
      ['그룹', '상품명', '원가'],
      ['주스', '남양)과수원사과팩190ML', 268],
      ['탄산', '동아)나랑드사이다제로345ML', 295],
      ['주스', '요아정드링킹요거트리치500ML', 335],
      ['주스', '유어스)덴마크드링킹레몬500ML', 335],
      ['탄산', '일화)천연사이다350ML', 346],
    ]
    const drinkSheet = XLSX.utils.aoa_to_sheet(drinkData)
    XLSX.utils.book_append_sheet(wb, drinkSheet, '음료')
    
    // 디저트 sheet: 그룹, 상품명, 원가
    const dessertData = [
      ['그룹', '상품명', '원가'],
      ['당류', '초코칩쿠키', 500],
      ['프레시', '요거트', 800],
      ['단백질', '견과류믹스', 900],
      ['탄수화물', '상온디저트빵', 600],
    ]
    const dessertSheet = XLSX.utils.aoa_to_sheet(dessertData)
    XLSX.utils.book_append_sheet(wb, dessertSheet, '디저트')
    
    XLSX.writeFile(wb, '밀박스25_상품템플릿.xlsx')
  }

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
        <h3 className="text-lg font-semibold text-foreground">엑셀 파일로 상품 등록</h3>
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="w-4 h-4 mr-2" />
          템플릿 다운로드
        </Button>
      </div>
      
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-all
          ${isDragging 
            ? 'border-primary bg-primary/5' 
            : 'border-muted-foreground/30 hover:border-muted-foreground/50'
          }
          ${isProcessing ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isProcessing}
        />
        
        <div className="flex flex-col items-center gap-3">
          {isProcessing ? (
            <>
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-muted-foreground">파일 처리 중...</p>
            </>
          ) : (
            <>
              <div className={`p-3 rounded-full ${isDragging ? 'bg-primary/10' : 'bg-muted'}`}>
                {isDragging ? (
                  <FileSpreadsheet className="w-8 h-8 text-primary" />
                ) : (
                  <Upload className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {isDragging ? '파일을 놓아주세요' : '엑셀 파일을 드래그하거나 클릭하여 업로드'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  .xlsx, .xls 파일 지원
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {uploadResult && (
        <div className={`
          flex items-start gap-3 p-4 rounded-lg
          ${uploadResult.success 
            ? 'bg-green-500/10 border border-green-500/30' 
            : 'bg-destructive/10 border border-destructive/30'
          }
        `}>
          {uploadResult.success ? (
            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p className={uploadResult.success ? 'text-green-500' : 'text-destructive'}>
              {uploadResult.message}
            </p>
            {uploadResult.success && (
              <p className="text-sm text-muted-foreground mt-1">
                FF: {counts.ff}개, 음료: {counts.drink}개, 디저트: {counts.dessert}개
              </p>
            )}
          </div>
        </div>
      )}

      <div className="p-4 bg-muted/50 rounded-lg">
        <h4 className="font-medium text-foreground mb-2">엑셀 파일 형식 안내</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>- 시트 이름: <span className="text-primary font-medium">FF</span>, <span className="text-primary font-medium">음료</span>, <span className="text-primary font-medium">디저트</span></li>
          <li>- FF 시트: <span className="text-primary">중분류</span>(김밥/주먹밥/샌드/버거/도시락), 상품명, 원가 순서</li>
          <li>- 음료/디저트 시트: <span className="text-primary">그룹</span>, 상품명, 원가 순서</li>
          <li>- 첫 번째 행은 헤더로 인식됩니다</li>
        </ul>
      </div>
    </div>
  )
}
