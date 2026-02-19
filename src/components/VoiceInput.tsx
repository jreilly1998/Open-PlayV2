'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { GroupData } from '@/lib/types'
import { createGroup, checkInGroup, teeOff, moveToQueue } from '@/lib/api'

// ---------------------------------------------------------------------------
// SpeechRecognition global declarations
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition;
  new(): SpeechRecognition;
};

declare var webkitSpeechRecognition: {
  prototype: SpeechRecognition;
  new(): SpeechRecognition;
};

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
  // Common homophones / speech-recognition mishearings
  'for': 4,
}

function parseSizeWord(word: string): number | null {
  return SIZE_WORDS[word.toLowerCase()] ?? null
}

/** Map a digit or word to its "-some" form for normalization use. */
function normalizeSizeToWord(s: string): string {
  const map: Record<string, string> = {
    '1': 'single', 'one': 'single',
    '2': 'twosome', 'two': 'twosome',
    '3': 'threesome', 'three': 'threesome',
    '4': 'foursome', 'four': 'foursome',
  }
  return map[s] ?? s
}

/**
 * Normalize a raw voice transcript so the parser can handle common
 * speech-recognition variations and casual phrasing.
 *
 * Examples:
 *   "Add Ryan 4some to queue"   → "add ryan foursome to queue"
 *   "add Smith three some"      → "add smith threesome"
 *   "check in Garcia"           → "check in garcia"      (unchanged – already valid)
 *   "Teed off Johnson"          → "tee off johnson"
 *   "add ryan party of 4"       → "add ryan foursome"
 *   "add ryan 4 players"        → "add ryan foursome"
 */
