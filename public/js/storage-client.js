const MINIO_ENDPOINT = 'https://s3-api.t3ks.com';
const BUCKET_NAME = 'replradio-uploads';
const MAX_FILE_SIZE = 1048576;
const CODE_LENGTH = 5;

const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function generateRandomCode() {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
        code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
    }
    return code;
}

async function checkCodeExists(code) {
    const url = `${MINIO_ENDPOINT}/${BUCKET_NAME}/${code}.txt`;

    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok;
    } catch (error) {
        return false;
    }
}

async function generateUniqueCode(maxRetries = 10) {
    for (let i = 0; i < maxRetries; i++) {
        const code = generateRandomCode();
        const exists = await checkCodeExists(code);

        if (!exists) {
            return code;
        }
    }

    throw new Error('Failed to generate unique code after multiple attempts');
}

export async function uploadCode(codeContent) {
    if (codeContent.length > MAX_FILE_SIZE) {
        throw new Error(`Code size exceeds 1MB limit (${codeContent.length} bytes)`);
    }

    const code = await generateUniqueCode();
    const filename = `${code}.txt`;
    const url = `${MINIO_ENDPOINT}/${BUCKET_NAME}/${filename}`;

    const blob = new Blob([codeContent], { type: 'text/plain; charset=utf-8' });

    try {
        const response = await fetch(url, {
            method: 'PUT',
            body: blob,
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Content-Length': blob.size
            }
        });

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
        }

        return {
            code,
            url: `${window.location.origin}/${code}`,
            storageUrl: url
        };
    } catch (error) {
        console.error('Upload error:', error);
        throw new Error(`Failed to upload code: ${error.message}`);
    }
}

export async function downloadCode(code) {
    const filename = `${code}.txt`;
    const url = `${MINIO_ENDPOINT}/${BUCKET_NAME}/${filename}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Code not found or has expired');
            }
            throw new Error(`Download failed: ${response.status} ${response.statusText}`);
        }

        const codeContent = await response.text();
        return codeContent;
    } catch (error) {
        console.error('Download error:', error);
        throw error;
    }
}

export async function uploadAudioFile(audioBlob, filename) {
    if (audioBlob.size > MAX_FILE_SIZE) {
        throw new Error(`Audio file exceeds 1MB limit (${audioBlob.size} bytes)`);
    }

    const url = `${MINIO_ENDPOINT}/${BUCKET_NAME}/${filename}`;

    try {
        const response = await fetch(url, {
            method: 'PUT',
            body: audioBlob,
            headers: {
                'Content-Type': 'audio/wav',
                'Content-Length': audioBlob.size
            }
        });

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
        }

        return {
            filename,
            url: url,
            size: audioBlob.size
        };
    } catch (error) {
        console.error('Audio upload error:', error);
        throw new Error(`Failed to upload audio: ${error.message}`);
    }
}

export function getCodeFromPath() {
    const path = window.location.pathname;

    if (path === '/' || path === '') {
        return null;
    }

    const code = path.replace(/^\//, '').replace(/\.txt$/, '');

    if (code.length === CODE_LENGTH && /^[a-zA-Z0-9]+$/.test(code)) {
        return code;
    }

    return null;
}

export function getBucketInfo() {
    return {
        endpoint: MINIO_ENDPOINT,
        bucket: BUCKET_NAME,
        maxFileSize: MAX_FILE_SIZE,
        expirationDays: 1
    };
}
