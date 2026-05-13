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

  // ★ Clean Canvas View 적용
  applyCleanCanvasView(worksheet, 7)
}

// Clean Canvas View 헬퍼 함수: 데이터 영역 외 숨김 + 눈금선 제거
function applyCleanCanvasView(worksheet: ExcelJS.Worksheet, usedColumns: number) {
  // 눈금선 제거
  worksheet.views = [{ showGridLines: false }]

  // 사용하지 않는 열 숨김 (H열부터 = 8열부터)
  for (let col = usedColumns + 1; col <= 100; col++) {
    const column = worksheet.getColumn(col)
    column.hidden = true
  }

  // 사용하지 않는 행 숨김 (마지막 데이터 행 이후)
  const lastRow = worksheet.lastRow?.number ?? 1
  for (let row = lastRow + 1; row <= lastRow + 100; row++) {
    const r = worksheet.getRow(row)
    r.hidden = true
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

  // ★ Clean Canvas View 적용
  applyCleanCanvasView(worksheet, 4)
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

  // ★ Clean Canvas View 적용
  applyCleanCanvasView(worksheet, 7)
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
// 공장용 식단표 다운로드 (ExcelJS - Clean Canvas View + 블록 테두리)
// - 일요일 시작 캘린더
// - 1메뉴 1셀 분할 구조, 행 높이 18 고정
// - 블록 외곽 테두리만 강조
// ─────────────────────────────────────────────────────────────────────────────

const FACTORY_WEEKDAY_HEADERS = ['일', '월', '화', '수', '목', '금', '토']

// 주차별로 날짜 그룹화 (일요일 시작 기준 - 공장용)
function groupByWeekSunday(dates: Date[]): Date[][] {
  if (dates.length === 0) return []
  
  const weeks: Date[][] = []
  let currentWeek: Date[] = []
  
  for (const date of dates) {
    const dayOfWeek = date.getDay()
    // 일요일(0)이면 새 주 시작
    if (dayOfWeek === 0 && currentWeek.length > 0) {
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

export async function downloadFactoryExcel(
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

  // 식단별 개별 시트 생성
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
      buildFactoryCalendarSheetExcelJS(workbook, planName, mealPlanMeals, mealPlanTargetCosts, startDate, endDate)
    }
  }
  
  // 도시락 시트
  if (dosirakSets && Object.keys(dosirakSets).length > 0) {
    buildDosirakFactorySheetExcelJS(workbook, dosirakSets, mealPlanTargetCosts)
  }

  // 프리포맷 시트
  if (freeFormatData && Object.keys(freeFormatData).length > 0) {
    buildFreeFormatFactorySheetExcelJS(workbook, freeFormatData, startDate, endDate)
  }

  // 파일명: [공장용]_식단표_YYYYMMDD_YYYYMMDD.xlsx
  const startStr = `${startDate.getFullYear()}${String(startDate.getMonth() + 1).padStart(2, '0')}${String(startDate.getDate()).padStart(2, '0')}`
  const endStr = `${endDate.getFullYear()}${String(endDate.getMonth() + 1).padStart(2, '0')}${String(endDate.getDate()).padStart(2, '0')}`
  const fileName = `[공장용]_식단표_${startStr}_${endStr}.xlsx`

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  saveAs(blob, fileName)
}

// ─────────────────────────────────────────────────────────────────────────────
// 공장용 ExcelJS 시트 빌더 (Final Refined Version)
// - 원가 정보 완전 제거 (보안)
// - 6행 블록 구조: 생산일 + 메뉴1~4 + 원가합계(숫자만)
// - A1:G2 병합 헤더, 열너비 35 고정, 내부 격자선 제거
// ─────────────────────────────────────────────────────────────────────────────

// 공장용 캘린더 시트 (Precision Version)
function buildFactoryCalendarSheetExcelJS(
  workbook: ExcelJS.Workbook,
  planName: string,
  mealPlanMeals: MealPlanDailyMeals,
  _mealPlanTargetCosts: MealPlanTargetCosts, // 보안상 사용하지 않음
  startDate: Date,
  endDate: Date
) {
  const safeSheetName = planName.replace(/[()]/g, '').substring(0, 31)
  const worksheet = workbook.addWorksheet(safeSheetName)
  
  const dates = getDatesInRange(startDate, endDate)
  const weeks = groupByWeekSunday(dates)
  
  const planInfo = ALL_MEAL_PLANS.find(m => m.name === planName)
  const pricePoint = planInfo?.price ?? 3500

  // ★ 열 너비: A~G = 35 고정
  for (let col = 1; col <= 7; col++) {
    worksheet.getColumn(col).width = 35
  }

  // ★ 헤더 병합 (A1:G2) + 가로/세로 가운데 맞춤
  worksheet.mergeCells('A1:G2')
  const headerCell = worksheet.getCell('A1')
  headerCell.value = `${planName} 공장 식단표`
  headerCell.font = { bold: true, size: 16 }
  headerCell.alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getRow(1).height = 20
  worksheet.getRow(2).height = 20

  let rowNum = 3

  // 요일 헤더 (일요일 시작) - 색상 쉐이딩 적용
  const dayHeaderRow = worksheet.getRow(rowNum)
  dayHeaderRow.height = 25 // ★ 요일 헤더 높이 25
  FACTORY_WEEKDAY_HEADERS.forEach((day, idx) => {
    const cell = dayHeaderRow.getCell(idx + 1)
    cell.value = day
    cell.font = { bold: true }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    
    // ★ 색상 로직: 평일=회색, 토=연파랑, 일=연분홍
    if (idx === 0) { // 일요일
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD9D9' } }
    } else if (idx === 6) { // 토요일
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E8FF' } }
    } else { // 평일
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } }
    }
  })
  rowNum++

  // 주차별 6행 블록 생성
  for (const weekDates of weeks) {
    const blockStartRow = rowNum
    const BLOCK_ROWS = 6 // 생산일 + 메뉴1~4 + 원가합계

    // ★ 각 행 높이 18 고정
    for (let r = 0; r < BLOCK_ROWS; r++) {
      worksheet.getRow(rowNum + r).height = 18
    }

    for (const date of weekDates) {
      // D-1 생산일 계산
      const productionDate = new Date(date)
      productionDate.setDate(productionDate.getDate() - 1)

      // ★ 생산일 기준으로 요일 열 배치 (수정됨)
      const colIdx = productionDate.getDay() + 1 // 일요일=0 → 1열

      const dateStr = toDateStr(date)
      const meal = mealPlanMeals[planName]?.find(m => m.date === dateStr)
      const comp = meal?.compositions[pricePoint]

      // ★ 행1: 생산 날짜만
      const cell0 = worksheet.getCell(rowNum, colIdx)
      cell0.value = `${productionDate.getMonth() + 1}/${productionDate.getDate()}`
      cell0.alignment = { horizontal: 'center', vertical: 'middle' }
      
      // ★ 주말/공휴일: 셀 쉐이딩 대신 글자 색상 변경
      const prodDayOfWeek = productionDate.getDay()
      const isHoliday = isKRHoliday(productionDate)
      if (isHoliday || prodDayOfWeek === 0) {
        cell0.font = { color: { argb: 'FFFF0000' } } // 일요일/공휴일: 빨간 글씨
      } else if (prodDayOfWeek === 6) {
        cell0.font = { color: { argb: 'FF0000FF' } } // 토요일: 파란 글씨
      }

      if (comp) {
        // ★ 행2: FF 메뉴명만 (단가 제거)
        const cell1 = worksheet.getCell(rowNum + 1, colIdx)
        cell1.value = comp.ff?.name ?? '-'
        cell1.alignment = { horizontal: 'center', vertical: 'middle' }

        // ★ 행3: 음료 메뉴명만 (단가 제거)
        const cell2 = worksheet.getCell(rowNum + 2, colIdx)
        cell2.value = comp.drink?.name ?? '-'
        cell2.alignment = { horizontal: 'center', vertical: 'middle' }

        // ★ 행4~5: 디저트 메뉴명만 (단가 제거)
        const desserts = comp.desserts ?? []
        const cell3 = worksheet.getCell(rowNum + 3, colIdx)
        cell3.value = desserts[0]?.name ?? '-'
        cell3.alignment = { horizontal: 'center', vertical: 'middle' }

        const cell4 = worksheet.getCell(rowNum + 4, colIdx)
        cell4.value = desserts[1]?.name ?? '-'
        cell4.alignment = { horizontal: 'center', vertical: 'middle' }

        // ★ 행6: 원가 합계 (숫자만, '원' 제거, 우측 정렬)
        const cell5 = worksheet.getCell(rowNum + 5, colIdx)
        cell5.value = comp.totalCost
        cell5.alignment = { horizontal: 'right', vertical: 'middle' }
        cell5.font = { bold: true }
      }
    }

    // ★ 블록 외곽 테두리만 (내부 격자선 제거)
    applyBlockBorderOutlineOnly(worksheet, blockStartRow, rowNum + BLOCK_ROWS - 1, 1, 7)

    rowNum += BLOCK_ROWS // 6행 블록 (빈행 없음)
  }

  // ★ 총괄 요약 삭제 (보안상 원가 정보 제거)

  // ★ Clean Canvas View 적용 (H열 이후 + 마지막 행 이후 숨김)
  applyCleanCanvasView(worksheet, 7)
}

// 블록 외곽 테두리만 적용 (내부 격자선 없음) - 공장용
function applyBlockBorderOutlineOnly(
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number
) {
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const cell = worksheet.getCell(r, c)
      const border: Partial<ExcelJS.Borders> = {}
      
      // ★ 외곽만 굵은 테두리, 내부 격자선 없음
      if (r === startRow) border.top = { style: 'medium' }
      if (r === endRow) border.bottom = { style: 'medium' }
      if (c === startCol) border.left = { style: 'medium' }
      if (c === endCol) border.right = { style: 'medium' }
      
      cell.border = border
    }
  }
}

