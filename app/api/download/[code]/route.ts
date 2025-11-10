import { NextRequest, NextResponse } from 'next/server'
import { downloadCodeFromMinio } from '@/lib/minio'

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params

    if (!code || !/^[a-zA-Z0-9]{5}$/.test(code)) {
      return NextResponse.json(
        { error: 'Invalid code format' },
        { status: 400 }
      )
    }

    const codeContent = await downloadCodeFromMinio(code)

    return NextResponse.json({
      code: codeContent
    })
  } catch (error) {
    console.error('Download API error:', error)

    if ((error as Error).message.includes('not found')) {
      return NextResponse.json(
        { error: 'Code not found or has expired' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
