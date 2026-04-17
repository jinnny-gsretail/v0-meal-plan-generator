'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Header } from '@/components/header'
import { ProductManager } from '@/components/product-manager'
import { ExcelUploader } from '@/components/excel-uploader'
import { CostSettings } from '@/components/cost-settings'
import { MealCalendar } from '@/components/meal-calendar'
import { MealPlanSelector } from '@/components/meal-plan-selector'
import { Package, Settings, Calendar } from 'lucide-react'

export default function Home() {
  const [activeTab, setActiveTab] = useState('products')

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="products" className="gap-2">
              <Package className="w-4 h-4" />
              상품 관리
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="w-4 h-4" />
              원가 설정
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2">
              <Calendar className="w-4 h-4" />
              식단 캘린더
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="products" className="space-y-6">
            {/* 엑셀 업로더 */}
            <div className="rounded-lg border border-border bg-card p-6">
              <ExcelUploader />
            </div>

            {/* 수동 상품 관리 */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">또는 수동으로 상품 관리</h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <ProductManager category="ff" title="FF (김밥/주먹밥/샌드/버거/도시락)" />
                <ProductManager category="drink" title="음료" />
                <ProductManager category="dessert" title="디저트" />
              </div>
            </div>
            
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="font-semibold text-foreground mb-3">사용 가이드</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <div className="font-medium text-foreground mb-1">1단계: 상품 등록</div>
                  <p>엑셀 파일을 드래그하거나 수동으로 상품을 등록하세요.</p>
                </div>
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <div className="font-medium text-foreground mb-1">2단계: 원가 설정</div>
                  <p>가격대별 목표 원가를 설정하세요. 구성품 원가 합이 이를 초과하지 않습니다.</p>
                </div>
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <div className="font-medium text-foreground mb-1">3단계: 자동 생성</div>
                  <p>&apos;식단 자동 생성&apos; 버튼을 클릭하면 캘린더에 식단이 자동으로 구성됩니다.</p>
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="settings">
            <div className="max-w-2xl">
              <CostSettings />
              
              <div className="mt-6 rounded-lg border border-border bg-card p-4">
                <h3 className="font-semibold text-foreground mb-3">가격대별 구성 안내</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3 p-3 bg-secondary/30 rounded-lg">
                    <span className="font-mono text-primary font-medium">3,500원</span>
                    <span className="text-muted-foreground">FF(김밥/주먹밥/샌드/버거) + 음료</span>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-secondary/30 rounded-lg">
                    <span className="font-mono text-primary font-medium">4,500원</span>
                    <span className="text-muted-foreground">FF(김밥/주먹밥/샌드/버거) + 음료 + 디저트 1개</span>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-secondary/30 rounded-lg">
                    <span className="font-mono text-primary font-medium">5,500원</span>
                    <span className="text-muted-foreground">FF(김밥/주먹밥/샌드/버거) + 음료 + 디저트 2개</span>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-secondary/30 rounded-lg">
                    <span className="font-mono text-primary font-medium">6,500원</span>
                    <span className="text-muted-foreground">도시락 + 음료 + 디저트 1개 (도시락만 운영)</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="calendar" className="space-y-6">
            {/* 식단 선택 버튼 */}
            <MealPlanSelector />
            
            {/* 캘린더 */}
            <MealCalendar />
            
            <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-primary/20" />
                <span>식단 구성 완료</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-destructive/20" />
                <span>원가 초과</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-muted" />
                <span>구성 불가 (상품 부족)</span>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
