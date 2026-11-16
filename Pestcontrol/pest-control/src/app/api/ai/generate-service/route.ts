import { NextRequest, NextResponse } from 'next/server'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent'

export async function POST(req: NextRequest) {
  try {
    const { name, purpose } = await req.json()
    if (!name || !purpose) {
      return NextResponse.json({ error: 'name and purpose are required' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 })
    }

    const prompt = `You write content for a Mumbai pest control website.
Service name: ${name}
Purpose: ${purpose}

Respond with a single JSON object and NOTHING else — no markdown, no backticks, no explanation.
Use this exact structure:
{
  "intro": "100-150 word introduction for Mumbai residents, mentioning actual pest situations in local homes",
  "metaTitle": "SEO title under 60 characters, including Mumbai",
  "metaDescription": "meta description under 155 characters, including service highlights",
  "harbourages": ["5 short bullet points about where this pest hides in Mumbai flats"],
  "treatmentSteps": [{"title": "step title", "description": "step description"}],
  "safetyNote": "safety note for families with children/pets",
  "faqs": [{"q": "question", "a": "answer"}]
}`

    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      }),
    })

    const rawBody = await res.text()

    if (!res.ok) {
      return NextResponse.json(
        { error: `Gemini ${res.status}: ${rawBody}` },
        { status: 500 }
      )
    }

    const data = JSON.parse(rawBody)
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    if (!text) {
      return NextResponse.json(
        { error: 'Gemini returned empty response', raw: data },
        { status: 500 }
      )
    }

    // Try direct parse first (works because of responseMimeType: application/json)
    let parsed: any
    try {
      parsed = JSON.parse(text)
    } catch {
      // Fallback: slice between first { and last }
      const start = text.indexOf('{')
      const end = text.lastIndexOf('}')
      if (start === -1 || end === -1) {
        return NextResponse.json(
          { error: 'No JSON object found in Gemini response', raw: text },
          { status: 500 }
        )
      }
      try {
        parsed = JSON.parse(text.slice(start, end + 1))
      } catch (e: any) {
        return NextResponse.json(
          { error: `JSON parse failed: ${e.message}`, raw: text },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(parsed)
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || 'Generation failed' },
      { status: 500 }
    )
  }
}