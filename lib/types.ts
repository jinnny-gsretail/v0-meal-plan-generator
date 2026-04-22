export type FFType = '김밥' | '주먹밥' | '샌드' | '버거' | '도시락'

// 식단명: FF이름 + 가격대 (주먹밥은 '삼각'으로 표기)
export type MealPlanFFType = '김밥' | '삼각' | '샌드' | '버거' | '도시락'
export type MealPlanPrice = '3.5' | '4.5' | '5.5' | '6.5'
export type MealPlanName = `${MealPlanFFType}${MealPlanPrice}`

export const MEAL_PLAN_FF_TYPES: { type: MealPlanFFType; ffType: FFType }[] = [
  { type: '김밥', ffType: '김밥' },
  { type: '삼각', ffType: '주먹밥' },
  { type: '샌드', ffType: '샌드' },
  { type: '버거', ffType: '버거' },
  { type: '도시락', ffType: '도시락' },
]

export const MEAL_PLAN_PRICES: { label: MealPlanPrice; value: number }[] = [
  { label: '3.5', value: 3500 },
  { label: '4.5', value: 4500 },
  { label: '5.5', value: 5500 },
  { label: '6.5', value: 6500 },
]

// 식단별 목표원가 설정을 위한 구성
// 원가 설정이 필요한 식단: 김밥3,4,5 / 삼각3,4 / 버거3,4,5 / 도시락4.5,5.5,6.5
// 샌드3,4,5는 김밥과 동일하므로 별도 설정 불필요
export interface MealPlanCostConfig {
  name: string
  mealPlanName: MealPlanName
  description: string
  defaultCost: number
  ffType: FFType
  pricePoint: number
}

export const MEAL_PLAN_COST_CONFIGS: MealPlanCostConfig[] = [
  // 김밥 식단
  { name: '김밥3', mealPlanName: '김밥3.5', description: 'FF + 음료', defaultCost: 1486, ffType: '김밥', pricePoint: 3500 },
  { name: '김밥4', mealPlanName: '김밥4.5', description: 'FF + 음료 + 디저트1', defaultCost: 1964, ffType: '김밥', pricePoint: 4500 },
  { name: '김밥5', mealPlanName: '김밥5.5', description: 'FF + 음료 + 디저트2', defaultCost: 2430, ffType: '김밥', pricePoint: 5500 },
  // 삼각 식단
  { name: '삼각3', mealPlanName: '삼각3.5', description: 'FF + 음료 + 디저트1', defaultCost: 1486, ffType: '주먹밥', pricePoint: 3500 },
  { name: '삼각4', mealPlanName: '삼각4.5', description: 'FF + 음료 + 디저트2', defaultCost: 1964, ffType: '주먹밥', pricePoint: 4500 },
  // 버거 식단
  { name: '버거3', mealPlanName: '버거3.5', description: 'FF + 탄산음료', defaultCost: 1486, ffType: '버거', pricePoint: 3500 },
  { name: '버거4', mealPlanName: '버거4.5', description: 'FF + 탄산음료 + 디저트1', defaultCost: 1964, ffType: '버거', pricePoint: 4500 },
  { name: '버거5', mealPlanName: '버거5.5', description: 'FF + 탄산음료 + 디저트2', defaultCost: 2430, ffType: '버거', pricePoint: 5500 },
  // 도시락 식단
  { name: '도시락4.5', mealPlanName: '도시락4.5', description: '도시락 + 음료', defaultCost: 2196, ffType: '도시락', pricePoint: 4500 },
  { name: '도시락5.5', mealPlanName: '도시락5.5', description: '도시락 + 음료 + 디저트1', defaultCost: 2694, ffType: '도시락', pricePoint: 5500 },
  { name: '도시락6.5', mealPlanName: '도시락6.5', description: '도시락 + 음료 + 디저트1', defaultCost: 3191, ffType: '도시락', pricePoint: 6500 },
]

