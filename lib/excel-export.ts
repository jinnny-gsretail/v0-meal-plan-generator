import * as XLSX from 'xlsx'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { MealPlanDailyMeals, MealPlanTargetCosts, DosirakSets, FreeFormatData } from './store'
import { ALL_MEAL_PLANS, MEAL_PLAN_COST_CONFIGS } from './types'

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']
const WEEKDAY_HEADERS = ['월', '화', '수', '목', '금', '토', '일']

// ─────────────────────────────────────────────────────────────────────────────
// 한국 공휴일 정의 (2026년 기준)
// ─────────────────────────────────────────────────────────────────────────────
const KR_HOLIDAYS_2026: string[] = [
  '2026-01-01', // 신정
  '2026-02-16', '2026-02-17', '2026-02-18', // 설날
  '2026-03-01', '2026-03-02', // 삼일절 + 대체
  '2026-05-05', // 어린이날
  '2026-05-24', '2026-05-25', // 석가탄신일 + 대체
  '2026-06-06', // 현충일
  '2026-08-15', '2026-08-17', // 광복절 + 대체
  '2026-09-24', '2026-09-25', '2026-09-26', // 추석
  '2026-10-03', '2026-10-05', // 개천절 + 대체
  '2026-10-09', // 한글날
  '2026-12-25', // 크리스마스
]

function isKRHoliday(date: Date): boolean {
  const dateStr = toDateStr(date)
  return KR_HOLIDAYS_2026.includes(dateStr)
}

function isSunday(date: Date): boolean {
  return date.getDay() === 0
}

function isSaturday(date: Date): boolean {
  return date.getDay() === 6
}

function isHolidayOrSunday(date: Date): boolean {
  return isSunday(date) || isKRHoliday(date)
}

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

// ─────────────────────────────────────────────────────────────────────────────
// 색상 정의
// ─────────────────────────────────────────────────────────────────────────────
const COLORS = {
  black: { argb: 'FF000000' },
  blue: { argb: 'FF0000FF' },
  red: { argb: 'FFFF0000' },
  weekdayBg: { argb: 'FFF2F2F2' },
  saturdayBg: { argb: 'FFE6F0FF' },
  sundayHolidayBg: { argb: 'FFFFECEC' },
  white: { argb: 'FFFFFFFF' },
}

// ─────────────────────────────────────────────────────────────────────────────
// 고객용 식단표 다운로드 (ExcelJS - RichText 및 스타일 지원)
// ─────────────────────────────────────────────────────────────────────────────

export async function downloadCustomerExcel(
  mealPlanMeals: MealPlanDailyMeals,
  mealPlanTargetCosts: MealPlanTargetCosts,
  startDate: Date,
  endDate: Date,
  dosirakSets?: DosirakSets,
  freeFormatData?: FreeFormatData
) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = '밀박스25'
  workbook.created = new Date()

  // 식단별 개별 시트 생성 (데이터가 있는 식단만)
  const allPlans = [
    '김밥3.5', '김밥4.5', '김밥5.5',
    '김밥3.5(음X)',
    '삼각3.5', '삼각4.5',
    '삼각3.5(음X)',
    '샌드3.5', '샌드4.5', '샌드5.5',
    '샌드3.5(음X)',
    '버거3.5', '버거4.5', '버거5.5',
    '공장박스'
  ]

  for (const planName of allPlans) {
    if (mealPlanMeals[planName] && mealPlanMeals[planName].length > 0) {
      buildCustomerCalendarSheet(workbook, planName, mealPlanMeals, startDate, endDate)
    }
  }
  
  // 도시락 시트 (가격대별)
  if (dosirakSets && Object.keys(dosirakSets).length > 0) {
    const pricePoints = [4500, 5500, 6500]
    for (const pp of pricePoints) {
      if (dosirakSets[pp] && dosirakSets[pp].length > 0) {
        buildDosirakCustomerSheet(workbook, dosirakSets[pp], pp)
      }
    }
  }

  // 프리포맷 시트
  if (freeFormatData && Object.keys(freeFormatData).length > 0) {
    buildFreeFormatCustomerSheet(workbook, freeFormatData, startDate, endDate)
  }

  // 파일명: [고객사용]_식단표_YYYYMMDD_YYYYMMDD.xlsx
  const startStr = `${startDate.getFullYear()}${String(startDate.getMonth() + 1).padStart(2, '0')}${String(startDate.getDate()).padStart(2, '0')}`
  const endStr = `${endDate.getFullYear()}${String(endDate.getMonth() + 1).padStart(2, '0')}${String(endDate.getDate()).padStart(2, '0')}`
  const fileName = `[고객사용]_식단표_${startStr}_${endStr}.xlsx`

  // 다운로드
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  saveAs(blob, fileName)
}

