import { AudioRecorder, getQueryParams } from './audio-recorder.js';
import { uploadCode, downloadCode, getCodeFromPath } from './storage-client.js';

let editor = null;
let isPlaying = false;
let audioRecorder = null;

const DEFAULT_CODE = `// Welcome to H4KS Radio REPL!
// Press PLAY or Ctrl+Enter to hear the pattern
note("c a f e")
  .s("sawtooth")
  .slow(2)
  .play()`;

async function init() {
    showLoading('Initializing Strudel...');

    try {
        // Initialize Strudel audio engine
        await initStrudel();

        // Check what Strudel functions are available
        console.log('Strudel functions available:', {
            note: typeof note !== 'undefined',
            s: typeof s !== 'undefined',
            sound: typeof sound !== 'undefined',
            mini: typeof mini !== 'undefined',
            evaluate: typeof evaluate !== 'undefined',
            repl: typeof repl !== 'undefined'
        });

        // Preload common sample banks
        showLoading('Loading sound banks...');
        try {
            await samples('github:tidalcycles/Dirt-Samples/master');
            console.log('Sample banks loaded');
        } catch (error) {
            console.warn('Sample banks failed to load:', error);
        }

        const code = await loadCodeFromURL() || DEFAULT_CODE;

        // Create CodeMirror editor
        editor = CodeMirror(document.getElementById('strudel-container'), {
            value: code,
            mode: 'javascript',
            theme: 'monokai',
            lineNumbers: true,
            tabSize: 2,
            indentWithTabs: false,
            lineWrapping: true,
            autoCloseBrackets: true,
            matchBrackets: true
        });

        // Intercept audio context for recording
        const OriginalAudioContext = window.AudioContext || window.webkitAudioContext;
        window.audioContextInstance = null;

        window.AudioContext = function(...args) {
            console.log('AudioContext created');
            window.audioContextInstance = new OriginalAudioContext(...args);
            console.log('AudioContext state:', window.audioContextInstance.state);
            console.log('AudioContext destination:', window.audioContextInstance.destination);
            return window.audioContextInstance;
        };
        window.webkitAudioContext = window.AudioContext;

        audioRecorder = new AudioRecorder();

        setupEventListeners();

        hideLoading();

        const params = getQueryParams();
        if (params.autoplay) {
            setTimeout(() => playCode(), 1000);
        }
    } catch (error) {
        console.error('Initialization error:', error);
        hideLoading();
        alert('Initialization error: ' + error.message);
    }
}

async function loadCodeFromURL() {
    const code = getCodeFromPath();
    if (code) {
        showLoading(`Loading code: ${code}...`);
        try {
            const codeContent = await downloadCode(code);
            return codeContent;
        } catch (error) {
            console.error('Failed to load code:', error);
            alert(`Failed to load shared code: ${error.message}`);
        }
    }
    return null;
}

function setupEventListeners() {
    document.getElementById('playBtn').addEventListener('click', togglePlayStop);
    document.getElementById('shareBtn').addEventListener('click', showShareModal);
    document.getElementById('recordBtn').addEventListener('click', toggleRecord);

    // Modal event listeners
    document.getElementById('modalCancel').addEventListener('click', hideShareModal);
    document.getElementById('modalConfirm').addEventListener('click', handleShareConfirm);

    // Close modal on outside click
    document.getElementById('shareModal').addEventListener('click', (e) => {
        if (e.target.id === 'shareModal') {
            hideShareModal();
        }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideShareModal();
        }
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            togglePlayStop();
        }
    });
}

function togglePlayStop() {
    if (isPlaying) {
        stopCode();
    } else {
        playCode();
    }
}