// 블록 외곽 + 내부 얇은 테두리 - 고객용/도시락용
function applyBlockBorder(
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number
) {
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const cell = worksheet.getCell(r, c)
      const border: Partial<ExcelJS.Borders> = {}
      
      if (r === startRow) border.top = { style: 'medium' }
      if (r === endRow) border.bottom = { style: 'medium' }
      if (c === startCol) border.left = { style: 'medium' }
      if (c === endCol) border.right = { style: 'medium' }
      
      // 내부 셀은 얇은 테두리
      if (r !== startRow) border.top = border.top ?? { style: 'thin', color: { argb: 'FFD0D0D0' } }
      if (r !== endRow) border.bottom = border.bottom ?? { style: 'thin', color: { argb: 'FFD0D0D0' } }
      if (c !== startCol) border.left = border.left ?? { style: 'thin', color: { argb: 'FFD0D0D0' } }
      if (c !== endCol) border.right = border.right ?? { style: 'thin', color: { argb: 'FFD0D0D0' } }
      
      cell.border = border
    }
  }
}

// 요일별 색상 적용
function applyDayColor(cell: ExcelJS.Cell, date: Date) {
  const dayOfWeek = date.getDay()
  const isHoliday = isKRHoliday(date)
  
  if (isHoliday || dayOfWeek === 0) {
    cell.font = { color: { argb: 'FFFF0000' } }
  } else if (dayOfWeek === 6) {
    cell.font = { color: { argb: 'FF0000FF' } }
  }
}