// 고객용 캘린더 시트 빌더 (ExcelJS)
function buildCustomerCalendarSheet(
  workbook: ExcelJS.Workbook,
  planName: string,
  mealPlanMeals: MealPlanDailyMeals,
  startDate: Date,
  endDate: Date
) {
  const safeSheetName = planName.replace(/[()]/g, '').substring(0, 31)
  const worksheet = workbook.addWorksheet(safeSheetName)

  const dates = getDatesInRange(startDate, endDate)
  const weeks = groupByWeek(dates)

  const planInfo = ALL_MEAL_PLANS.find(m => m.name === planName)
  const pricePoint = planInfo?.price ?? 3500

  // 열 너비 고정 (35)
  for (let i = 1; i <= 7; i++) {
    worksheet.getColumn(i).width = 35
  }

  // 제목 행
  const titleRow = worksheet.addRow([`${planName} 식단표`])
  titleRow.font = { bold: true, size: 16 }
  worksheet.mergeCells(1, 1, 1, 7)
  titleRow.alignment = { horizontal: 'center', vertical: 'middle' }

  // 기간 행
  const periodRow = worksheet.addRow([`기간: ${toDateStr(startDate)} ~ ${toDateStr(endDate)}`])
  worksheet.mergeCells(2, 1, 2, 7)
  periodRow.alignment = { horizontal: 'center', vertical: 'middle' }

  // 빈 행
  worksheet.addRow([])

  // 요일 헤더 행
  const headerRow = worksheet.addRow(WEEKDAY_HEADERS)
  headerRow.height = 25

  // 요일 헤더 스타일링
  for (let col = 1; col <= 7; col++) {
    const cell = headerRow.getCell(col)
    cell.font = { bold: true, size: 11 }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    }

    if (col === 6) {
      // 토요일
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: COLORS.saturdayBg }
      cell.font = { bold: true, size: 11, color: COLORS.blue }
    } else if (col === 7) {
      // 일요일
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: COLORS.sundayHolidayBg }
      cell.font = { bold: true, size: 11, color: COLORS.red }
    } else {
      // 평일
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: COLORS.weekdayBg }
    }
  }

  // 주차별 데이터 행 생성
  for (const weekDates of weeks) {
    const dataRow = worksheet.addRow(Array(7).fill(''))
    dataRow.height = 105 // 행 높이 고정

    for (const date of weekDates) {
      let colIdx = date.getDay() - 1
      if (colIdx < 0) colIdx = 6
      const col = colIdx + 1

      const cell = dataRow.getCell(col)

      // 셀 스타일
      cell.alignment = { 
        horizontal: 'center', 
        vertical: 'middle', 
        wrapText: true 
      }
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: COLORS.white }

      // 메뉴 데이터 가져오기
      const dateStr = toDateStr(date)
      const meal = mealPlanMeals[planName]?.find(m => m.date === dateStr)
      const comp = meal?.compositions[pricePoint]

      // 날짜 색상 결정
      let dateColor = COLORS.black
      if (isHolidayOrSunday(date)) {
        dateColor = COLORS.red
      } else if (isSaturday(date)) {
        dateColor = COLORS.blue
      }

      // RichText 구성: 날짜(색상) + 줄바꿈 + 메뉴(검정)
      const richText: ExcelJS.RichText[] = []

      // 날짜 (색상 적용)
      richText.push({
        font: { bold: true, size: 11, color: dateColor },
        text: formatDateShort(date)
      })

      if (comp) {
        // 빈 줄
        richText.push({ text: '\n\n' })

        // FF (메인)
        if (comp.ff?.name) {
          richText.push({
            font: { bold: true, size: 10, color: COLORS.black },
            text: comp.ff.name
          })
        }

        // 음료
        if (comp.drink?.name) {
          richText.push({ text: '\n' })
          richText.push({
            font: { size: 10, color: COLORS.black },
            text: comp.drink.name
          })
        }

        // 디저트
        for (const d of comp.desserts) {
          richText.push({ text: '\n' })
          richText.push({
            font: { size: 10, color: COLORS.black },
            text: d.name
          })
        }
      }

      cell.value = { richText }
    }
  }
}