async function playCode() {
    try {
        // Resume audio context if suspended (browser requirement)
        if (window.audioContextInstance && window.audioContextInstance.state === 'suspended') {
            await window.audioContextInstance.resume();
            console.log('Audio context resumed');
        }

        const code = editor.getValue();

        // Use Strudel's evaluate function if available, otherwise fallback to eval
        let result;
        if (typeof evaluate === 'function') {
            result = await evaluate(code);
        } else if (typeof repl !== 'undefined' && typeof repl.evaluate === 'function') {
            result = await repl.evaluate(code);
        } else {
            // Fallback to eval with Strudel context
            result = eval(code);
        }

        // If the result is a pattern object with a play method, call it
        if (result && typeof result.play === 'function') {
            console.log('Auto-playing pattern');
            result.play();
        }

        isPlaying = true;
        document.getElementById('playBtn').textContent = 'STOP';
        updateStatus('Playing', 'playing');
    } catch (error) {
        console.error('Play error:', error);
        alert(`Error: ${error.message}`);
    }
}

function stopCode() {
    try {
        hush();

        isPlaying = false;
        document.getElementById('playBtn').textContent = 'PLAY';
        updateStatus('Stopped', 'stopped');
    } catch (error) {
        console.error('Stop error:', error);
    }
}

function showShareModal() {
    const code = editor ? editor.getValue() : '';

    if (!code || code.trim() === '') {
        alert('No code to share!');
        return;
    }

    document.getElementById('shareModal').classList.add('show');
}

function hideShareModal() {
    document.getElementById('shareModal').classList.remove('show');
}

async function handleShareConfirm() {
    hideShareModal();
    await shareCode();
}

async function shareCode() {
    const code = editor ? editor.getValue() : '';

    const shareBtn = document.getElementById('shareBtn');
    shareBtn.disabled = true;
    updateShareStatus('Generating share link...', 'loading');

    try {
        const result = await uploadCode(code);

        updateShareStatus(`Link: ${result.url}`, 'success');

        await navigator.clipboard.writeText(result.url);
        alert(`Share link copied to clipboard!\n\n${result.url}`);

        window.history.pushState({}, '', `/${result.code}`);
    } catch (error) {
        console.error('Share error:', error);
        updateShareStatus(`Error: ${error.message}`, 'error');
        alert(`Failed to share code: ${error.message}`);
    } finally {
        shareBtn.disabled = false;
    }
}

async function toggleRecord() {
    if (audioRecorder.isRecording) {
        await stopRecording();
    } else {
        await startRecording();
    }
}

async function startRecording() {
    try {
        if (!window.audioContextInstance) {
            alert('Audio context not available. Please play the pattern first.');
            return;
        }

        const destination = await audioRecorder.initialize(window.audioContextInstance);

        await audioRecorder.startRecording();

        document.getElementById('recordBtn').textContent = 'STOP REC';
        document.getElementById('recordBtn').classList.add('recording');
        updateStatus('Recording...', 'recording');
    } catch (error) {
        console.error('Start recording error:', error);
        alert(`Failed to start recording: ${error.message}`);
    }
}

async function stopRecording() {
    try {
        const audioBlob = await audioRecorder.stopRecording();

        document.getElementById('recordBtn').textContent = 'RECORD';
        document.getElementById('recordBtn').classList.remove('recording');
        updateStatus('Recording saved', 'success');

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const filename = `h4ks-radio-${timestamp}.wav`;

        audioRecorder.downloadRecording(audioBlob, filename);
    } catch (error) {
        console.error('Stop recording error:', error);
        alert(`Failed to stop recording: ${error.message}`);
    }
}

function updateStatus(text, className = '') {
    const statusText = document.querySelector('.status-text');
    if (statusText) {
        statusText.textContent = text;
        statusText.className = `status-text ${className}`;
    }
}

function updateShareStatus(text, type = '') {
    const shareStatus = document.getElementById('shareStatus');
    shareStatus.textContent = text;
    shareStatus.className = `share-status ${type}`;
}

function showLoading(text = 'Loading...') {
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = loadingOverlay.querySelector('.loading-text');
    if (loadingText) {
        loadingText.textContent = text;
    }
    loadingOverlay.classList.add('show');
}

function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.classList.remove('show');
}

document.addEventListener('DOMContentLoaded', init);
