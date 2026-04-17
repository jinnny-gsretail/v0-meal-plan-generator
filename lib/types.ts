export type FFType = '김밥' | '주먹밥' | '샌드' | '버거' | '도시락'

// 식단명: FF이름 + 가격대 (주먹밥은 '삼각'으로 표기, 도시락은 제외)
export type MealPlanFFType = '김밥' | '삼각' | '샌드' | '버거'
export type MealPlanPrice = '3.5' | '4.5' | '5.5'
export type MealPlanName = `${MealPlanFFType}${MealPlanPrice}`

export const MEAL_PLAN_FF_TYPES: { type: MealPlanFFType; ffType: FFType }[] = [
  { type: '김밥', ffType: '김밥' },
  { type: '삼각', ffType: '주먹밥' },
  { type: '샌드', ffType: '샌드' },
  { type: '버거', ffType: '버거' },
]

export const MEAL_PLAN_PRICES: { label: MealPlanPrice; value: number }[] = [
  { label: '3.5', value: 3500 },
  { label: '4.5', value: 4500 },
  { label: '5.5', value: 5500 },
]

// 모든 12개 식단명 생성
export const ALL_MEAL_PLANS: { name: MealPlanName; ffType: FFType; price: number }[] = 
  MEAL_PLAN_FF_TYPES.flatMap(ff => 
    MEAL_PLAN_PRICES.map(price => ({
      name: `${ff.type}${price.label}` as MealPlanName,
      ffType: ff.ffType,
      price: price.value
    }))
  )

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
