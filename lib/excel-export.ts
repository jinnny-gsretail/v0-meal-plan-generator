import * as XLSX from 'xlsx'
import { MealPlanDailyMeals, MealPlanTargetCosts, DosirakSets, FreeFormatData } from './store'
import { ALL_MEAL_PLANS, MEAL_PLAN_COST_CONFIGS } from './types'

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']
const WEEKDAY_HEADERS = ['월', '화', '수', '목', '금', '토', '일']

// ─────────────────────────────────────────────────────────────────────────────
// 유틸리티 함수
// ─────────────────────────────────────────────────────────────────────────────

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDateShort(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function getDatesInRange(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = []
  const cur = new Date(startDate)
  while (cur <= endDate) {
    dates.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

// 주차별로 날짜 그룹화 (월요일 시작 기준)
function groupByWeek(dates: Date[]): Date[][] {
  if (dates.length === 0) return []
  
  const weeks: Date[][] = []
  let currentWeek: Date[] = []
  
  for (const date of dates) {
    const dayOfWeek = date.getDay()
    // 월요일(1)이면 새 주 시작
    if (dayOfWeek === 1 && currentWeek.length > 0) {
      weeks.push(currentWeek)
      currentWeek = []
    }
    currentWeek.push(date)
  }
  
  if (currentWeek.length > 0) {
    weeks.push(currentWeek)
  }
  
  return weeks
}

// 셀 스타일 적용을 위한 워크시트 확장
function applyColumnWidths(ws: XLSX.WorkSheet, widths: number[]) {
  ws['!cols'] = widths.map(w => ({ wch: w }))
}

function applyRowHeights(ws: XLSX.WorkSheet, heights: { [row: number]: number }) {
  ws['!rows'] = []
  for (const [row, height] of Object.entries(heights)) {
    ws['!rows'][Number(row)] = { hpt: height }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 고객용 식단표 다운로드 (원가 비공개 & 디자인 최적화)
// ─────────────────────────────────────────────────────────────────────────────

export function downloadCustomerExcel(
  mealPlanMeals: MealPlanDailyMeals,
  mealPlanTargetCosts: MealPlanTargetCosts,
  startDate: Date,
  endDate: Date,
  dosirakSets?: DosirakSets,
  freeFormatData?: FreeFormatData
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
    { label: '바)공장박스', plans: ['공장박스'] },
  ]

  for (const group of mealGroups) {
    const ws = buildCustomerCalendarSheet(group.plans, mealPlanMeals, startDate, endDate)
    XLSX.utils.book_append_sheet(wb, ws, group.label)
  }
  
  // 도시락 시트
  if (dosirakSets && Object.keys(dosirakSets).length > 0) {
    const dosirakWs = buildDosirakCustomerSheet(dosirakSets)
    XLSX.utils.book_append_sheet(wb, dosirakWs, '마)도시락')
  }

  // 프리포맷 시트
  if (freeFormatData && Object.keys(freeFormatData).length > 0) {
    const freeWs = buildFreeFormatCustomerSheet(freeFormatData, startDate, endDate)
    XLSX.utils.book_append_sheet(wb, freeWs, '사)프리포맷')
  }

  const month = `${startDate.getFullYear()}년${String(startDate.getMonth() + 1).padStart(2, '0')}월`
  XLSX.writeFile(wb, `밀박스25_고객식단표_${month}.xlsx`)
}

// 고객용 캘린더 시트 (7열 그리드, 원가 없음)
function buildCustomerCalendarSheet(
  planNames: string[],
  mealPlanMeals: MealPlanDailyMeals,
  startDate: Date,
  endDate: Date
): XLSX.WorkSheet {
  const dates = getDatesInRange(startDate, endDate)
  const weeks = groupByWeek(dates)
  const aoa: (string | number)[][] = []

  // 제목
  const firstPlan = planNames[0]
  const ffType = firstPlan.replace(/[\d.]+\(음X\)$/, '').replace(/[\d.]+$/, '')
  aoa.push([`밀박스25 ${ffType} 식단표`])
  aoa.push([`기간: ${toDateStr(startDate)} ~ ${toDateStr(endDate)}`])
  aoa.push([])

  // 각 식단별 캘린더
  for (const planName of planNames) {
    const planInfo = ALL_MEAL_PLANS.find(m => m.name === planName)
    const pricePoint = planInfo?.price ?? 3500

    aoa.push([`[ ${planName} ]`])
    aoa.push([])

    // 요일 헤더
    aoa.push(WEEKDAY_HEADERS)

    // 주차별 행 생성
    for (const weekDates of weeks) {
      // 날짜 행
      const dateRow: string[] = Array(7).fill('')
      // 내용 행 (FF + 구성품)
      const contentRows: string[][] = [
        Array(7).fill(''), // FF
        Array(7).fill(''), // 음료/디저트1
        Array(7).fill(''), // 디저트2
        Array(7).fill(''), // 디저트3 (여유분)
      ]

      for (const date of weekDates) {
        // 월요일=0, 화=1, ..., 일=6 (WEEKDAY_HEADERS 순서에 맞춤)
        let colIdx = date.getDay() - 1
        if (colIdx < 0) colIdx = 6 // 일요일은 마지막

        dateRow[colIdx] = formatDateShort(date)

        const dateStr = toDateStr(date)
        const meal = mealPlanMeals[planName]?.find(m => m.date === dateStr)
        const comp = meal?.compositions[pricePoint]

        if (comp) {
          // FF (볼드 표시를 위해 ★ 마킹)
          contentRows[0][colIdx] = comp.ff?.name ? `★ ${comp.ff.name}` : ''
          // 음료
          if (comp.drink) {
            contentRows[1][colIdx] = comp.drink.name
          }
          // 디저트들
          comp.desserts.forEach((d, i) => {
            if (i + 1 < contentRows.length) {
              contentRows[i + 1][colIdx] = contentRows[i + 1][colIdx] 
                ? `${contentRows[i + 1][colIdx]} / ${d.name}` 
                : d.name
            } else if (i === 0 && !comp.drink) {
              // 음료 없는 경우 디저트가 음료 자리에
              contentRows[1][colIdx] = d.name
            }
          })
        }
      }

      aoa.push(dateRow)
      for (const row of contentRows) {
        // 빈 행은 건너뛰기
        if (row.some(cell => cell !== '')) {
          aoa.push(row)
        }
      }
      aoa.push(Array(7).fill('')) // 주차 구분 빈 행
    }

    aoa.push([])
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  applyColumnWidths(ws, [15, 15, 15, 15, 15, 15, 15])
  return ws
}

// 도시락 고객용 시트 (원가 없음)
function buildDosirakCustomerSheet(dosirakSets: DosirakSets): XLSX.WorkSheet {
  const aoa: (string | number)[][] = []

  aoa.push(['밀박스25 도시락 식단표 - 5개 고정 조합'])
  aoa.push(['※ 도시락은 날짜와 무관하게 5개 고정 조합으로 운영됩니다.'])
  aoa.push([])

  const pricePoints = [4500, 5500, 6500]
  const planNames = ['도시락4.5', '도시락5.5', '도시락6.5']

  for (let i = 0; i < pricePoints.length; i++) {
    const pp = pricePoints[i]
    const planName = planNames[i]
    const sets = dosirakSets[pp] || []

    aoa.push([`[ ${planName} ]`])
    aoa.push(['조합', '도시락', '음료', '디저트'])

    for (const set of sets) {
      const dessertNames = set.desserts.map(d => d.name).join(', ') || '-'
      aoa.push([
        `조합 ${set.setNumber}`,
        set.ff?.name || '-',
        set.drink?.name || '-',
        dessertNames
      ])
    }
    aoa.push([])
  }

  return XLSX.utils.aoa_to_sheet(aoa)
}

// 프리포맷 고객용 시트 (원가 없음)
function buildFreeFormatCustomerSheet(
  freeFormatData: FreeFormatData,
  startDate: Date,
  endDate: Date
): XLSX.WorkSheet {
  const dates = getDatesInRange(startDate, endDate)
  const weeks = groupByWeek(dates)
  const aoa: (string | number)[][] = []

  aoa.push(['밀박스25 프리포맷 식단표'])
  aoa.push(['※ 자유 구성 식단'])
  aoa.push([])

  // 요일 헤더
  aoa.push(WEEKDAY_HEADERS)

  for (const weekDates of weeks) {
    const dateRow: string[] = Array(7).fill('')
    const slotRows: string[][] = Array.from({ length: 5 }, () => Array(7).fill(''))

    for (const date of weekDates) {
      let colIdx = date.getDay() - 1
      if (colIdx < 0) colIdx = 6

      dateRow[colIdx] = formatDateShort(date)

      const dateStr = toDateStr(date)
      const dayData = freeFormatData[dateStr]
      const slots = dayData?.slots ?? []

      slots.forEach((slot, i) => {
        if (i < 5) {
          slotRows[i][colIdx] = slot.customText ?? slot.product?.name ?? ''
        }
      })
    }

    aoa.push(dateRow)
    for (const row of slotRows) {
      if (row.some(cell => cell !== '')) {
        aoa.push(row)
      }
    }
    aoa.push(Array(7).fill(''))
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  applyColumnWidths(ws, [15, 15, 15, 15, 15, 15, 15])
  return ws
}

// ─────────────────────────────────────────────────────────────────────────────
// 공장용 식단표 다운로드 (생산 지시 & 원가/합계 데이터 통합)
// ─────────────────────────────────────────────────────────────────────────────

export function downloadFactoryExcel(
  mealPlanMeals: MealPlanDailyMeals,
  mealPlanTargetCosts: MealPlanTargetCosts,
  startDate: Date,
  endDate: Date,
  dosirakSets?: DosirakSets,
  freeFormatData?: FreeFormatData
) {
  const wb = XLSX.utils.book_new()

  const mealGroups = [
    { label: '가)김밥_공장', plans: ['김밥3.5', '김밥4.5', '김밥5.5'] },
    { label: '가-1)김밥(음X)_공장', plans: ['김밥3.5(음X)'] },
    { label: '나)삼각_공장', plans: ['삼각3.5', '삼각4.5'] },
    { label: '나-1)삼각(음X)_공장', plans: ['삼각3.5(음X)'] },
    { label: '다)샌드_공장', plans: ['샌드3.5', '샌드4.5', '샌드5.5'] },
    { label: '다-1)샌드(음X)_공장', plans: ['샌드3.5(음X)'] },
    { label: '라)버거_공장', plans: ['버거3.5', '버거4.5', '버거5.5'] },
    { label: '바)공장박스_공장', plans: ['공장박스'] },
  ]

  for (const group of mealGroups) {
    const ws = buildFactoryCalendarSheet(group.plans, mealPlanMeals, mealPlanTargetCosts, startDate, endDate)
    XLSX.utils.book_append_sheet(wb, ws, group.label)
  }
  
  // 도시락 시트
  if (dosirakSets && Object.keys(dosirakSets).length > 0) {
    const dosirakWs = buildDosirakFactorySheet(dosirakSets, mealPlanTargetCosts)
    XLSX.utils.book_append_sheet(wb, dosirakWs, '마)도시락_공장')
  }

  // 프리포맷 시트
  if (freeFormatData && Object.keys(freeFormatData).length > 0) {
    const freeWs = buildFreeFormatFactorySheet(freeFormatData, startDate, endDate)
    XLSX.utils.book_append_sheet(wb, freeWs, '사)프리포맷_공장')
  }

  const month = `${startDate.getFullYear()}년${String(startDate.getMonth() + 1).padStart(2, '0')}월`
  XLSX.writeFile(wb, `밀박스25_공장식단표_${month}.xlsx`)
}

// 공장용 캘린더 시트 (7열 그리드 + 원가 + 주차별 평균)
function buildFactoryCalendarSheet(
  planNames: string[],
  mealPlanMeals: MealPlanDailyMeals,
  mealPlanTargetCosts: MealPlanTargetCosts,
  startDate: Date,
  endDate: Date
): XLSX.WorkSheet {
  const dates = getDatesInRange(startDate, endDate)
  const weeks = groupByWeek(dates)
  const aoa: (string | number)[][] = []

  // 제목
  const firstPlan = planNames[0]
  const ffType = firstPlan.replace(/[\d.]+\(음X\)$/, '').replace(/[\d.]+$/, '')
  aoa.push([`밀박스25 ${ffType} 공장 식단표 [생산일 기준: D-1]`])
  aoa.push([`기간: ${toDateStr(startDate)} ~ ${toDateStr(endDate)}`])
  aoa.push([])

  // 각 식단별 캘린더
  for (const planName of planNames) {
    const planInfo = ALL_MEAL_PLANS.find(m => m.name === planName)
    const pricePoint = planInfo?.price ?? 3500
    const targetCost = mealPlanTargetCosts[planName] ?? MEAL_PLAN_COST_CONFIGS.find(c => c.mealPlanName === planName)?.defaultCost ?? 0

    aoa.push([`[ ${planName} ] 목표원가: ${targetCost}원`])
    aoa.push([])

    // 요일 헤더 + 주차 평균 열
    aoa.push([...WEEKDAY_HEADERS, '주차 평균'])

    let weekNumber = 1
    const weeklyTotals: { sum: number; count: number }[] = []

    // 주차별 행 생성
    for (const weekDates of weeks) {
      let weekSum = 0
      let weekCount = 0

      // 날짜 행 (D-1 기준)
      const dateRow: string[] = Array(7).fill('')
      // 배송일 행
      const deliveryRow: string[] = Array(7).fill('')
      // 내용 행들
      const ffRow: string[] = Array(7).fill('')
      const ffCostRow: string[] = Array(7).fill('')
      const drinkRow: string[] = Array(7).fill('')
      const drinkCostRow: string[] = Array(7).fill('')
      const dessertRow: string[] = Array(7).fill('')
      const dessertCostRow: string[] = Array(7).fill('')
      const totalRow: string[] = Array(7).fill('')

      for (const date of weekDates) {
        let colIdx = date.getDay() - 1
        if (colIdx < 0) colIdx = 6

        // D-1 기준: 생산일 = 배송일 - 1
        const productionDate = new Date(date)
        productionDate.setDate(productionDate.getDate() - 1)

        dateRow[colIdx] = `생산: ${formatDateShort(productionDate)}`
        deliveryRow[colIdx] = `배송: ${formatDateShort(date)}`

        const dateStr = toDateStr(date)
        const meal = mealPlanMeals[planName]?.find(m => m.date === dateStr)
        const comp = meal?.compositions[pricePoint]

        if (comp) {
          ffRow[colIdx] = comp.ff?.name ?? '-'
          ffCostRow[colIdx] = comp.ff ? `${comp.ff.cost}원` : ''

          if (comp.drink) {
            drinkRow[colIdx] = comp.drink.name
            drinkCostRow[colIdx] = `${comp.drink.cost}원`
          }

          const dessertNames = comp.desserts.map(d => d.name).join(' / ')
          const dessertCost = comp.desserts.reduce((s, d) => s + d.cost, 0)
          dessertRow[colIdx] = dessertNames || '-'
          dessertCostRow[colIdx] = dessertCost > 0 ? `${dessertCost}원` : ''

          // 합계 (초과 시 [초과] 표기)
          const isOver = comp.totalCost > targetCost * 1.03
          totalRow[colIdx] = isOver 
            ? `[초과] ${comp.totalCost}원` 
            : `${comp.totalCost}원`

          weekSum += comp.totalCost
          weekCount++
        }
      }

      // 주차 평균 계산
      const weekAvg = weekCount > 0 ? Math.round(weekSum / weekCount) : 0
      weeklyTotals.push({ sum: weekSum, count: weekCount })

      aoa.push([...dateRow, `${weekNumber}주차`])
      aoa.push([...deliveryRow, ''])
      aoa.push([...ffRow, ''])
      aoa.push([...ffCostRow, ''])
      if (drinkRow.some(c => c !== '')) {
        aoa.push([...drinkRow, ''])
        aoa.push([...drinkCostRow, ''])
      }
      if (dessertRow.some(c => c !== '')) {
        aoa.push([...dessertRow, ''])
        aoa.push([...dessertCostRow, ''])
      }
      aoa.push([...totalRow, weekCount > 0 ? `평균: ${weekAvg}원` : ''])
      aoa.push(Array(8).fill('')) // 주차 구분

      weekNumber++
    }

    // 총괄 요약
    const totalSum = weeklyTotals.reduce((s, w) => s + w.sum, 0)
    const totalCount = weeklyTotals.reduce((s, w) => s + w.count, 0)
    const totalAvg = totalCount > 0 ? Math.round(totalSum / totalCount) : 0
    const diff = totalAvg - targetCost

    aoa.push(['[총괄 요약]'])
    aoa.push(['운영일수', totalCount, '목표원가', targetCost, '평균원가', totalAvg, '원가차이', diff >= 0 ? `+${diff}원` : `${diff}원`])
    aoa.push([])
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  applyColumnWidths(ws, [18, 18, 18, 18, 18, 18, 18, 12])
  return ws
}

// 도시락 공장용 시트 (원가 포함)
function buildDosirakFactorySheet(
  dosirakSets: DosirakSets,
  mealPlanTargetCosts: MealPlanTargetCosts
): XLSX.WorkSheet {
  const aoa: (string | number)[][] = []

  aoa.push(['밀박스25 도시락 공장 식단표 - 5개 고정 조합'])
  aoa.push(['※ 상시 생산 품목 (날짜 무관)'])
  aoa.push([])

  const pricePoints = [4500, 5500, 6500]
  const planNames = ['도시락4.5', '도시락5.5', '도시락6.5']

  for (let i = 0; i < pricePoints.length; i++) {
    const pp = pricePoints[i]
    const planName = planNames[i]
    const sets = dosirakSets[pp] || []
    const target = mealPlanTargetCosts[planName] ?? MEAL_PLAN_COST_CONFIGS.find(c => c.mealPlanName === planName)?.defaultCost ?? 0

    aoa.push([`[ ${planName} ] 목표원가: ${target}원`])
    aoa.push(['조합', '도시락', '단가', '음료', '단가', '디저트', '단가', '세트 합계', '목표대비'])

    for (const set of sets) {
      const dessertNames = set.desserts.map(d => d.name).join(', ') || '-'
      const dessertCost = set.desserts.reduce((s, d) => s + d.cost, 0)
      const diff = set.totalCost - target
      const isOver = set.totalCost > target * 1.03

      aoa.push([
        `조합 ${set.setNumber}`,
        set.ff?.name || '-',
        set.ff?.cost ?? 0,
        set.drink?.name || '-',
        set.drink?.cost ?? 0,
        dessertNames,
        dessertCost,
        set.totalCost,
        isOver ? `[초과] +${diff}원` : (diff >= 0 ? `+${diff}원` : `${diff}원`)
      ])
    }

    // 평균 원가
    if (sets.length > 0) {
      const avg = Math.round(sets.reduce((s, set) => s + set.totalCost, 0) / sets.length)
      const total = sets.reduce((s, set) => s + set.totalCost, 0)
      const avgDiff = avg - target
      aoa.push([])
      aoa.push(['', '', '', '', '', '', '평균', avg, avgDiff >= 0 ? `+${avgDiff}원` : `${avgDiff}원`])
    }
    aoa.push([])
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  applyColumnWidths(ws, [10, 15, 8, 12, 8, 20, 8, 10, 12])
  return ws
}

// 프리포맷 공장용 시트 (D-1 + 원가)
function buildFreeFormatFactorySheet(
  freeFormatData: FreeFormatData,
  startDate: Date,
  endDate: Date
): XLSX.WorkSheet {
  const dates = getDatesInRange(startDate, endDate)
  const weeks = groupByWeek(dates)
  const aoa: (string | number)[][] = []

  aoa.push(['밀박스25 프리포맷 공장 식단표 [생산일 기준: D-1]'])
  aoa.push(['※ 자유 구성 식단'])
  aoa.push([])

  // 요일 헤더
  aoa.push([...WEEKDAY_HEADERS, '주차 평균'])

  let weekNumber = 1

  for (const weekDates of weeks) {
    let weekSum = 0
    let weekCount = 0

    const dateRow: string[] = Array(7).fill('')
    const deliveryRow: string[] = Array(7).fill('')
    const slotRows: string[][] = Array.from({ length: 5 }, () => Array(7).fill(''))
    const costRows: string[][] = Array.from({ length: 5 }, () => Array(7).fill(''))
    const totalRow: string[] = Array(7).fill('')

    for (const date of weekDates) {
      let colIdx = date.getDay() - 1
      if (colIdx < 0) colIdx = 6

      const productionDate = new Date(date)
      productionDate.setDate(productionDate.getDate() - 1)

      dateRow[colIdx] = `생산: ${formatDateShort(productionDate)}`
      deliveryRow[colIdx] = `배송: ${formatDateShort(date)}`

      const dateStr = toDateStr(date)
      const dayData = freeFormatData[dateStr]
      const slots = dayData?.slots ?? []
      const totalCost = slots.reduce((s, sl) => s + sl.cost, 0)

      slots.forEach((slot, i) => {
        if (i < 5) {
          slotRows[i][colIdx] = slot.customText ?? slot.product?.name ?? ''
          costRows[i][colIdx] = slot.cost > 0 ? `${slot.cost}원` : ''
        }
      })

      if (totalCost > 0) {
        totalRow[colIdx] = `합계: ${totalCost}원`
        weekSum += totalCost
        weekCount++
      }
    }

    const weekAvg = weekCount > 0 ? Math.round(weekSum / weekCount) : 0

    aoa.push([...dateRow, `${weekNumber}주차`])
    aoa.push([...deliveryRow, ''])
    for (let i = 0; i < 5; i++) {
      if (slotRows[i].some(c => c !== '')) {
        aoa.push([...slotRows[i], ''])
        if (costRows[i].some(c => c !== '')) {
          aoa.push([...costRows[i], ''])
        }
      }
    }
    aoa.push([...totalRow, weekCount > 0 ? `평균: ${weekAvg}원` : ''])
    aoa.push(Array(8).fill(''))

    weekNumber++
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  applyColumnWidths(ws, [18, 18, 18, 18, 18, 18, 18, 12])
  return ws
}
