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

// 모든 11개 식단명 생성 (삼각5.5 제외 - 주먹밥은 5500원대 사용 불가)
export const ALL_MEAL_PLANS: { name: MealPlanName; ffType: FFType; price: number }[] = 
  MEAL_PLAN_FF_TYPES.flatMap(ff => 
    MEAL_PLAN_PRICES
      .filter(price => !(ff.type === '삼각' && price.label === '5.5')) // 삼각5.5 제외
      .map(price => ({
        name: `${ff.type}${price.label}` as MealPlanName,
        ffType: ff.ffType,
        price: price.value
      }))
  )

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