// 식단 표시용 (11개: 삼각5.5 제외)
export const ALL_MEAL_PLANS: { name: MealPlanName; ffType: FFType; price: number }[] = [
  // 김밥
  { name: '김밥3.5', ffType: '김밥', price: 3500 },
  { name: '김밥4.5', ffType: '김밥', price: 4500 },
  { name: '김밥5.5', ffType: '김밥', price: 5500 },
  // 삼각 (5.5 제외)
  { name: '삼각3.5', ffType: '주먹밥', price: 3500 },
  { name: '삼각4.5', ffType: '주먹밥', price: 4500 },
  // 샌드
  { name: '샌드3.5', ffType: '샌드', price: 3500 },
  { name: '샌드4.5', ffType: '샌드', price: 4500 },
  { name: '샌드5.5', ffType: '샌드', price: 5500 },
  // 버거
  { name: '버거3.5', ffType: '버거', price: 3500 },
  { name: '버거4.5', ffType: '버거', price: 4500 },
  { name: '버거5.5', ffType: '버거', price: 5500 },
  // 도시락
  { name: '도시락4.5', ffType: '도시락', price: 4500 },
  { name: '도시락5.5', ffType: '도시락', price: 5500 },
  { name: '도시락6.5', ffType: '도시락', price: 6500 },
]

// 요일별 음료 그룹 매핑 (0: 일요일, 1: 월요일, ...)
export const DRINK_GROUP_BY_DAY: { [day: number]: string } = {
  0: '주스',     // 일요일
  1: '건강',     // 월요일
  2: '주스',     // 화요일
  3: '탄산',     // 수요일
  4: '건강',     // 목요일
  5: '주스',     // 금요일
  6: '주스',     // 토요일
}

// 요일별 디저트1 그룹 매핑
export const DESSERT1_GROUP_BY_DAY: { [day: number]: string } = {
  0: '단백질',   // 일요일
  1: '프레시',   // 월요일
  2: '탄수화물', // 화요일
  3: '단백질',   // 수요일
  4: '당류',     // 목요일
  5: '탄수화물', // 금요일
  6: '탄수화물', // 토요일
}

// 요일별 디저트2 그룹 매핑 (2개 중 랜덤 선택)
export const DESSERT2_GROUPS_BY_DAY: { [day: number]: string[] } = {
  0: ['탄수화물'],           // 일요일
  1: ['프레시', '탄수화물'], // 월요일
  2: ['프레시', '단백질'],   // 화요일
  3: ['탄수화물', '당류'],   // 수요일
  4: ['탄수화물', '단백질'], // 목요일
  5: ['당류', '단백질'],     // 금요일
  6: ['단백질'],             // 토요일
}

export interface Product {
  id: string
  name: string
  cost: number
  category: 'ff' | 'drink' | 'dessert'
  ffType?: FFType // FF의 중분류
  group?: string // 음료/디저트의 그룹
}

export interface MealComposition {
  ff?: Product
  drink?: Product
  desserts: Product[]
  totalCost: number
}

export interface DailyMeal {
  date: string
  compositions: {
    [pricePoint: number]: MealComposition | null
  }
}

export interface PricePointConfig {
  price: number
  targetCost: number
  composition: {
    ff: boolean
    ffType?: 'dosirak' | 'any'
    drink: boolean
    dessertCount: number
  }
}

export const PRICE_POINT_CONFIGS: PricePointConfig[] = [
  {
    price: 3500,
    targetCost: 1486,
    composition: { ff: true, ffType: 'any', drink: true, dessertCount: 0 }
  },
  {
    price: 4500,
    targetCost: 1964,
    composition: { ff: true, ffType: 'any', drink: true, dessertCount: 1 }
  },
  {
    price: 5500,
    targetCost: 2430,
    composition: { ff: true, ffType: 'any', drink: true, dessertCount: 2 }
  },
  {
    price: 6500,
    targetCost: 3191,
    composition: { ff: true, ffType: 'dosirak', drink: true, dessertCount: 1 }
  }
]