// 도시락 고객용 시트 (ExcelJS)
function buildDosirakCustomerSheet(
  workbook: ExcelJS.Workbook,
  sets: { setNumber: number; ff: any; drink: any; desserts: any[]; totalCost: number }[],
  pricePoint: number
) {
  const sheetName = `도시락${pricePoint / 1000}`
  const worksheet = workbook.addWorksheet(sheetName)

  // 열 너비
  worksheet.getColumn(1).width = 12
  worksheet.getColumn(2).width = 25
  worksheet.getColumn(3).width = 20
  worksheet.getColumn(4).width = 35

  // 제목
  const titleRow = worksheet.addRow([`도시락${pricePoint / 1000} 식단표`])
  titleRow.font = { bold: true, size: 14 }
  worksheet.mergeCells(1, 1, 1, 4)

  worksheet.addRow(['※ 5개 고정 조합으로 운영됩니다.'])
  worksheet.addRow([])

  // 헤더
  const headerRow = worksheet.addRow(['조합', '도시락', '음료', '디저트'])
  headerRow.font = { bold: true }
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: COLORS.weekdayBg }
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })

  // 데이터
  for (const set of sets) {
    const dessertNames = set.desserts.map((d: any) => d.name).join(', ') || '-'
    const row = worksheet.addRow([
      `조합 ${set.setNumber}`,
      set.ff?.name || '-',
      set.drink?.name || '-',
      dessertNames
    ])
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    })
  }
}

// 프리포맷 고객용 시트 (ExcelJS)
function buildFreeFormatCustomerSheet(
  workbook: ExcelJS.Workbook,
  freeFormatData: FreeFormatData,
  startDate: Date,
  endDate: Date
) {
  const worksheet = workbook.addWorksheet('프리포맷')

  const dates = getDatesInRange(startDate, endDate)
  const weeks = groupByWeek(dates)

  // 열 너비
  for (let i = 1; i <= 7; i++) {
    worksheet.getColumn(i).width = 35
  }

  // 제목
  const titleRow = worksheet.addRow(['프리포맷 식단표'])
  titleRow.font = { bold: true, size: 16 }
  worksheet.mergeCells(1, 1, 1, 7)
  titleRow.alignment = { horizontal: 'center', vertical: 'middle' }

  worksheet.addRow(['※ 자유 구성 식단'])
  worksheet.addRow([])

  // 요일 헤더
  const headerRow = worksheet.addRow(WEEKDAY_HEADERS)
  headerRow.height = 25
  for (let col = 1; col <= 7; col++) {
    const cell = headerRow.getCell(col)
    cell.font = { bold: true, size: 11 }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    }
    if (col === 6) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: COLORS.saturdayBg }
      cell.font = { bold: true, size: 11, color: COLORS.blue }
    } else if (col === 7) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: COLORS.sundayHolidayBg }
      cell.font = { bold: true, size: 11, color: COLORS.red }
    } else {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: COLORS.weekdayBg }
    }
  }

  // 주차별 데이터
  for (const weekDates of weeks) {
    const dataRow = worksheet.addRow(Array(7).fill(''))
    dataRow.height = 105

    for (const date of weekDates) {
      let colIdx = date.getDay() - 1
      if (colIdx < 0) colIdx = 6
      const col = colIdx + 1

      const cell = dataRow.getCell(col)
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: COLORS.white }

      let dateColor = COLORS.black
      if (isHolidayOrSunday(date)) {
        dateColor = COLORS.red
      } else if (isSaturday(date)) {
        dateColor = COLORS.blue
      }

      const dateStr = toDateStr(date)
      const dayData = freeFormatData[dateStr]
      const slots = dayData?.slots ?? []

      const richText: ExcelJS.RichText[] = []
      richText.push({
        font: { bold: true, size: 11, color: dateColor },
        text: formatDateShort(date)
      })

      if (slots.length > 0) {
        richText.push({ text: '\n\n' })
        slots.forEach((slot, i) => {
          const name = slot.customText ?? slot.product?.name ?? ''
          if (name) {
            if (i > 0) richText.push({ text: '\n' })
            richText.push({
              font: { size: 10, color: COLORS.black },
              text: name
            })
          }
        })
      }

      cell.value = { richText }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SheetJS 유틸리티 (공장용에서 계속 사용)
// ─────────────────────────────────────────────────────────────────────────────

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
// 공장용 식단표 다운로드 (SheetJS - 기존 유지)
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
