'use client'

import { useState, useCallback } from 'react'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMealboxStore } from '@/lib/store'
import { FFType, Product, DessertGroup, DrinkGroup, DayOfWeek } from '@/lib/types'
import * as XLSX from 'xlsx'

interface ParsedProduct {
  code?: string
  name: string
  cost: number
  category: 'ff' | 'drink' | 'dessert'
  ffType?: FFType
  group?: DessertGroup | DrinkGroup
  subCategory?: string
  dayConditions?: DayOfWeek[]
}

interface UploadResult {
  success: boolean
  message: string
  data?: ParsedProduct[]
}

const validFFTypes: FFType[] = ['김밥', '주먹밥', '샌드', '버거', '도시락']
const validDessertGroups: DessertGroup[] = ['프레시', '탄수화물', '단백질', '당류']
const validDrinkGroups: DrinkGroup[] = ['건강', '주스', '탄산', '주스/차']
const validDays: DayOfWeek[] = ['월요일', '화요일', '수요일', '목요일', '금요일']

export function ExcelUploader() {
  const { addProducts, clearProducts, products } = useMealboxStore()
  const [isDragging, setIsDragging] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const parseDayCondition = (value: string | number | undefined): DayOfWeek | null => {
    if (!value) return null
    const dayStr = String(value).trim()
    if (validDays.includes(dayStr as DayOfWeek)) {
      return dayStr as DayOfWeek
    }
    return null
  }

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
              const firstRow = jsonData[0] as string[]
              const categoryCell = firstRow.find(cell => 
                typeof cell === 'string' && categoryMap[cell.toLowerCase()]
              )
              if (categoryCell) {
                category = categoryMap[categoryCell.toLowerCase()]
              }
            }
            
            if (!category) return
            
            // Get header row to find column indices
            const headerRow = jsonData[0] as string[]
            const colIndices: { [key: string]: number } = {}
            
            headerRow.forEach((header, idx) => {
              const h = String(header || '').trim().toLowerCase()
              if (h.includes('상품코드') || h === '코드') colIndices['code'] = idx
              if (h.includes('소분류') || h === '상품명' || h === '이름') colIndices['name'] = idx
              if (h.includes('원가') || h === '가격') colIndices['cost'] = idx
              if (h.includes('타입') || h === '유형') colIndices['ffType'] = idx
              if (h.includes('그룹') || h === '분류') colIndices['group'] = idx
              if (h.includes('중분류')) colIndices['subCategory'] = idx
              if (h.includes('요일') && h.includes('1')) colIndices['day1'] = idx
              if (h.includes('요일') && h.includes('2')) colIndices['day2'] = idx
              if (h.includes('요일') && h.includes('3')) colIndices['day3'] = idx
            })
            
            // Fallback to position-based parsing if headers not found
            if (colIndices['name'] === undefined) {
              if (category === 'ff') {
                colIndices['name'] = 0
                colIndices['cost'] = 1
                colIndices['ffType'] = 2
              } else if (category === 'drink') {
                colIndices['group'] = 0
                colIndices['subCategory'] = 1
                colIndices['name'] = 2
                colIndices['day1'] = 3
                colIndices['day2'] = 4
                colIndices['day3'] = 5
              } else if (category === 'dessert') {
                colIndices['group'] = 0
                colIndices['subCategory'] = 1
                colIndices['name'] = 2
              }
            }
            
            // Parse rows (skip header row)
            for (let i = 1; i < jsonData.length; i++) {
              const row = jsonData[i] as (string | number)[]
              if (!row || row.length < 2) continue
              
              const name = String(row[colIndices['name']] || '').trim()
              let cost = 0
              
              // Cost might be in a different column or might need to be set default
              if (colIndices['cost'] !== undefined) {
                cost = parseInt(String(row[colIndices['cost']] || '0'))
              }
              
              if (!name) continue
              
              const product: ParsedProduct = {
                name,
                cost,
                category
              }
              
              // Parse code
              if (colIndices['code'] !== undefined && row[colIndices['code']]) {
                product.code = String(row[colIndices['code']]).trim()
              }
              
              // Parse group
              if (colIndices['group'] !== undefined && row[colIndices['group']]) {
                const groupStr = String(row[colIndices['group']]).trim()
                if (category === 'dessert' && validDessertGroups.includes(groupStr as DessertGroup)) {
                  product.group = groupStr as DessertGroup
                } else if (category === 'drink' && validDrinkGroups.includes(groupStr as DrinkGroup)) {
                  product.group = groupStr as DrinkGroup
                }
              }
              
              // Parse subCategory
              if (colIndices['subCategory'] !== undefined && row[colIndices['subCategory']]) {
                product.subCategory = String(row[colIndices['subCategory']]).trim()
              }
              
              // For FF category, check for type
              if (category === 'ff' && colIndices['ffType'] !== undefined && row[colIndices['ffType']]) {
                const ffTypeStr = String(row[colIndices['ffType']]).trim()
                if (validFFTypes.includes(ffTypeStr as FFType)) {
                  product.ffType = ffTypeStr as FFType
                }
              }
              
              // For drink category, parse day conditions
              if (category === 'drink') {
                const dayConditions: DayOfWeek[] = []
                const day1 = parseDayCondition(row[colIndices['day1']])
                const day2 = parseDayCondition(row[colIndices['day2']])
                const day3 = parseDayCondition(row[colIndices['day3']])
                
                if (day1) dayConditions.push(day1)
                if (day2) dayConditions.push(day2)
                if (day3) dayConditions.push(day3)
                
                if (dayConditions.length > 0) {
                  product.dayConditions = dayConditions
                }
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
      clearProducts()
      addProducts(result.data)
    }

    setIsProcessing(false)
  }, [addProducts, clearProducts])

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
    
    // FF sheet
    const ffData = [
      ['상품코드', '소분류명', '원가', '타입'],
      ['FF001', '참치김밥', 1200, '김밥'],
      ['FF002', '소고기김밥', 1500, '김밥'],
      ['FF003', '스팸주먹밥', 800, '주먹밥'],
      ['FF004', '참치마요주먹밥', 750, '주먹밥'],
      ['FF005', '햄치즈샌드', 1100, '샌드'],
      ['FF006', '에그샌드', 1000, '샌드'],
      ['FF007', '치킨버거', 1800, '버거'],
      ['FF008', '불고기버거', 1600, '버거'],
      ['FF009', '불고기도시락', 2500, '도시락'],
      ['FF010', '제육도시락', 2300, '도시락'],
    ]
    const ffSheet = XLSX.utils.aoa_to_sheet(ffData)
    XLSX.utils.book_append_sheet(wb, ffSheet, 'FF')
    
    // 음료 sheet (with day conditions)
    const drinkData = [
      ['그룹', '중분류명', '소분류명', '원가', '요일 조건1', '요일 조건2', '요일 조건3'],
      ['건강', '기능성음료', '두유', 500, '월요일', '목요일', ''],
      ['주스', '냉장음료', '냉장주스', 600, '화요일', '목요일', '금요일'],
      ['건강', '발효유', '드링크요구르트', 500, '월요일', '', ''],
      ['탄산', '생수/탄산수', '탄산수', 400, '수요일', '', ''],
      ['건강', '우유', '가공우유', 500, '월요일', '목요일', ''],
      ['주스/차', '주스', '주스-중페트', 700, '화요일', '목요일', '금요일'],
      ['주스/차', '주스', '주스-팩', 500, '화요일', '목요일', '금요일'],
      ['주스/차', '커피/차음료', '차음료', 600, '금요일', '', ''],
      ['탄산', '탄산음료', '탄산-중캔', 500, '수요일', '', ''],
      ['탄산', '탄산음료', '탄산-소캔', 400, '수요일', '', ''],
      ['탄산', '탄산음료', '탄산-소페트', 500, '수요일', '', ''],
    ]
    const drinkSheet = XLSX.utils.aoa_to_sheet(drinkData)
    XLSX.utils.book_append_sheet(wb, drinkSheet, '음료')
    
    // 디저트 sheet (with group)
    const dessertData = [
      ['그룹', '중분류명', '소분류명', '원가'],
      ['당류', '냉장간편식품', '냉장디저트', 500],
      ['탄수화물', '빵류', '상온디저트빵', 400],
      ['탄수화물', '빵류', '일반빵', 350],
      ['탄수화물', '빵류', '냉장디저트빵', 450],
      ['탄수화물', '스낵', '일반스낵', 300],
      ['프레시', '씨리얼/유아식', '기능성씨리얼', 600],
      ['프레시', '안주', '견과안주', 500],
      ['프레시', '어묵/맛살', '어묵', 400],
      ['단백질', '어묵/맛살', '맛살', 450],
      ['단백질', '육가공', '소시지', 500],
      ['단백질', '육가공', '계육가공', 550],
      ['당류', '초콜릿', '초콜릿', 400],
      ['단백질', '치즈/버터', '치즈', 500],
      ['당류', '캔디/껌', '캔디', 250],
      ['당류', '캔디/껌', '젤리', 300],
      ['탄수화물', '쿠키/샌드', '파이/샌드', 350],
      ['탄수화물', '쿠키/샌드', '쿠키', 300],
      ['프레시', '발효유', '요거트', 600],
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

  const getGroupCounts = () => {
    const desserts = products.filter(p => p.category === 'dessert')
    const drinks = products.filter(p => p.category === 'drink')
    
    const dessertGroups: { [key: string]: number } = {}
    const drinkGroups: { [key: string]: number } = {}
    
    desserts.forEach(p => {
      if (p.group) {
        dessertGroups[p.group] = (dessertGroups[p.group] || 0) + 1
      }
    })
    
    drinks.forEach(p => {
      if (p.group) {
        drinkGroups[p.group] = (drinkGroups[p.group] || 0) + 1
      }
    })
    
    return { dessertGroups, drinkGroups }
  }

  const counts = getCategoryCounts()
  const groupCounts = getGroupCounts()

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
              <div className="mt-3 space-y-2">
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>FF: {counts.ff}개</span>
                  <span>음료: {counts.drink}개</span>
                  <span>디저트: {counts.dessert}개</span>
                </div>
                {Object.keys(groupCounts.dessertGroups).length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    <span className="text-foreground font-medium">디저트 그룹:</span>{' '}
                    {Object.entries(groupCounts.dessertGroups).map(([group, count]) => (
                      <span key={group} className="mr-3">{group} {count}개</span>
                    ))}
                  </div>
                )}
                {Object.keys(groupCounts.drinkGroups).length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    <span className="text-foreground font-medium">음료 그룹:</span>{' '}
                    {Object.entries(groupCounts.drinkGroups).map(([group, count]) => (
                      <span key={group} className="mr-3">{group} {count}개</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="p-4 bg-muted/50 rounded-lg">
        <h4 className="font-medium text-foreground mb-2">엑셀 파일 형식 안내</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>- 시트 이름: <span className="text-primary font-medium">FF</span>, <span className="text-primary font-medium">음료</span>, <span className="text-primary font-medium">디저트</span></li>
          <li>- FF 시트: 상품코드, 소분류명, 원가, 타입(김밥/주먹밥/샌드/버거/도시락)</li>
          <li>- 음료 시트: 그룹, 중분류명, 소분류명, 원가, 요일 조건1, 요일 조건2, 요일 조건3</li>
          <li>- 디저트 시트: 그룹(프레시/탄수화물/단백질/당류), 중분류명, 소분류명, 원가</li>
          <li>- 첫 번째 행은 헤더로 인식됩니다</li>
        </ul>
      </div>
    </div>
  )
}
