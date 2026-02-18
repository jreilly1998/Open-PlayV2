'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { GroupData } from '@/lib/types'
import { createGroup, checkInGroup, teeOff, moveToQueue } from '@/lib/api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VoiceState = 'idle' | 'listening' | 'confirming' | 'executing' | 'error' | 'unsupported'

interface ParsedAction {
  type: 'add' | 'check-in' | 'tee-off' | 'move-to-queue'
  description: string
  // 'add' fields
  name?: string
  partySize?: number
  allPresent?: boolean
  // action-on-group fields
  groupId?: string
  groupName?: string
}

interface VoiceInputProps {
  /** Combined queued + assembling groups for name matching */
  groups: GroupData[]
  onRefetch: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SIZE_WORDS: Record<string, number> = {
  one: 1, single: 1, '1': 1,
  two: 2, twosome: 2, '2': 2,
  three: 3, threesome: 3, '3': 3,
  four: 4, foursome: 4, '4': 4,
}

function parseSizeWord(word: string): number | null {
  return SIZE_WORDS[word.toLowerCase()] ?? null
}

function capitalize(str: string): string {
  return str.replace(/\b\w/g, c => c.toUpperCase())
}

/** Find the best-matching group by partial name. */
function findGroup(fragment: string, groups: GroupData[]): GroupData | null {
  const lower = fragment.toLowerCase().trim()
  if (!lower) return null

  const exact = groups.find(g => g.name.toLowerCase() === lower)
  if (exact) return exact

  // Substring match — group name contains spoken fragment or vice-versa
  const contains = groups.find(
    g => g.name.toLowerCase().includes(lower) || lower.includes(g.name.toLowerCase())
  )
  return contains ?? null
}

/**
 * Parse a raw voice transcript into a structured action.
 * Returns null when the transcript doesn't match any known command.
 */
function parseCommand(raw: string, groups: GroupData[]): ParsedAction | null {
  const text = raw.toLowerCase().trim()
  const words = text.split(/\s+/)

  // ── ADD ──────────────────────────────────────────────────────────────────
  // Patterns:
  //   "add [name] [size]"
  //   "add [name] [size] to queue"  → allPresent = true
  if (words[0] === 'add' && words.length >= 3) {
    let tokens = words.slice(1)

    // Strip optional "to queue" or "to the queue" suffix
    const toQueueSuffix = tokens.join(' ').match(/^(.+?)\s+to\s+(the\s+)?queue$/)
    const allPresent = !!toQueueSuffix
    if (toQueueSuffix) {
      tokens = toQueueSuffix[1].split(/\s+/)
    }

    // Last token should be a size word; everything before is the name
    if (tokens.length >= 2) {
      const lastToken = tokens[tokens.length - 1]
      const size = parseSizeWord(lastToken)
      if (size !== null) {
        const name = capitalize(tokens.slice(0, -1).join(' '))
        return {
          type: 'add',
          description: `Add ${name} (party of ${size}) to ${allPresent ? 'queue' : 'assembling'}`,
          name,
          partySize: size,
          allPresent,
        }
      }
    }
  }

  // ── MARK AS HERE / CHECK-IN ───────────────────────────────────────────────
  // "mark [name] as here"
  const markMatch = text.match(/^mark\s+(.+?)\s+as\s+here/)
  if (markMatch) {
    const group = findGroup(markMatch[1], groups)
    if (group) {
      return {
        type: 'check-in',
        description: `Mark ${group.name} as here (check in all members)`,
        groupId: group.id,
        groupName: group.name,
      }
    }
  }

  // "[name] is here"
  const isHereMatch = text.match(/^(.+?)\s+is\s+here/)
  if (isHereMatch) {
    const group = findGroup(isHereMatch[1], groups)
    if (group) {
      return {
        type: 'check-in',
        description: `Mark ${group.name} as here (check in all members)`,
        groupId: group.id,
        groupName: group.name,
      }
    }
  }

  // "check in [name]"
  const checkInMatch = text.match(/^check\s+in\s+(.+)/)
  if (checkInMatch) {
    const group = findGroup(checkInMatch[1], groups)
    if (group) {
      return {
        type: 'check-in',
        description: `Check in ${group.name}`,
        groupId: group.id,
        groupName: group.name,
      }
    }
  }

  // ── TEE OFF ───────────────────────────────────────────────────────────────
  // "tee off [name]"
  const teeOffPrefixMatch = text.match(/^tee\s+off\s+(.+)/)
  if (teeOffPrefixMatch) {
    const group = findGroup(teeOffPrefixMatch[1], groups)
    if (group) {
      return {
        type: 'tee-off',
        description: `Tee off ${group.name}`,
        groupId: group.id,
        groupName: group.name,
      }
    }
  }

  // "[name] tee off"
  const teeOffSuffixMatch = text.match(/^(.+?)\s+tee[\s-]?off$/)
  if (teeOffSuffixMatch) {
    const group = findGroup(teeOffSuffixMatch[1], groups)
    if (group) {
      return {
        type: 'tee-off',
        description: `Tee off ${group.name}`,
        groupId: group.id,
        groupName: group.name,
      }
    }
  }

  // ── MOVE TO QUEUE ─────────────────────────────────────────────────────────
  // "move [name] to queue"
  const moveMatch = text.match(/^move\s+(.+?)\s+to\s+(the\s+)?queue/)
  if (moveMatch) {
    const group = findGroup(moveMatch[1], groups)
    if (group) {
      return {
        type: 'move-to-queue',
        description: `Move ${group.name} to queue`,
        groupId: group.id,
        groupName: group.name,
      }
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MicIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
      />
    </svg>
  )
}

function VoiceWaves() {
  return (
    <div className="flex items-end gap-1 h-10" aria-hidden>
      {[0, 1, 2, 3, 4].map(i => (
        <div
          key={i}
          className="w-2 bg-queue-green rounded-full voice-wave"
          style={{ animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function VoiceInput({ groups, onRefetch }: VoiceInputProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [parsedAction, setParsedAction] = useState<ParsedAction | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  // Keep a ref to the latest groups so the recognition callback always matches
  // against up-to-date data even when called a moment after render.
  const groupsRef = useRef(groups)
  useEffect(() => { groupsRef.current = groups }, [groups])

  const recognitionRef = useRef<SpeechRecognition | null>(null)

  // Check browser support on mount (client-side only)
  useEffect(() => {
    if (typeof window === 'undefined') return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SR) setVoiceState('unsupported')
  }, [])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch { /* ignore */ }
      recognitionRef.current = null
    }
  }, [])

  const startListening = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SR) {
      setVoiceState('unsupported')
      return
    }

    const recognition: SpeechRecognition = new SR()
    recognitionRef.current = recognition
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    // Track the final transcript locally so onend always has the right value
    let finalTranscript = ''

    recognition.onstart = () => {
      setVoiceState('listening')
      setTranscript('')
      setInterimTranscript('')
      finalTranscript = ''
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscript += result[0].transcript
        } else {
          interim += result[0].transcript
        }
      }
      setTranscript(finalTranscript)
      setInterimTranscript(interim)
    }

    recognition.onend = () => {
      recognitionRef.current = null
      setInterimTranscript('')

      if (!finalTranscript.trim()) {
        // Nothing heard — silently return to idle
        setVoiceState('idle')
        return
      }

      const action = parseCommand(finalTranscript, groupsRef.current)
      if (action) {
        setParsedAction(action)
        setVoiceState('confirming')
      } else {
        setErrorMessage(`I didn't understand "${finalTranscript}". Please try again.`)
        setVoiceState('error')
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      recognitionRef.current = null
      if (event.error === 'aborted') {
        // Deliberate cancel — don't show an error
        setVoiceState('idle')
        return
      }
      if (event.error === 'not-allowed') {
        setErrorMessage('Microphone access was denied. Please allow microphone permissions and try again.')
      } else if (event.error === 'no-speech') {
        setErrorMessage('No speech was detected. Please try again.')
      } else {
        setErrorMessage(`Voice recognition error: ${event.error}. Please try again.`)
      }
      setVoiceState('error')
    }

    try {
      recognition.start()
    } catch {
      setErrorMessage('Failed to start voice recognition. Please try again.')
      setVoiceState('error')
    }
  }, [])

  const handleConfirm = useCallback(async () => {
    if (!parsedAction) return
    setVoiceState('executing')
    try {
      switch (parsedAction.type) {
        case 'add':
          await createGroup({
            name: parsedAction.name!,
            partySize: parsedAction.partySize!,
            allPresent: parsedAction.allPresent ?? false,
          })
          break
        case 'check-in':
          await checkInGroup(parsedAction.groupId!)
          break
        case 'tee-off':
          await teeOff(parsedAction.groupId!)
          break
        case 'move-to-queue':
          await moveToQueue(parsedAction.groupId!)
          break
      }
      onRefetch()
      setVoiceState('idle')
      setTranscript('')
      setParsedAction(null)
    } catch {
      setErrorMessage('Failed to execute command. Please try again.')
      setVoiceState('error')
    }
  }, [parsedAction, onRefetch])

  const handleCancel = useCallback(() => {
    stopListening()
    setVoiceState('idle')
    setTranscript('')
    setInterimTranscript('')
    setParsedAction(null)
    setErrorMessage('')
  }, [stopListening])

  const handleTryAgain = useCallback(() => {
    setErrorMessage('')
    setTranscript('')
    setVoiceState('idle')
    // Small delay so the modal closes before reopening
    setTimeout(() => startListening(), 150)
  }, [startListening])

  // Cleanup on unmount
  useEffect(() => () => stopListening(), [stopListening])

  // ── Render ──────────────────────────────────────────────────────────────

  const isOverlayOpen = voiceState === 'listening' || voiceState === 'confirming' || voiceState === 'error'

  return (
    <>
      {/* ── Floating Microphone Button ── */}
      <button
        onClick={voiceState === 'idle' ? startListening : undefined}
        disabled={voiceState === 'unsupported' || voiceState === 'executing'}
        className={[
          'fixed bottom-14 right-4 z-50 w-14 h-14 rounded-full shadow-xl',
          'flex items-center justify-center transition-all duration-200',
          voiceState === 'unsupported'
            ? 'bg-gray-400 text-white cursor-not-allowed opacity-50'
            : voiceState === 'listening'
            ? 'bg-red-500 text-white mic-pulse cursor-default'
            : voiceState === 'executing'
            ? 'bg-queue-green text-white cursor-default'
            : 'bg-queue-green text-white hover:bg-green-700 active:scale-95 cursor-pointer',
        ].join(' ')}
        title={
          voiceState === 'unsupported'
            ? 'Voice input not supported in this browser'
            : voiceState === 'listening'
            ? 'Listening…'
            : 'Voice command'
        }
        aria-label="Start voice command"
      >
        {voiceState === 'executing' ? (
          <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <MicIcon />
        )}
      </button>

      {/* ── Overlay ── */}
      {isOverlayOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-4"
          onClick={voiceState === 'listening' ? handleCancel : undefined}
        >
          <div
            className="bg-gray-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden fade-in"
            onClick={e => e.stopPropagation()}
          >

            {/* ── Listening panel ── */}
            {voiceState === 'listening' && (
              <>
                <div className="p-6 flex flex-col items-center gap-4">
                  <VoiceWaves />

                  <p className="text-white font-bold text-lg tracking-wide">Listening…</p>

                  {/* Real-time transcription */}
                  <div className="min-h-[40px] w-full text-center px-2">
                    {(transcript || interimTranscript) ? (
                      <p className="text-gray-300 text-sm italic">
                        &ldquo;{transcript || interimTranscript}&rdquo;
                      </p>
                    ) : (
                      <p className="text-gray-500 text-xs">Speak your command…</p>
                    )}
                  </div>

                  {/* Hint */}
                  <div className="bg-gray-700/60 rounded-lg px-4 py-3 w-full text-xs text-gray-400 space-y-1">
                    <p className="font-semibold text-gray-300 mb-1.5">Try saying:</p>
                    <p>• &ldquo;Add Smith foursome&rdquo;</p>
                    <p>• &ldquo;Mark Johnson as here&rdquo;</p>
                    <p>• &ldquo;Tee off Williams&rdquo;</p>
                    <p>• &ldquo;Move Davis to queue&rdquo;</p>
                  </div>
                </div>

                <button
                  onClick={handleCancel}
                  className="w-full py-4 bg-gray-700 text-gray-300 font-semibold hover:bg-gray-600 active:bg-gray-500 transition-colors"
                >
                  Cancel
                </button>
              </>
            )}

            {/* ── Confirmation panel ── */}
            {voiceState === 'confirming' && parsedAction && (
              <>
                <div className="p-6">
                  <h3 className="text-white font-bold text-lg mb-4">Confirm Command</h3>

                  <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">I heard:</p>
                  <p className="text-white text-sm italic bg-gray-700 rounded-lg px-3 py-2 mb-4">
                    &ldquo;{transcript}&rdquo;
                  </p>

                  <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Action:</p>
                  <div className="bg-green-900/40 border border-green-700/50 rounded-lg px-3 py-2.5 mb-4">
                    <p className="text-green-400 font-semibold text-sm">{parsedAction.description}</p>
                  </div>

                  <p className="text-gray-400 text-sm">Is this correct?</p>
                </div>

                <div className="flex border-t border-gray-700">
                  <button
                    onClick={handleCancel}
                    className="flex-1 py-4 text-gray-300 font-semibold hover:bg-gray-700 active:bg-gray-600 transition-colors"
                  >
                    No, Cancel
                  </button>
                  <div className="w-px bg-gray-700" />
                  <button
                    onClick={handleConfirm}
                    className="flex-1 py-4 text-green-400 font-bold hover:bg-gray-700 active:bg-gray-600 transition-colors"
                  >
                    Yes, Do It
                  </button>
                </div>
              </>
            )}

            {/* ── Error panel ── */}
            {voiceState === 'error' && (
              <>
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <h3 className="text-white font-bold text-lg">Not Recognised</h3>
                  </div>

                  <p className="text-gray-300 text-sm mb-4">{errorMessage}</p>

                  <div className="bg-gray-700/60 rounded-lg p-3 text-xs text-gray-400 space-y-1">
                    <p className="font-semibold text-gray-300 mb-1.5">Supported commands:</p>
                    <p>• &ldquo;Add [name] foursome/threesome/twosome/single&rdquo;</p>
                    <p>• &ldquo;Add [name] [1–4] to queue&rdquo;</p>
                    <p>• &ldquo;Mark [name] as here&rdquo; / &ldquo;[name] is here&rdquo;</p>
                    <p>• &ldquo;Tee off [name]&rdquo;</p>
                    <p>• &ldquo;Move [name] to queue&rdquo;</p>
                  </div>
                </div>

                <div className="flex border-t border-gray-700">
                  <button
                    onClick={handleCancel}
                    className="flex-1 py-4 text-gray-300 font-semibold hover:bg-gray-700 active:bg-gray-600 transition-colors"
                  >
                    Close
                  </button>
                  <div className="w-px bg-gray-700" />
                  <button
                    onClick={handleTryAgain}
                    className="flex-1 py-4 text-queue-green font-bold hover:bg-gray-700 active:bg-gray-600 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </>
  )
}
