import { NextRequest, NextResponse } from 'next/server'
import { uploadCodeToMinio } from '@/lib/minio'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code } = body

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Code is required and must be a string' },
        { status: 400 }
      )
    }

    if (code.trim() === '') {
      return NextResponse.json(
        { error: 'Code cannot be empty' },
        { status: 400 }
      )
    }

    const result = await uploadCodeToMinio(code)

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`

    return NextResponse.json({
      code: result.code,
      url: `${baseUrl}/${result.code}`,
      storageUrl: result.storageUrl
    })
  } catch (error) {
    console.error('Upload API error:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
