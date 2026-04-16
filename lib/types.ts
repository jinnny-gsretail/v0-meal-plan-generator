export type FFType = '김밥' | '주먹밥' | '샌드' | '버거' | '도시락'

export type DessertGroup = '프레시' | '탄수화물' | '단백질' | '당류'
export type DrinkGroup = '건강' | '주스' | '탄산' | '주스/차'
export type DayOfWeek = '월요일' | '화요일' | '수요일' | '목요일' | '금요일'

export interface Product {
  id: string
  code?: string // 상품코드
  name: string // 소분류명
  cost: number
  category: 'ff' | 'drink' | 'dessert'
  ffType?: FFType
  group?: DessertGroup | DrinkGroup // 그룹
  subCategory?: string // 중분류명
  // 음료 전용: 요일 조건 1~3
  dayConditions?: DayOfWeek[]
}

export interface MealComposition {
  ff?: Product
  drink?: Product
  desserts: Product[]
  totalCost: number
}

export interface DailyMeal {
  date: string
  dayOfWeek: DayOfWeek
  compositions: {
    [pricePoint: number]: MealComposition | null
  }
}

export interface PricePointConfig {
  price: number
  targetCost: number
  composition: {
    ff: boolean
    ffType?: 'dosirak' | 'any' | 'jumeokbap' // 주먹밥 추가
    drink: boolean
    dessertCount: number
  }
}

// 주먹밥 특수 규칙: 3500원=디저트1개, 4500원=디저트2개, 5500원=없음
export interface FFSpecialRule {
  ffType: FFType
  priceRules: {
    [price: number]: {
      dessertCount: number
      available: boolean
    }
  }
}

export const JUMEOKBAP_RULES: FFSpecialRule = {
  ffType: '주먹밥',
  priceRules: {
    3500: { dessertCount: 1, available: true },
    4500: { dessertCount: 2, available: true },
    5500: { dessertCount: 0, available: false },
    6500: { dessertCount: 0, available: false },
  }
}

// 요일별 디저트 그룹 조건 매핑
export const DESSERT_DAY_GROUP_MAP: {
  [key in DayOfWeek]: { condition1: DessertGroup; condition2: DessertGroup }
} = {
  '월요일': { condition1: '프레시', condition2: '프레시' },
  '화요일': { condition1: '탄수화물', condition2: '프레시' },
  '수요일': { condition1: '단백질', condition2: '탄수화물' },
  '목요일': { condition1: '당류', condition2: '탄수화물' },
  '금요일': { condition1: '탄수화물', condition2: '당류' },
}

// 두 번째 행 (같은 요일에 다른 조건)
export const DESSERT_DAY_GROUP_MAP_ALT: {
  [key in DayOfWeek]: { condition1: DessertGroup; condition2: DessertGroup }
} = {
  '월요일': { condition1: '프레시', condition2: '탄수화물' },
  '화요일': { condition1: '탄수화물', condition2: '탄수화물' },
  '수요일': { condition1: '단백질', condition2: '당류' },
  '목요일': { condition1: '당류', condition2: '단백질' },
  '금요일': { condition1: '탄수화물', condition2: '단백질' },
}

export const PRICE_POINT_CONFIGS: PricePointConfig[] = [
  {
    price: 3500,
    targetCost: 1800,
    composition: { ff: true, ffType: 'any', drink: true, dessertCount: 0 }
  },
  {
    price: 4500,
    targetCost: 2300,
    composition: { ff: true, ffType: 'any', drink: true, dessertCount: 1 }
  },
  {
    price: 5500,
    targetCost: 2800,
    composition: { ff: true, ffType: 'any', drink: true, dessertCount: 2 }
  },
  {
    price: 6500,
    targetCost: 3300,
    composition: { ff: true, ffType: 'dosirak', drink: true, dessertCount: 1 }
  }
]
