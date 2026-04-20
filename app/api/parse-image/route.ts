import { generateText } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, category } = await req.json()
    
    if (!imageBase64) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    // 카테고리별 프롬프트 설정
    let prompt = ''
    if (category === 'ff') {
      prompt = `이 이미지는 FF(김밥/주먹밥/샌드/버거/도시락) 상품 리스트입니다.
이미지에서 다음 정보를 추출해주세요:
- 중분류 (김밥, 주먹밥, 샌드, 버거, 도시락 중 하나)
- 상품명
- 원가 (숫자만)

JSON 배열 형식으로만 응답해주세요. 다른 텍스트 없이 JSON만 출력하세요.
형식: [{"ffType": "주먹밥", "name": "상품명", "cost": 1000}, ...]`
    } else {
      prompt = `이 이미지는 ${category === 'drink' ? '음료' : '디저트'} 상품 리스트입니다.
이미지에서 다음 정보를 추출해주세요:
- 그룹 (${category === 'drink' ? '건강, 주스, 탄산, 주스/차 등' : '당류, 탄수화물, 프레시, 단백질 등'})
- 상품명
- 원가 (숫자만)

JSON 배열 형식으로만 응답해주세요. 다른 텍스트 없이 JSON만 출력하세요.
형식: [{"group": "그룹명", "name": "상품명", "cost": 1000}, ...]`
    }

    const result = await generateText({
      model: gateway('openai/gpt-4o-mini'),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              image: imageBase64,
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    })

    // JSON 파싱 시도
    let parsedProducts = []
    try {
      // JSON 블록 추출 시도
      const jsonMatch = result.text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        parsedProducts = JSON.parse(jsonMatch[0])
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      return NextResponse.json({ error: 'Failed to parse product data', raw: result.text }, { status: 500 })
    }

    // 카테고리에 맞게 상품 형식 변환
    const products = parsedProducts.map((p: Record<string, unknown>) => ({
      name: String(p.name || ''),
      cost: parseInt(String(p.cost || '0')),
      category,
      ...(category === 'ff' ? { ffType: p.ffType } : { group: p.group }),
    })).filter((p: { name: string; cost: number }) => p.name && p.cost > 0)

    return NextResponse.json({ products })
  } catch (error) {
    console.error('Image parsing error:', error)
    return NextResponse.json({ error: 'Failed to process image' }, { status: 500 })
  }
}
