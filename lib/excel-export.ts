import * as XLSX from 'xlsx'
import { MealPlanDailyMeals, MealPlanTargetCosts } from './store'
import { ALL_MEAL_PLANS, MEAL_PLAN_COST_CONFIGS } from './types'

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

// 주차 계산 (해당 월의 첫 주 = 1주차)
function getWeekOfMonth(dateStr: string): number {
  const date = new Date(dateStr)
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
  return Math.ceil((date.getDate() + firstDay.getDay()) / 7)
}

// 원가 대비 색상 (초과: 빨강, 미달: 파랑)
function getCostDiff(actual: number, target: number) {
  const diff = actual - target
  return { diff, isOver: diff > 0 }
}

// 고객용 식단표 다운로드
export function downloadCustomerExcel(
  mealPlanMeals: MealPlanDailyMeals,
  mealPlanTargetCosts: MealPlanTargetCosts,
  startDate: Date,
  endDate: Date
) {
  const wb = XLSX.utils.book_new()

  // 식단 그룹별 탭 구성
  const mealGroups = [
    { label: '가)김밥', plans: ['김밥3.5', '김밥4.5', '김밥5.5'] },
    { label: '가-1)김밥(음X)', plans: ['김밥3.5(음X)'] },
    { label: '나)삼각', plans: ['삼각3.5', '삼각4.5'] },
    { label: '나-1)삼각(음X)', plans: ['삼각3.5(음X)'] },
    { label: '다)샌드', plans: ['샌드3.5', '샌드4.5', '샌드5.5'] },
    { label: '다-1)샌드(음X)', plans: ['샌드3.5(음X)'] },
    { label: '라)버거', plans: ['버거3.5', '버거4.5', '버거5.5'] },
    { label: '마)도시락', plans: ['도시락4.5', '도시락5.5', '도시락6.5'] },
    { label: '바)공장박스', plans: ['공장박스'] },
  ]

  for (const group of mealGroups) {
    const ws = buildCustomerSheet(group.plans, mealPlanMeals, mealPlanTargetCosts, startDate, endDate)
    XLSX.utils.book_append_sheet(wb, ws, group.label)
  }

  const month = `${startDate.getFullYear()}년${String(startDate.getMonth() + 1).padStart(2, '0')}월`
  XLSX.writeFile(wb, `밀박스25_고객식단표_${month}.xlsx`)
}

// 공장용 식단표 다운로드 (D-1 shift)
export function downloadFactoryExcel(
  mealPlanMeals: MealPlanDailyMeals,
  mealPlanTargetCosts: MealPlanTargetCosts,
  startDate: Date,
  endDate: Date
) {
  const wb = XLSX.utils.book_new()

  const mealGroups = [
    { label: '가)김밥[공장]', plans: ['김밥3.5', '김밥4.5', '김밥5.5'] },
    { label: '가-1)김밥(음X)[공장]', plans: ['김밥3.5(음X)'] },
    { label: '나)삼각[공장]', plans: ['삼각3.5', '삼각4.5'] },
    { label: '나-1)삼각(음X)[공장]', plans: ['삼각3.5(음X)'] },
    { label: '다)샌드[공장]', plans: ['샌드3.5', '샌드4.5', '샌드5.5'] },
    { label: '다-1)샌드(음X)[공장]', plans: ['샌드3.5(음X)'] },
    { label: '라)버거[공장]', plans: ['버거3.5', '버거4.5', '버거5.5'] },
    { label: '마)도시락[공장]', plans: ['도시락4.5', '도시락5.5', '도시락6.5'] },
    { label: '바)공장박스[공장]', plans: ['공장박스'] },
  ]

  for (const group of mealGroups) {
    const ws = buildFactorySheet(group.plans, mealPlanMeals, mealPlanTargetCosts, startDate, endDate)
    XLSX.utils.book_append_sheet(wb, ws, group.label)
  }

  const month = `${startDate.getFullYear()}년${String(startDate.getMonth() + 1).padStart(2, '0')}월`
  XLSX.writeFile(wb, `밀박스25_공장식단표_${month}.xlsx`)
}

