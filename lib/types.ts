export type FFType = '김밥' | '주먹밥' | '샌드' | '버거' | '도시락'

export interface Product {
  id: string
  name: string
  cost: number
  category: 'ff' | 'drink' | 'dessert'
  ffType?: FFType
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
