export class StrudelController {
    constructor(replElement) {
        this.repl = replElement;
        this.isPlaying = false;
        this.currentPattern = null;
        this.iframe = null;
    }

    initialize() {
        this.iframe = this.repl.querySelector('iframe');

        this.repl.addEventListener('ready', () => {
            console.log('Strudel REPL ready');
        });

        this.repl.addEventListener('started', () => {
            this.isPlaying = true;
            console.log('Pattern started');
        });

        this.repl.addEventListener('stopped', () => {
            this.isPlaying = false;
            console.log('Pattern stopped');
        });

        this.repl.addEventListener('error', (event) => {
            console.error('Strudel error:', event.detail);
        });
    }

    play() {
        if (!this.isPlaying && this.iframe) {
            const playButton = this.iframe.contentDocument?.querySelector('button[title="play"]') ||
                             this.iframe.contentDocument?.querySelector('button:has(img)');
            if (playButton) {
                playButton.click();
                this.isPlaying = true;
            }
        }
    }

    stop() {
        if (this.isPlaying && this.iframe) {
            const playButton = this.iframe.contentDocument?.querySelector('button[title="play"]') ||
                             this.iframe.contentDocument?.querySelector('button:has(img)');
            if (playButton) {
                playButton.click();
                this.isPlaying = false;
            }
        }
    }

    getCode() {
        const codeElement = this.repl.querySelector('script[type="text/strudel"]');
        if (codeElement) {
            return codeElement.textContent.trim();
        }

        if (this.iframe) {
            const editorContent = this.iframe.contentDocument?.querySelector('.cm-content');
            if (editorContent) {
                return editorContent.textContent.trim();
            }
        }

        return '';
    }

    setCode(code) {
        const codeElement = this.repl.querySelector('script[type="text/strudel"]');
        if (codeElement) {
            codeElement.textContent = code;
            this.repl.innerHTML = '';
            this.repl.appendChild(codeElement);
        }
    }

    getPlaybackState() {
        return {
            isPlaying: this.isPlaying,
            currentPattern: this.currentPattern
        };
    }

    async connectAudioDestination(destination) {
        if (this.repl.audioContext) {
            try {
                const source = this.repl.audioContext.destination;
                if (source && destination) {
                    source.connect(destination);
                    console.log('Connected Strudel audio to destination');
                }
            } catch (error) {
                console.warn('Could not connect audio destination:', error);
            }
        }
    }
}

export function handleKeyboardShortcuts(controller) {
    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.key === 'Enter') {
            event.preventDefault();
            controller.play();
        }

        if (event.ctrlKey && event.key === '.') {
            event.preventDefault();
            controller.stop();
        }
    });
}

export function waitForStrudelReady(replElement, timeout = 5000) {
    return new Promise((resolve) => {
        setTimeout(() => {
            console.log('Strudel embed initialization complete');
            resolve();
        }, timeout);
    });
}
