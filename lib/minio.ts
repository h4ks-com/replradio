const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'https://s3-api.t3ks.com'
const BUCKET_NAME = process.env.MINIO_BUCKET_NAME || 'replradio-uploads'
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '1048576', 10)
const CODE_LENGTH = parseInt(process.env.CODE_LENGTH || '5', 10)

const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

export function generateRandomCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CHARS.charAt(Math.floor(Math.random() * CHARS.length))
  }
  return code
}

export async function checkCodeExists(code: string): Promise<boolean> {
  const url = `${MINIO_ENDPOINT}/${BUCKET_NAME}/${code}.txt`

  try {
    const response = await fetch(url, { method: 'HEAD' })
    return response.ok
  } catch (error) {
    return false
  }
}

export async function generateUniqueCode(maxRetries: number = 10): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const code = generateRandomCode()
    const exists = await checkCodeExists(code)

    if (!exists) {
      return code
    }
  }

  throw new Error('Failed to generate unique code after multiple attempts')
}

export async function uploadCodeToMinio(codeContent: string): Promise<{ code: string, storageUrl: string }> {
  if (codeContent.length > MAX_FILE_SIZE) {
    throw new Error(`Code size exceeds 1MB limit (${codeContent.length} bytes)`)
  }

  const code = await generateUniqueCode()
  const filename = `${code}.txt`
  const url = `${MINIO_ENDPOINT}/${BUCKET_NAME}/${filename}`

  const blob = new Blob([codeContent], { type: 'text/plain; charset=utf-8' })

  try {
    const response = await fetch(url, {
      method: 'PUT',
      body: blob,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Length': blob.size.toString()
      }
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`)
    }

    return {
      code,
      storageUrl: url
    }
  } catch (error) {
    console.error('Upload error:', error)
    throw new Error(`Failed to upload code: ${(error as Error).message}`)
  }
}

export async function downloadCodeFromMinio(code: string): Promise<string> {
  const filename = `${code}.txt`
  const url = `${MINIO_ENDPOINT}/${BUCKET_NAME}/${filename}`

  try {
    const response = await fetch(url)

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Code not found or has expired')
      }
      throw new Error(`Download failed: ${response.status} ${response.statusText}`)
    }

    const codeContent = await response.text()
    return codeContent
  } catch (error) {
    console.error('Download error:', error)
    throw error
  }
}

export function getBucketInfo() {
  return {
    endpoint: MINIO_ENDPOINT,
    bucket: BUCKET_NAME,
    maxFileSize: MAX_FILE_SIZE,
    expirationDays: 1
  }
}