// 날짜 범위 내의 모든 날짜 배열 생성
function getDatesInRange(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = []
  const cur = new Date(startDate)
  while (cur <= endDate) {
    dates.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

// 고객용 시트 빌드
function buildCustomerSheet(
  planNames: string[],
  mealPlanMeals: MealPlanDailyMeals,
  mealPlanTargetCosts: MealPlanTargetCosts,
  startDate: Date,
  endDate: Date
): XLSX.WorkSheet {
  const dates = getDatesInRange(startDate, endDate)
  const aoa: (string | number)[][] = []

  // 헤더: 제목
  const firstPlan = planNames[0]
  const ffType = firstPlan.replace(/[\d.]+$/, '')
  aoa.push([`밀박스25 ${ffType} 식단표`, '', '', '', '', '', '', '', ''])
  aoa.push([`기간: ${formatDate(startDate)} ~ ${formatDate(endDate)}`, '', '', '', '', '', '', '', ''])
  aoa.push([])

  // 컬럼 헤더
  const header = ['날짜', '요일', 'FF명']
  for (const plan of planNames) {
    const targetCost = mealPlanTargetCosts[plan] ?? MEAL_PLAN_COST_CONFIGS.find(c => c.mealPlanName === plan)?.defaultCost ?? 0
    header.push(`${plan} 구성품`, `원가(목표:${targetCost}원)`)
  }
  header.push('주차')
  aoa.push(header)

  // 데이터 행
  for (const date of dates) {
    const dateStr = toDateStr(date)
    const dayName = DAY_NAMES[date.getDay()]
    const week = getWeekOfMonth(dateStr)

    // 대표 FF명 (첫 번째 plan 기준)
    const firstMeal = mealPlanMeals[planNames[0]]?.find(m => m.date === dateStr)
    const pricePoint = ALL_MEAL_PLANS.find(m => m.name === planNames[0])?.price ?? 3500
    const firstComp = firstMeal?.compositions[pricePoint]
    const ffName = firstComp?.ff?.name ?? '-'

    const row: (string | number)[] = [dateStr, dayName, ffName]

    for (const plan of planNames) {
      const planInfo = ALL_MEAL_PLANS.find(m => m.name === plan)
      const pp = planInfo?.price ?? 3500
      const meal = mealPlanMeals[plan]?.find(m => m.date === dateStr)
      const comp = meal?.compositions[pp]
      const targetCost = mealPlanTargetCosts[plan] ?? MEAL_PLAN_COST_CONFIGS.find(c => c.mealPlanName === plan)?.defaultCost ?? 0

      if (!comp) {
        row.push('-', '-')
        continue
      }

      // 구성품 텍스트
      const parts: string[] = []
      if (comp.drink) parts.push(`음료: ${comp.drink.name}`)
      comp.desserts.forEach((d, i) => parts.push(`디저트${i + 1}: ${d.name}`))
      row.push(parts.join(' / '))

      // 원가
      const { diff, isOver } = getCostDiff(comp.totalCost, targetCost)
      const diffStr = diff === 0 ? '±0' : isOver ? `+${diff}` : `${diff}`
      row.push(`${comp.totalCost}원 (${diffStr})`)
    }

    row.push(`${week}주차`)
    aoa.push(row)
  }

  aoa.push([])

  // 주차별 평균원가 요약
  aoa.push(['[주차별 평균 원가 요약]'])
  const weekStats = computeWeeklyStats(planNames, mealPlanMeals, mealPlanTargetCosts, dates)
  const weekHeader = ['주차', ...planNames.map(p => `${p} 평균원가`), ...planNames.map(p => `${p} 목표원가`)]
  aoa.push(weekHeader)
  for (const [week, stats] of Object.entries(weekStats)) {
    const row: (string | number)[] = [`${week}주차`]
    for (const plan of planNames) {
      row.push(stats[plan]?.avg ?? '-')
    }
    for (const plan of planNames) {
      row.push(stats[plan]?.target ?? '-')
    }
    aoa.push(row)
  }

  aoa.push([])

  // 총괄 원가 대시보드
  aoa.push(['[총괄 원가 대시보드]'])
  aoa.push(['식단', '운영일수', '목표원가', '평균원가', '원가대비', '총원가'])
  for (const plan of planNames) {
    const summary = computePlanSummary(plan, mealPlanMeals, mealPlanTargetCosts, dates)
    const planInfo = ALL_MEAL_PLANS.find(m => m.name === plan)
    const pp = planInfo?.price ?? 3500
    const activeDates = dates.filter(d => mealPlanMeals[plan]?.find(m => m.date === toDateStr(d))?.compositions[pp])
    aoa.push([
      plan,
      activeDates.length,
      summary.target,
      summary.avg,
      summary.diff >= 0 ? `+${summary.diff}원 초과` : `${summary.diff}원 절감`,
      summary.total
    ])
  }

  return XLSX.utils.aoa_to_sheet(aoa)
}

// 공장용 시트 빌드 (D-1 shift)
function buildFactorySheet(
  planNames: string[],
  mealPlanMeals: MealPlanDailyMeals,
  mealPlanTargetCosts: MealPlanTargetCosts,
  startDate: Date,
  endDate: Date
): XLSX.WorkSheet {
  const dates = getDatesInRange(startDate, endDate)
  const aoa: (string | number)[][] = []

  const firstPlan = planNames[0]
  const ffType = firstPlan.replace(/[\d.]+$/, '')

  aoa.push([`밀박스25 ${ffType} 공장 생산 식단표`, '', '', '', '', '', '', '', ''])
  aoa.push([`※ 모든 날짜는 생산 기준일(D-1) 기준입니다.`])
  aoa.push([`고객 수령 기간: ${formatDate(startDate)} ~ ${formatDate(endDate)}`])
  aoa.push([])

  const header = ['생산기준일(D-1)', '출고예정일(D-Day)', '요일(출고)', 'FF명']
  for (const plan of planNames) {
    const targetCost = mealPlanTargetCosts[plan] ?? MEAL_PLAN_COST_CONFIGS.find(c => c.mealPlanName === plan)?.defaultCost ?? 0
    header.push(`${plan} 구성품`, `원가(목표:${targetCost}원)`)
  }
  header.push('주차')
  aoa.push(header)

  for (const date of dates) {
    const dateStr = toDateStr(date)
    // D-1: 생산일은 출고일 하루 전
    const productionDate = new Date(date)
    productionDate.setDate(productionDate.getDate() - 1)
    const productionDateStr = toDateStr(productionDate)
    const dayName = DAY_NAMES[date.getDay()]
    const week = getWeekOfMonth(dateStr)

    const firstMeal = mealPlanMeals[planNames[0]]?.find(m => m.date === dateStr)
    const pricePoint = ALL_MEAL_PLANS.find(m => m.name === planNames[0])?.price ?? 3500
    const firstComp = firstMeal?.compositions[pricePoint]
    const ffName = firstComp?.ff?.name ?? '-'

    const row: (string | number)[] = [productionDateStr, dateStr, dayName, ffName]

    for (const plan of planNames) {
      const planInfo = ALL_MEAL_PLANS.find(m => m.name === plan)
      const pp = planInfo?.price ?? 3500
      const meal = mealPlanMeals[plan]?.find(m => m.date === dateStr)
      const comp = meal?.compositions[pp]
      const targetCost = mealPlanTargetCosts[plan] ?? MEAL_PLAN_COST_CONFIGS.find(c => c.mealPlanName === plan)?.defaultCost ?? 0

      if (!comp) {
        row.push('-', '-')
        continue
      }

      const parts: string[] = []
      if (comp.drink) parts.push(`음료: ${comp.drink.name}`)
      comp.desserts.forEach((d, i) => parts.push(`디저트${i + 1}: ${d.name}`))
      row.push(parts.join(' / '))

      const { diff, isOver } = getCostDiff(comp.totalCost, targetCost)
      const diffStr = diff === 0 ? '±0' : isOver ? `+${diff}` : `${diff}`
      row.push(`${comp.totalCost}원 (${diffStr})`)
    }

    row.push(`${week}주차`)
    aoa.push(row)
  }

  aoa.push([])

  // 주차별 평균원가 요약
  aoa.push(['[주차별 평균 원가 요약]'])
  const weekStats = computeWeeklyStats(planNames, mealPlanMeals, mealPlanTargetCosts, dates)
  const weekHeader = ['주차', ...planNames.map(p => `${p} 평균원가`), ...planNames.map(p => `${p} 목표원가`)]
  aoa.push(weekHeader)
  for (const [week, stats] of Object.entries(weekStats)) {
    const row: (string | number)[] = [`${week}주차`]
    for (const plan of planNames) {
      row.push(stats[plan]?.avg ?? '-')
    }
    for (const plan of planNames) {
      row.push(stats[plan]?.target ?? '-')
    }
    aoa.push(row)
  }

  aoa.push([])

  // 총괄 원가 대시보드
  aoa.push(['[총괄 원가 대시보드]'])
  aoa.push(['식단', '운영일수', '목표원가', '평균원가', '원가대비', '총원가'])
  for (const plan of planNames) {
    const summary = computePlanSummary(plan, mealPlanMeals, mealPlanTargetCosts, dates)
    const planInfo = ALL_MEAL_PLANS.find(m => m.name === plan)
    const pp = planInfo?.price ?? 3500
    const activeDates = dates.filter(d => mealPlanMeals[plan]?.find(m => m.date === toDateStr(d))?.compositions[pp])
    aoa.push([
      plan,
      activeDates.length,
      summary.target,
      summary.avg,
      summary.diff >= 0 ? `+${summary.diff}원 초과` : `${summary.diff}원 절감`,
      summary.total
    ])
  }

  return XLSX.utils.aoa_to_sheet(aoa)
}

// 주차별 통계 계산
function computeWeeklyStats(
  planNames: string[],
  mealPlanMeals: MealPlanDailyMeals,
  mealPlanTargetCosts: MealPlanTargetCosts,
  dates: Date[]
): Record<number, Record<string, { avg: number; target: number }>> {
  const stats: Record<number, Record<string, { sum: number; count: number; target: number }>> = {}

  for (const date of dates) {
    const dateStr = toDateStr(date)
    const week = getWeekOfMonth(dateStr)
    if (!stats[week]) stats[week] = {}

    for (const plan of planNames) {
      const planInfo = ALL_MEAL_PLANS.find(m => m.name === plan)
      const pp = planInfo?.price ?? 3500
      const meal = mealPlanMeals[plan]?.find(m => m.date === dateStr)
      const comp = meal?.compositions[pp]
      if (!comp) continue

      const target = mealPlanTargetCosts[plan] ?? MEAL_PLAN_COST_CONFIGS.find(c => c.mealPlanName === plan)?.defaultCost ?? 0

      if (!stats[week][plan]) stats[week][plan] = { sum: 0, count: 0, target }
      stats[week][plan].sum += comp.totalCost
      stats[week][plan].count += 1
    }
  }

  const result: Record<number, Record<string, { avg: number; target: number }>> = {}
  for (const [week, planStats] of Object.entries(stats)) {
    result[Number(week)] = {}
    for (const [plan, s] of Object.entries(planStats)) {
      result[Number(week)][plan] = {
        avg: s.count > 0 ? Math.round(s.sum / s.count) : 0,
        target: s.target
      }
    }
  }
  return result
}

// 식단별 총괄 통계 계산
function computePlanSummary(
  plan: string,
  mealPlanMeals: MealPlanDailyMeals,
  mealPlanTargetCosts: MealPlanTargetCosts,
  dates: Date[]
): { avg: number; target: number; diff: number; total: number } {
  const planInfo = ALL_MEAL_PLANS.find(m => m.name === plan)
  const pp = planInfo?.price ?? 3500
  const target = mealPlanTargetCosts[plan] ?? MEAL_PLAN_COST_CONFIGS.find(c => c.mealPlanName === plan)?.defaultCost ?? 0

  let sum = 0
  let count = 0

  for (const date of dates) {
    const dateStr = toDateStr(date)
    const meal = mealPlanMeals[plan]?.find(m => m.date === dateStr)
    const comp = meal?.compositions[pp]
    if (!comp) continue
    sum += comp.totalCost
    count++
  }

  const avg = count > 0 ? Math.round(sum / count) : 0
  return {
    avg,
    target,
    diff: avg - target,
    total: sum
  }
}

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}
