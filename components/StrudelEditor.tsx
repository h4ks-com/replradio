'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

const CodeMirror = dynamic(
  () => import('@uiw/react-codemirror').then(mod => mod.default),
  { ssr: false }
)

import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'

const DEFAULT_CODE = `// Welcome to H4KS STRUDEL REPL!

// Simple patterns work as-is
note("c a f e")
  .sound("sawtooth")
  .slow(2)

// For multi-statement code, await samples first:
// await samples('github:tidalcycles/Dirt-Samples/master')
//
// n("[0,3] 2").sound("piano").play()`

declare global {
  interface Window {
    initStrudel: () => Promise<void>
    hush: () => void
    Pattern: any
    mini: any
    perlin: any
    sine: any
    saw: any
    square: any
    tri: any
    rand: any
    cosine: any
    samples: any
    sounds: any
    s: any
    n: any
    note: any
    sound: any
    audioContextInstance: AudioContext | null
    evaluate: any
    transpiler: any
    repl: any
  }
}

export default function StrudelEditor() {
  const [code, setCode] = useState(DEFAULT_CODE)
  const [isPlaying, setIsPlaying] = useState(false)
  const [status, setStatus] = useState<{text: string, type: string}>({text: 'READY', type: ''})
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareStatus, setShareStatus] = useState<{text: string, type: string}>({text: '', type: ''})
  const [isRecording, setIsRecording] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const audioRecorderRef = useRef<any>(null)

  useEffect(() => {
    const initializeStrudel = async () => {
      try {
        console.log('[INIT] Step 1: Initializing Strudel audio engine')

        // Wait for Strudel to be available
        await new Promise<void>((resolve) => {
          const checkStrudel = setInterval(() => {
            if (typeof window.initStrudel !== 'undefined') {
              clearInterval(checkStrudel)
              resolve()
            }
          }, 100)
        })

        await window.initStrudel()

        console.log('[INIT] Step 2: Extending String.prototype')

        // Enable mini-notation on String.prototype
        if (typeof window.Pattern !== 'undefined') {
          String.prototype.mini = function() {
            return window.mini(this.valueOf())
          }

          const proto = window.Pattern.prototype
          Object.getOwnPropertyNames(proto).forEach(key => {
            if (key === 'constructor') return

            // Check if property already exists without triggering getters
            if (Object.getOwnPropertyDescriptor(String.prototype, key)) return

            try {
              const descriptor = Object.getOwnPropertyDescriptor(proto, key)

              if (descriptor && descriptor.value && typeof descriptor.value === 'function') {
                (String.prototype as any)[key] = function(...args: any[]) {
                  return window.mini(this.valueOf())[key](...args)
                }
              } else if (descriptor && descriptor.get) {
                Object.defineProperty(String.prototype, key, {
                  get() {
                    return window.mini(this.valueOf())[key]
                  },
                  configurable: true
                })
              }
            } catch (err) {
              // Skip properties that cause errors during setup
            }
          })
        }

        console.log('[INIT] Step 3: Strudel initialized - mini-notation enabled!')

        // Set up audio context interception for recording
        const OriginalAudioContext = window.AudioContext || (window as any).webkitAudioContext
        window.audioContextInstance = null

        ;(window as any).AudioContext = function(...args: any[]) {
          console.log('AudioContext created')
          window.audioContextInstance = new OriginalAudioContext(...args)
          return window.audioContextInstance
        }
        ;(window as any).webkitAudioContext = (window as any).AudioContext

        console.log('[INIT] Initialization complete!')
        setIsLoading(false)
      } catch (error) {
        console.error('Initialization error:', error)
        setIsLoading(false)
        alert('Initialization error: ' + (error as Error).message + '\n\nCheck console for details.')
      }
    }

    initializeStrudel()

    // Load code from URL if present
    const path = window.location.pathname
    if (path !== '/' && path !== '') {
      const codeId = path.replace(/^\//, '').replace(/\.txt$/, '')
      if (codeId.length === 5 && /^[a-zA-Z0-9]+$/.test(codeId)) {
        fetch(`/api/download/${codeId}`)
          .then(res => res.json())
          .then(data => {
            if (data.code) {
              setCode(data.code)
            }
          })
          .catch(err => {
            console.error('Failed to load code:', err)
          })
      }
    }
  }, [])

  const playCode = async () => {
    try {
      // Resume audio context if suspended
      if (window.audioContextInstance && window.audioContextInstance.state === 'suspended') {
        await window.audioContextInstance.resume()
        console.log('Audio context resumed')
      }

      // Evaluate code in global scope using indirect eval
      // This makes all window globals (perlin, sine, samples, etc.) accessible
      const globalEval = eval
      const result = globalEval(code)

      // Auto-play the pattern if it's a pattern object
      if (result && typeof result === 'object' && typeof result.play === 'function') {
        result.play()
      }

      setIsPlaying(true)
      setStatus({text: 'Playing', type: 'playing'})
    } catch (error) {
      console.error('Play error:', error)
      alert(`Error: ${(error as Error).message}`)
    }
  }

  const stopCode = () => {
    try {
      if (window.hush) {
        window.hush()
      }
      setIsPlaying(false)
      setStatus({text: 'Stopped', type: 'stopped'})
    } catch (error) {
      console.error('Stop error:', error)
    }
  }

  const togglePlayStop = () => {
    if (isPlaying) {
      stopCode()
    } else {
      playCode()
    }
  }

  const handleShare = async () => {
    setShowShareModal(false)
    setShareStatus({text: 'Generating share link...', type: 'loading'})

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      setShareStatus({text: `Link: ${data.url}`, type: 'success'})

      await navigator.clipboard.writeText(data.url)
      alert(`Share link copied to clipboard!\n\n${data.url}`)

      window.history.pushState({}, '', `/${data.code}`)
    } catch (error) {
      console.error('Share error:', error)
      setShareStatus({text: `Error: ${(error as Error).message}`, type: 'error'})
      alert(`Failed to share code: ${(error as Error).message}`)
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        togglePlayStop()
      }
      if (e.key === 'Escape' && showShareModal) {
        setShowShareModal(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPlaying, showShareModal])

  if (isLoading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0, 26, 0, 0.95)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        zIndex: 10000
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '4px solid #909090',
          borderTopColor: '#f0f0f0',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <div style={{
          marginTop: '20px',
          fontSize: '1.2rem',
          color: '#f0f0f0'
        }}>Initializing Strudel...</div>
      </div>
    )
  }

  return (
    <>
      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0.4; }
        }
      `}</style>

      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '20px',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Header */}
        <header style={{
          background: 'var(--bg-secondary)',
          border: '2px solid var(--border-color)',
          padding: '15px 20px',
          marginBottom: '15px',
          boxShadow: '0 0 20px rgba(0, 255, 0, 0.3)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '15px'
          }}>
            <img
              src="/assets/dj-icon.svg"
              alt="DJ Icon"
              width="48"
              height="48"
              style={{filter: 'drop-shadow(0 0 4px rgba(0, 255, 65, 0.3))'}}
            />
            <h1 style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              letterSpacing: '0.2em',
              color: 'var(--accent-green)',
              flex: 1
            }}>H4KS STRUDEL REPL</h1>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: 'var(--accent-green)',
                boxShadow: '0 0 8px var(--accent-green)',
                animation: 'blink 1s infinite'
              }} />
              <span style={{
                fontSize: '0.9rem',
                fontWeight: 'bold',
                color: status.type === 'playing' ? 'var(--accent-green)' : 'var(--text-primary)'
              }}>{status.text}</span>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 350px',
          gap: '20px'
        }}>
          {/* REPL Container */}
          <div style={{
            background: 'var(--bg-secondary)',
            border: '2px solid var(--border-color)',
            padding: '20px',
            boxShadow: '0 0 20px rgba(0, 255, 0, 0.2)'
          }}>
            {/* Controls */}
            <div style={{
              display: 'flex',
              gap: '10px',
              marginBottom: '15px',
              flexWrap: 'wrap',
              alignItems: 'center'
            }}>
              <button
                onClick={togglePlayStop}
                style={{
                  padding: '10px 20px',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--text-primary)',
                  fontFamily: 'inherit',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
                title="Play/Stop Pattern (Ctrl+Enter or Cmd+Enter)"
              >
                {isPlaying ? 'STOP' : 'PLAY'}
              </button>

              <button
                onClick={() => setShowShareModal(true)}
                disabled={!code.trim()}
                style={{
                  padding: '10px 20px',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--text-secondary)',
                  fontFamily: 'inherit',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  cursor: code.trim() ? 'pointer' : 'not-allowed',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  opacity: code.trim() ? 1 : 0.5
                }}
                title="Share Code"
              >
                SHARE
              </button>

              <button
                style={{
                  padding: '10px 20px',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--text-secondary)',
                  fontFamily: 'inherit',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
                title="Record Audio (Experimental)"
              >
                RECORD
              </button>

              {shareStatus.text && (
                <div style={{
                  marginLeft: 'auto',
                  fontSize: '0.85rem',
                  padding: '8px 12px',
                  border: `1px solid ${shareStatus.type === 'error' ? 'var(--error-text)' : 'var(--border-color)'}`,
                  background: shareStatus.type === 'error' ? 'var(--error-bg)' : 'var(--bg-primary)',
                  color: shareStatus.type === 'error' ? 'var(--error-text)' : 'var(--text-primary)',
                  minWidth: '200px'
                }}>
                  {shareStatus.text}
                </div>
              )}
            </div>

            {/* Editor */}
            <div style={{
              height: 'calc(100vh - 300px)',
              minHeight: '400px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)'
            }}>
              <CodeMirror
                value={code}
                height="100%"
                theme={oneDark}
                extensions={[javascript()]}
                onChange={(value) => setCode(value)}
                basicSetup={{
                  lineNumbers: true,
                  highlightActiveLineGutter: true,
                  highlightSpecialChars: true,
                  history: true,
                  foldGutter: true,
                  drawSelection: true,
                  dropCursor: true,
                  allowMultipleSelections: true,
                  indentOnInput: true,
                  syntaxHighlighting: true,
                  bracketMatching: true,
                  closeBrackets: true,
                  autocompletion: true,
                  rectangularSelection: true,
                  crosshairCursor: true,
                  highlightActiveLine: true,
                  highlightSelectionMatches: true,
                  closeBracketsKeymap: true,
                  defaultKeymap: true,
                  searchKeymap: true,
                  historyKeymap: true,
                  foldKeymap: true,
                  completionKeymap: true,
                  lintKeymap: true,
                }}
              />
            </div>
          </div>

          {/* Info Panel */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '15px'
          }}>
            <div style={{
              background: 'var(--bg-secondary)',
              border: '2px solid var(--border-color)',
              padding: '15px',
              boxShadow: '0 0 15px rgba(0, 255, 0, 0.15)'
            }}>
              <h3 style={{
                marginBottom: '10px',
                color: 'var(--text-primary)',
                fontSize: '1.1rem'
              }}>Quick Start</h3>
              <ul style={{
                listStyle: 'none',
                paddingLeft: 0
              }}>
                <li style={{padding: '5px 0', color: 'var(--text-secondary)'}}>
                  <span style={{color: 'var(--text-primary)'}}>{'> '}</span>
                  Edit code in the editor
                </li>
                <li style={{padding: '5px 0', color: 'var(--text-secondary)'}}>
                  <span style={{color: 'var(--text-primary)'}}>{'> '}</span>
                  Press PLAY or Ctrl+Enter (Cmd+Enter on Mac)
                </li>
                <li style={{padding: '5px 0', color: 'var(--text-secondary)'}}>
                  <span style={{color: 'var(--text-primary)'}}>{'> '}</span>
                  Press again to stop
                </li>
                <li style={{padding: '5px 0', color: 'var(--text-secondary)'}}>
                  <span style={{color: 'var(--text-primary)'}}>{'> '}</span>
                  Click SHARE to get a link
                </li>
              </ul>
            </div>

            <div style={{
              background: 'var(--bg-secondary)',
              border: '2px solid var(--border-color)',
              padding: '15px',
              boxShadow: '0 0 15px rgba(0, 255, 0, 0.15)'
            }}>
              <h3 style={{
                marginBottom: '10px',
                color: 'var(--text-primary)',
                fontSize: '1.1rem'
              }}>Strudel REPL</h3>
              <p style={{
                color: 'var(--text-secondary)',
                marginBottom: '10px'
              }}>For playing around and testing patterns, use the official REPL:</p>
              <a
                href="https://strudel.cc/"
                target="_blank"
                rel="noopener"
                style={{
                  color: 'var(--accent-green)',
                  textDecoration: 'none',
                  display: 'block',
                  padding: '8px 12px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  transition: 'all 0.2s'
                }}
              >
                strudel.cc
              </a>
              <p style={{
                color: 'var(--text-secondary)',
                marginTop: '12px'
              }}>This site is focused on rendering audio and sharing code.</p>
            </div>

            <div style={{
              background: 'var(--bg-secondary)',
              border: '2px solid var(--border-color)',
              padding: '15px',
              boxShadow: '0 0 15px rgba(0, 255, 0, 0.15)'
            }}>
              <h3 style={{
                marginBottom: '10px',
                color: 'var(--text-primary)',
                fontSize: '1.1rem'
              }}>Examples</h3>
              <p style={{
                color: 'var(--text-secondary)',
                marginBottom: '10px'
              }}>Check out patterns and tutorials at:</p>
              <a
                href="https://strudel.cc/examples/"
                target="_blank"
                rel="noopener"
                style={{
                  color: 'var(--accent-green)',
                  textDecoration: 'none',
                  display: 'block',
                  padding: '8px 12px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)'
                }}
              >
                strudel.cc/examples/
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowShareModal(false)
            }
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            backdropFilter: 'blur(4px)'
          }}
        >
          <div style={{
            background: 'var(--bg-secondary)',
            border: '2px solid var(--border-color)',
            boxShadow: '0 0 30px rgba(0, 255, 65, 0.3)',
            maxWidth: '500px',
            width: '90%',
            animation: 'modalFadeIn 0.3s ease-out'
          }}>
            <div style={{
              padding: '20px',
              borderBottom: '1px solid var(--border-color)'
            }}>
              <h2 style={{
                margin: 0,
                fontSize: '1.3rem',
                color: 'var(--accent-green)'
              }}>Share Your Code</h2>
            </div>

            <div style={{padding: '20px'}}>
              <p style={{
                margin: '0 0 15px 0',
                color: 'var(--warning-text)',
                background: 'var(--warning-bg)',
                padding: '12px',
                border: '1px solid var(--warning-text)',
                fontWeight: 'bold'
              }}>
                WARNING: Shared code will be automatically deleted after 24 hours.
              </p>
              <p style={{
                margin: 0,
                color: 'var(--text-secondary)',
                lineHeight: 1.6
              }}>
                A shareable link will be generated and copied to your clipboard.
              </p>
            </div>

            <div style={{
              padding: '20px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                onClick={() => setShowShareModal(false)}
                style={{
                  padding: '10px 20px',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--text-secondary)',
                  fontFamily: 'inherit',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  minWidth: '100px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleShare}
                style={{
                  padding: '10px 20px',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--text-primary)',
                  fontFamily: 'inherit',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  minWidth: '100px'
                }}
              >
                Generate Link
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