function normalizeTranscript(raw: string): string {
  let text = raw.toLowerCase().trim()

  // "4some" / "3some" / "2some" → spelled-out word (before digit→word replacement)
  text = text.replace(/\b4some\b/g, 'foursome')
  text = text.replace(/\b3some\b/g, 'threesome')
  text = text.replace(/\b2some\b/g, 'twosome')

  // Standalone digits → words
  text = text.replace(/\b4\b/g, 'four')
  text = text.replace(/\b3\b/g, 'three')
  text = text.replace(/\b2\b/g, 'two')
  text = text.replace(/\b1\b/g, 'one')

  // "four some" / "three some" / "two some" → compound word
  text = text.replace(/\bfour\s+some\b/g, 'foursome')
  text = text.replace(/\bthree\s+some\b/g, 'threesome')
  text = text.replace(/\btwo\s+some\b/g, 'twosome')

  // "group/party of N" and "N people/players/golfers" → canonical size word
  text = text.replace(
    /\b(?:group|party)\s+of\s+(one|two|three|four)\b/g,
    (_, n) => normalizeSizeToWord(n),
  )
  text = text.replace(
    /\b(one|two|three|four)\s+(?:people|players?|persons?|golfers?)\b/g,
    (_, n) => normalizeSizeToWord(n),
  )

  // Past tense → present: "teed off" → "tee off", "checked in" → "check in"
  text = text.replace(/\bteed\s+off\b/g, 'tee off')
  text = text.replace(/\bchecked\s+in\b/g, 'check in')

  // Collapse extra whitespace
  text = text.replace(/\s+/g, ' ').trim()

  return text
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
 * Parse a *normalized* voice transcript into a structured action.
 * Call normalizeTranscript() on the raw input before passing it here.
 * Returns null when the transcript doesn't match any known command.
 */
function parseCommand(normalizedText: string, groups: GroupData[]): ParsedAction | null {
  const text = normalizedText // already lowercased & normalized
  const words = text.split(/\s+/)

  // ── ADD ──────────────────────────────────────────────────────────────────
  // Patterns (after normalization):
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

    // Walk from the end to find the first token that is a size word
    for (let i = tokens.length - 1; i >= 1; i--) {
      const size = parseSizeWord(tokens[i])
      if (size !== null) {
        const name = capitalize(tokens.slice(0, i).join(' '))
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
  // "mark [name] as here" OR "mark [name] here"
  const markMatch = text.match(/^mark\s+(.+?)\s+(?:as\s+)?here/)
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

  // "[name] is here" OR just "[name] here"
  const isHereMatch = text.match(/^(.+?)\s+(?:is\s+)?here$/)
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
  // "tee off [name]"  (normalization already converts "teed off" → "tee off")
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
  // "move [name] to queue" or "move [name] to the queue"
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

/**
 * When strict parsing fails, try to infer the most likely intent and return a
 * suggested action the user can confirm with one tap.
 */
function suggestCommand(normalizedText: string, groups: GroupData[]): ParsedAction | null {
  const words = normalizedText.split(/\s+/)

  // ── ADD suggestion ───────────────────────────────────────────────────────
  if (words[0] === 'add' && words.length >= 2) {
    const noiseWords = new Set(['to', 'the', 'queue', 'a', 'an', 'please', 'um', 'uh'])
    const meaningful = words.slice(1).filter(w => !noiseWords.has(w))

    let size = 4 // sensible default
    let nameTokens = meaningful

    // Search from the end for a size word
    for (let i = meaningful.length - 1; i >= 0; i--) {
      const s = parseSizeWord(meaningful[i])
      if (s !== null) {
        size = s
        nameTokens = meaningful.slice(0, i)
        break
      }
    }

    if (nameTokens.length > 0) {
      const name = capitalize(nameTokens.join(' '))
      const allPresent = normalizedText.includes('queue')
      return {
        type: 'add',
        description: `Add ${name} (party of ${size}) to ${allPresent ? 'queue' : 'assembling'}`,
        name,
        partySize: size,
        allPresent,
      }
    }
  }

  // ── Group-action suggestion (check-in / tee-off / move) ──────────────────
  // Find any group whose name appears in the transcript
  const mentionedGroup = groups.find(g => {
    const lower = g.name.toLowerCase()
    return (
      normalizedText.includes(lower) ||
      lower.split(/\s+/).some(part => part.length > 2 && normalizedText.includes(part))
    )
  })

  if (mentionedGroup) {
    if (/\b(?:here|arrived?|check)\b/.test(normalizedText)) {
      return {
        type: 'check-in',
        description: `Mark ${mentionedGroup.name} as here (check in all members)`,
        groupId: mentionedGroup.id,
        groupName: mentionedGroup.name,
      }
    }
    if (/\b(?:tee|off|play|start|go|course|going)\b/.test(normalizedText)) {
      return {
        type: 'tee-off',
        description: `Tee off ${mentionedGroup.name}`,
        groupId: mentionedGroup.id,
        groupName: mentionedGroup.name,
      }
    }
    if (/\b(?:move|queue|ready|next)\b/.test(normalizedText)) {
      return {
        type: 'move-to-queue',
        description: `Move ${mentionedGroup.name} to queue`,
        groupId: mentionedGroup.id,
        groupName: mentionedGroup.name,
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
  const [suggestion, setSuggestion] = useState<ParsedAction | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  // Keep a ref to the latest groups so the recognition callback always matches
  // against up-to-date data even when called a moment after render.
  const groupsRef = useRef(groups)
  useEffect(() => { groupsRef.current = groups }, [groups])

  const recognitionRef = useRef<SpeechRecognition | null>(null)

  // Check browser support on mount (client-side only)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) setVoiceState('unsupported')
  }, [])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch { /* ignore */ }
      recognitionRef.current = null
    }
  }, [])

  const startListening = useCallback(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SpeechRecognitionAPI) {
      setVoiceState('unsupported')
      return
    }

    const recognition: SpeechRecognition = new SpeechRecognitionAPI()
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

      const normalized = normalizeTranscript(finalTranscript)
      const action = parseCommand(normalized, groupsRef.current)
      if (action) {
        setParsedAction(action)
        setSuggestion(null)
        setVoiceState('confirming')
      } else {
        const suggested = suggestCommand(normalized, groupsRef.current)
        setSuggestion(suggested)
        setErrorMessage(`Command not recognized.`)
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
    setSuggestion(null)
    setErrorMessage('')
  }, [stopListening])

  const handleTryAgain = useCallback(() => {
    setErrorMessage('')
    setTranscript('')
    setSuggestion(null)
    setVoiceState('idle')
    // Small delay so the modal closes before reopening
    setTimeout(() => startListening(), 150)
  }, [startListening])

  /** Accept the auto-suggested action and move to confirmation. */
  const handleSuggest = useCallback(() => {
    if (!suggestion) return
    setParsedAction(suggestion)
    setSuggestion(null)
    setErrorMessage('')
    setVoiceState('confirming')
  }, [suggestion])

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
                    <p>• &ldquo;Add Smith foursome&rdquo; / &ldquo;Add Smith 4some&rdquo;</p>
                    <p>• &ldquo;Johnson is here&rdquo; / &ldquo;Check in Johnson&rdquo;</p>
                    <p>• &ldquo;Tee off Williams&rdquo; / &ldquo;Williams teed off&rdquo;</p>
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

                  {/* Always show what was heard */}
                  {transcript && (
                    <>
                      <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">I heard:</p>
                      <p className="text-white text-sm italic bg-gray-700 rounded-lg px-3 py-2 mb-4">
                        &ldquo;{transcript}&rdquo;
                      </p>
                    </>
                  )}

                  {/* Smart suggestion when available */}
                  {suggestion ? (
                    <div className="bg-yellow-900/30 border border-yellow-700/40 rounded-lg px-3 py-3 mb-2">
                      <p className="text-yellow-300 text-sm font-medium mb-1">Did you mean:</p>
                      <p className="text-white text-sm font-semibold">{suggestion.description}</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-gray-300 text-sm mb-4">{errorMessage}</p>
                      <div className="bg-gray-700/60 rounded-lg p-3 text-xs text-gray-400 space-y-1">
                        <p className="font-semibold text-gray-300 mb-1.5">Supported commands:</p>
                        <p>• &ldquo;Add [name] foursome&rdquo; / &ldquo;Add [name] 4some&rdquo;</p>
                        <p>• &ldquo;Add [name] [1–4] to queue&rdquo;</p>
                        <p>• &ldquo;Mark [name] here&rdquo; / &ldquo;[name] is here&rdquo;</p>
                        <p>• &ldquo;Check in [name]&rdquo;</p>
                        <p>• &ldquo;Tee off [name]&rdquo; / &ldquo;[name] teed off&rdquo;</p>
                        <p>• &ldquo;Move [name] to queue&rdquo;</p>
                      </div>
                    </>
                  )}
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
                  {suggestion && (
                    <>
                      <div className="w-px bg-gray-700" />
                      <button
                        onClick={handleSuggest}
                        className="flex-1 py-4 text-yellow-400 font-bold hover:bg-gray-700 active:bg-gray-600 transition-colors"
                      >
                        Yes, Do It
                      </button>
                    </>
                  )}
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </>
  )
}