// 도시락 공장용 시트 (ExcelJS)
function buildDosirakFactorySheetExcelJS(
  workbook: ExcelJS.Workbook,
  dosirakSets: DosirakSets,
  mealPlanTargetCosts: MealPlanTargetCosts
) {
  const worksheet = workbook.addWorksheet('도시락_공장')

  // 열 너비 설정
  const colWidths = [10, 18, 8, 15, 8, 25, 10, 12, 12]
  colWidths.forEach((w, i) => { worksheet.getColumn(i + 1).width = w })

  let rowNum = 1

  // 제목
  worksheet.getCell(rowNum, 1).value = '도시락 공장 식단표 - 5개 고정 조합'
  worksheet.getCell(rowNum, 1).font = { bold: true, size: 14 }
  rowNum++
  worksheet.getCell(rowNum, 1).value = '※ 상시 생산 품목 (날짜 무관)'
  rowNum += 2

  const pricePoints = [4500, 5500, 6500]
  const planNames = ['도시락4.5', '도시락5.5', '도시락6.5']

  for (let i = 0; i < pricePoints.length; i++) {
    const pp = pricePoints[i]
    const planName = planNames[i]
    const sets = dosirakSets[pp] || []
    if (sets.length === 0) continue
    
    const target = mealPlanTargetCosts[planName] ?? MEAL_PLAN_COST_CONFIGS.find(c => c.mealPlanName === planName)?.defaultCost ?? 0

    // 가격대 제목
    worksheet.getCell(rowNum, 1).value = `[ ${planName} ] 목표원가: ${target}원`
    worksheet.getCell(rowNum, 1).font = { bold: true }
    rowNum++

    // 헤더
    const headers = ['조합', '도시락', '단가', '음료', '단가', '디저트', '단가', '합계', '차이']
    headers.forEach((h, idx) => {
      const cell = worksheet.getCell(rowNum, idx + 1)
      cell.value = h
      cell.font = { bold: true }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
    })
    rowNum++

    // 조합 데이터
    for (const set of sets) {
      const dessertNames = set.desserts.map((d: any) => d.name).join(', ') || '-'
      const dessertCost = set.desserts.reduce((s: number, d: any) => s + d.cost, 0)
      const diff = set.totalCost - target
      const isOver = set.totalCost > target * 1.03

      const rowData = [
        `조합 ${set.setNumber}`,
        set.ff?.name || '-',
        set.ff?.cost ?? 0,
        set.drink?.name || '-',
        set.drink?.cost ?? 0,
        dessertNames,
        dessertCost,
        set.totalCost,
        diff >= 0 ? `+${diff}` : `${diff}`
      ]

      rowData.forEach((val, idx) => {
        const cell = worksheet.getCell(rowNum, idx + 1)
        cell.value = val
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
        
        if (idx === 7 && isOver) {
          cell.font = { bold: true, color: { argb: 'FFFF0000' } }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCCCC' } }
        }
        if (idx === 8) {
          cell.font = { color: diff > 0 ? { argb: 'FFFF0000' } : { argb: 'FF008800' } }
        }
      })
      rowNum++
    }

    // 평균
    if (sets.length > 0) {
      const avg = Math.round(sets.reduce((s: number, set: any) => s + set.totalCost, 0) / sets.length)
      const avgDiff = avg - target
      rowNum++
      worksheet.getCell(rowNum, 7).value = '평균'
      worksheet.getCell(rowNum, 7).font = { bold: true }
      worksheet.getCell(rowNum, 8).value = avg
      worksheet.getCell(rowNum, 8).font = { bold: true }
      worksheet.getCell(rowNum, 9).value = avgDiff >= 0 ? `+${avgDiff}` : `${avgDiff}`
      worksheet.getCell(rowNum, 9).font = { color: avgDiff > 0 ? { argb: 'FFFF0000' } : { argb: 'FF008800' } }
    }

    rowNum += 2
  }

  applyCleanCanvasView(worksheet, 9)
}

