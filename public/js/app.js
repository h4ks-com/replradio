import { AudioRecorder, getQueryParams } from './audio-recorder.js';
import { uploadCode, downloadCode, getCodeFromPath } from './storage-client.js';

let editor = null;
let isPlaying = false;
let audioRecorder = null;

const DEFAULT_CODE = `// Welcome to H4KS STRUDEL REPL!

// Simple patterns work as-is
note("c a f e")
  .sound("sawtooth")
  .slow(2)

// For multi-statement code, await samples first:
// await samples('github:tidalcycles/Dirt-Samples/master')
//
// n("[0,3] 2").sound("piano").play()`;

async function init() {
    showLoading('Initializing Strudel...');

    try {
        console.log('[INIT] Step 1: Initializing Strudel audio engine');
        await initStrudel();

        console.log('[INIT] Step 2: Extending String.prototype');
        // Enable mini-notation on String.prototype (like official Strudel REPL)
        if (typeof repl !== 'undefined' && typeof repl.enableMiniNotation === 'function') {
            repl.enableMiniNotation();
        } else if (typeof Pattern !== 'undefined') {
            try {
                // Manually extend String.prototype with ALL pattern methods and properties
                String.prototype.mini = function() {
                    return mini(this.valueOf());
                };

                // Get all methods and getters from Pattern prototype using descriptors only
                const proto = Pattern.prototype;
                Object.getOwnPropertyNames(proto).forEach(key => {
                    if (key === 'constructor' || String.prototype[key]) return;

                    try {
                        const descriptor = Object.getOwnPropertyDescriptor(proto, key);

                        if (descriptor.value && typeof descriptor.value === 'function') {
                            // It's a method
                            String.prototype[key] = function(...args) {
                                return mini(this.valueOf())[key](...args);
                            };
                        } else if (descriptor.get) {
                            // It's a getter
                            Object.defineProperty(String.prototype, key, {
                                get() {
                                    return mini(this.valueOf())[key];
                                },
                                configurable: true
                            });
                        }
                    } catch (err) {
                        // Skip properties that cause errors
                        console.warn(`Failed to add property ${key}:`, err.message);
                    }
                });
            } catch (err) {
                console.error('Failed to extend String.prototype:', err);
            }
        }

        console.log('[INIT] Step 3: Strudel initialized - mini-notation enabled!');

        console.log('[INIT] Step 4: Loading code');
        const code = await loadCodeFromURL() || DEFAULT_CODE;

        console.log('[INIT] Step 5: Creating CodeMirror editor');
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

        console.log('[INIT] Step 6: Setting up audio context interception');
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

        console.log('[INIT] Step 7: Creating audio recorder');
        audioRecorder = new AudioRecorder();

        console.log('[INIT] Step 8: Setting up event listeners');
        setupEventListeners();

        console.log('[INIT] Step 9: Hiding loading overlay');
        hideLoading();

        console.log('[INIT] Step 10: Checking autoplay');
        const params = getQueryParams();
        if (params.autoplay) {
            setTimeout(() => playCode(), 1000);
        }

        console.log('[INIT] Initialization complete!');
    } catch (error) {
        console.error('Initialization error:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        hideLoading();
        alert('Initialization error: ' + error.message + '\n\nCheck console for details.');
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
        // Ctrl+Enter or Cmd+Enter to toggle play/stop
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
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
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

        // Collect Strudel globals to pass as function parameters
        const globalNames = ['perlin', 'sine', 'saw', 'square', 'tri', 'rand', 'cosine', 'Pattern', 'mini', 'samples', 'sounds', 's', 'n', 'note', 'sound', 'hush'];
        const globalValues = globalNames.map(name => window[name]).filter(v => v !== undefined);
        const availableGlobals = globalNames.filter(name => window[name] !== undefined);

        // Split code by double newlines (blank lines) to find statement groups
        // Filter out comment-only blocks
        const blocks = code.split(/\n\s*\n/).filter(block => {
            const trimmed = block.trim();
            return trimmed && !trimmed.split('\n').every(line => {
                const l = line.trim();
                return !l || l.startsWith('//');
            });
        });

        let result;

        if (blocks.length === 0) {
            // No code blocks (all comments)
            return;
        } else if (blocks.length === 1) {
            // Single block - insert return before first non-comment line
            const lines = blocks[0].split('\n');
            const firstCodeLineIndex = lines.findIndex(line => {
                const trimmed = line.trim();
                return trimmed && !trimmed.startsWith('//');
            });

            if (firstCodeLineIndex !== -1) {
                lines[firstCodeLineIndex] = 'return ' + lines[firstCodeLineIndex];
            }

            const wrappedCode = lines.join('\n');
            const fn = new AsyncFunction(...availableGlobals, wrappedCode);
            result = await fn.call(window, ...globalValues);
        } else {
            // Multiple blocks - await each statement, then return last expression
            // This ensures async operations like samples() complete before pattern plays
            const statements = blocks.slice(0, -1).map(block => {
                const trimmed = block.trim();
                // If statement doesn't start with await and looks like it might return a promise, add await
                if (!trimmed.startsWith('await') && (trimmed.includes('samples(') || trimmed.includes('sounds('))) {
                    return `await ${block}`;
                }
                return block;
            }).join('\n\n');

            // Insert return before first non-comment line in last block
            const lastBlock = blocks[blocks.length - 1];
            const lines = lastBlock.split('\n');
            const firstCodeLineIndex = lines.findIndex(line => {
                const trimmed = line.trim();
                return trimmed && !trimmed.startsWith('//');
            });

            if (firstCodeLineIndex !== -1) {
                lines[firstCodeLineIndex] = 'return ' + lines[firstCodeLineIndex];
            }

            const lastExpression = lines.join('\n');

            const wrappedCode = statements
                ? `${statements}\n\n${lastExpression}`
                : lastExpression;

            const fn = new AsyncFunction(...availableGlobals, wrappedCode);
            result = await fn.call(window, ...globalValues);
        }

        // Auto-play the pattern if it's a pattern object
        if (result && typeof result === 'object' && typeof result.play === 'function') {
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
    if (shareBtn) {
        shareBtn.disabled = true;
    }
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
        if (shareBtn) {
            shareBtn.disabled = false;
        }
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
