'use client'

import { useState, useCallback } from 'react'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMealboxStore } from '@/lib/store'
import { FFType, Product } from '@/lib/types'
import * as XLSX from 'xlsx'

interface ParsedProduct {
  name: string
  cost: number
  category: 'ff' | 'drink' | 'dessert'
  ffType?: FFType
}

interface UploadResult {
  success: boolean
  message: string
  data?: ParsedProduct[]
}

export function ExcelUploader() {
  const { addProducts, clearProducts, products } = useMealboxStore()
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
            
            // Find category from sheet name or first row
            let category = categoryMap[sheetName]
            
            // If sheet name doesn't match, try to find category in data
            if (!category) {
              const firstRow = jsonData[0] as string[]
              const categoryCell = firstRow.find(cell => 
                typeof cell === 'string' && categoryMap[cell.toLowerCase()]
              )
              if (categoryCell) {
                category = categoryMap[categoryCell.toLowerCase()]
              }
            }
            
            if (!category) return // Skip unknown categories
            
            // Parse rows (skip header row)
            for (let i = 1; i < jsonData.length; i++) {
              const row = jsonData[i] as (string | number)[]
              if (!row || row.length < 2) continue
              
              const name = String(row[0] || '').trim()
              const cost = parseInt(String(row[1] || '0'))
              
              if (!name || isNaN(cost)) continue
              
              const product: ParsedProduct = {
                name,
                cost,
                category
              }
              
              // For FF category, check for type in third column
              if (category === 'ff' && row[2]) {
                const ffTypeStr = String(row[2]).trim()
                const validFFTypes: FFType[] = ['김밥', '삼각김밥', '도시락', '햄버거']
                if (validFFTypes.includes(ffTypeStr as FFType)) {
                  product.ffType = ffTypeStr as FFType
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
      // Clear existing products and add new ones
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
      ['상품명', '원가', '타입'],
      ['참치김밥', 1200, '김밥'],
      ['소고기김밥', 1500, '김밥'],
      ['스팸삼각김밥', 800, '삼각김밥'],
      ['참치마요삼각김밥', 750, '삼각김밥'],
      ['불고기도시락', 2500, '도시락'],
      ['제육도시락', 2300, '도시락'],
      ['치킨버거', 1800, '햄버거'],
    ]
    const ffSheet = XLSX.utils.aoa_to_sheet(ffData)
    XLSX.utils.book_append_sheet(wb, ffSheet, 'FF')
    
    // 음료 sheet
    const drinkData = [
      ['상품명', '원가'],
      ['사이다 250ml', 500],
      ['콜라 250ml', 500],
      ['오렌지주스 200ml', 600],
      ['녹차 500ml', 800],
    ]
    const drinkSheet = XLSX.utils.aoa_to_sheet(drinkData)
    XLSX.utils.book_append_sheet(wb, drinkSheet, '음료')
    
    // 디저트 sheet
    const dessertData = [
      ['상품명', '원가'],
      ['초코파이', 300],
      ['양갱', 250],
      ['젤리', 200],
      ['과일컵', 500],
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
          <div>
            <p className={uploadResult.success ? 'text-green-500' : 'text-destructive'}>
              {uploadResult.message}
            </p>
            {uploadResult.success && (
              <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                <span>FF: {counts.ff}개</span>
                <span>음료: {counts.drink}개</span>
                <span>디저트: {counts.dessert}개</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="p-4 bg-muted/50 rounded-lg">
        <h4 className="font-medium text-foreground mb-2">엑셀 파일 형식 안내</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>- 시트 이름: <span className="text-ff">FF</span>, <span className="text-drink">음료</span>, <span className="text-dessert">디저트</span></li>
          <li>- FF 시트: 상품명, 원가, 타입(김밥/삼각김밥/도시락/햄버거) 순서</li>
          <li>- 음료/디저트 시트: 상품명, 원가 순서</li>
          <li>- 첫 번째 행은 헤더로 인식됩니다</li>
        </ul>
      </div>
    </div>
  )
}