// 프리포맷 공장용 시트 (ExcelJS)
function buildFreeFormatFactorySheetExcelJS(
  workbook: ExcelJS.Workbook,
  freeFormatData: FreeFormatData,
  startDate: Date,
  endDate: Date
) {
  const worksheet = workbook.addWorksheet('프리포맷_공장')
  const dates = getDatesInRange(startDate, endDate)
  const weeks = groupByWeekSunday(dates)

  // 열 너비
  for (let col = 1; col <= 8; col++) {
    worksheet.getColumn(col).width = col === 8 ? 12 : 18
  }

  let rowNum = 1

  // 제목
  worksheet.getCell(rowNum, 1).value = '프리포맷 공장 식단표 [생산일 D-1 기준]'
  worksheet.getCell(rowNum, 1).font = { bold: true, size: 14 }
  rowNum++
  worksheet.getCell(rowNum, 1).value = `기간: ${toDateStr(startDate)} ~ ${toDateStr(endDate)}`
  rowNum += 2

  // 요일 헤더 (일요일 시작)
  const headerRow = worksheet.getRow(rowNum)
  FACTORY_WEEKDAY_HEADERS.forEach((day, idx) => {
    const cell = headerRow.getCell(idx + 1)
    cell.value = day
    cell.font = { bold: true }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }
  })
  headerRow.getCell(8).value = '주차'
  headerRow.getCell(8).font = { bold: true }
  rowNum++

  for (let weekIdx = 0; weekIdx < weeks.length; weekIdx++) {
    const weekDates = weeks[weekIdx]
    let weekSum = 0
    let weekCount = 0
    const blockStartRow = rowNum

    // 최대 슬롯 수 계산
    let maxSlots = 1
    for (const date of weekDates) {
      const dateStr = toDateStr(date)
      const dayData = freeFormatData[dateStr]
      if (dayData?.slots) {
        maxSlots = Math.max(maxSlots, dayData.slots.length)
      }
    }

    // 행 구조: 생산/배송 + 슬롯들 + 합계
    const totalRows = 1 + maxSlots + 1

    for (const date of weekDates) {
      const colIdx = date.getDay() + 1

      const productionDate = new Date(date)
      productionDate.setDate(productionDate.getDate() - 1)

      const dateStr = toDateStr(date)
      const dayData = freeFormatData[dateStr]
      const slots = dayData?.slots ?? []
      const totalCost = slots.reduce((s, sl) => s + sl.cost, 0)

      // 행0: 생산/배송일
      const cell0 = worksheet.getCell(rowNum, colIdx)
      cell0.value = `${formatDateShort(productionDate)}\n(${formatDateShort(date)})`
      cell0.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      applyDayColor(cell0, date)

      // 슬롯들
      slots.forEach((slot, i) => {
        const cell = worksheet.getCell(rowNum + 1 + i, colIdx)
        const text = slot.customText ?? slot.product?.name ?? ''
        cell.value = slot.cost > 0 ? `${text}\n(${slot.cost}원)` : text
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      })

      // 합계
      if (totalCost > 0) {
        const totalCell = worksheet.getCell(rowNum + 1 + maxSlots, colIdx)
        totalCell.value = `합계: ${totalCost}원`
        totalCell.font = { bold: true }
        totalCell.alignment = { horizontal: 'center', vertical: 'middle' }
        weekSum += totalCost
        weekCount++
      }
    }

    // 주차 평균
    const weekAvg = weekCount > 0 ? Math.round(weekSum / weekCount) : 0
    const avgCell = worksheet.getCell(rowNum + Math.floor(totalRows / 2), 8)
    avgCell.value = `${weekIdx + 1}주차\n평균: ${weekAvg}원`
    avgCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    avgCell.font = { bold: true }

    // 블록 테두리
    applyBlockBorder(worksheet, blockStartRow, rowNum + totalRows - 1, 1, 7)

    // 행 높이
    for (let r = rowNum; r < rowNum + totalRows; r++) {
      worksheet.getRow(r).height = 18
    }

    rowNum += totalRows + 1
  }

  applyCleanCanvasView(worksheet, 8)
}
