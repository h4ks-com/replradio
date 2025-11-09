function audioBufferToWav(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1;
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;

    const data = [];
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
        data.push(audioBuffer.getChannelData(i));
    }

    const dataLength = audioBuffer.length * numChannels * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    const channelData = [];
    for (let i = 0; i < numChannels; i++) {
        channelData.push(data[i]);
    }

    let offset = 44;
    for (let i = 0; i < audioBuffer.length; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
            const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
            offset += 2;
        }
    }

    return buffer;
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

export class AudioRecorder {
    constructor() {
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.audioContext = null;
        this.destination = null;
    }

    async initialize(audioContext) {
        this.audioContext = audioContext;
        this.destination = audioContext.createMediaStreamDestination();
        return this.destination;
    }

    async startRecording() {
        if (!this.destination) {
            throw new Error('AudioRecorder not initialized. Call initialize() first.');
        }

        this.audioChunks = [];

        const mimeType = this.getSupportedMimeType();
        if (!mimeType) {
            throw new Error('No supported audio recording format found in this browser');
        }

        this.mediaRecorder = new MediaRecorder(this.destination.stream, {
            mimeType: mimeType,
            audioBitsPerSecond: 128000
        });

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.audioChunks.push(event.data);
            }
        };

        this.mediaRecorder.start(1000);
        this.isRecording = true;

        return new Promise((resolve) => {
            this.mediaRecorder.onstart = () => {
                console.log('Recording started');
                resolve();
            };
        });
    }

    async stopRecording() {
        if (!this.mediaRecorder || !this.isRecording) {
            throw new Error('No active recording to stop');
        }

        return new Promise((resolve, reject) => {
            this.mediaRecorder.onstop = async () => {
                this.isRecording = false;
                console.log('Recording stopped');

                const blob = new Blob(this.audioChunks, { type: this.mediaRecorder.mimeType });

                try {
                    const wavBlob = await this.convertToWav(blob);
                    resolve(wavBlob);
                } catch (error) {
                    console.warn('WAV conversion failed, returning original format:', error);
                    resolve(blob);
                }
            };

            this.mediaRecorder.onerror = (error) => {
                this.isRecording = false;
                reject(error);
            };

            this.mediaRecorder.stop();
        });
    }

    async convertToWav(blob) {
        const arrayBuffer = await blob.arrayBuffer();
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const wavArrayBuffer = audioBufferToWav(audioBuffer);
        return new Blob([wavArrayBuffer], { type: 'audio/wav' });
    }

    getSupportedMimeType() {
        const types = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/mp4'
        ];

        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }

        return null;
    }

    downloadRecording(blob, filename = 'recording.wav') {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    getRecordingState() {
        return {
            isRecording: this.isRecording,
            hasRecorder: !!this.mediaRecorder,
            state: this.mediaRecorder?.state
        };
    }
}

export async function renderOffline(patternCode, durationSeconds = 10) {
    const sampleRate = 44100;
    const numChannels = 2;

    const offlineContext = new OfflineAudioContext(
        numChannels,
        sampleRate * durationSeconds,
        sampleRate
    );

    try {
        const oscillator = offlineContext.createOscillator();
        oscillator.frequency.value = 440;
        oscillator.connect(offlineContext.destination);
        oscillator.start(0);

        const renderedBuffer = await offlineContext.startRendering();

        const wavArrayBuffer = audioBufferToWav(renderedBuffer);
        return new Blob([wavArrayBuffer], { type: 'audio/wav' });
    } catch (error) {
        console.error('Offline rendering failed:', error);
        throw error;
    }
}

export function getQueryParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        autoplay: params.get('autoplay') === 'true',
        maxlength: parseInt(params.get('maxlength')) || 30,
        autorecord: params.get('autorecord') === 'true'
    };
}
