
# Architecture Sep 8 2025
## API Endpoints Used

Core APIs:
├── /api/global-settings (GET, PATCH) - Global app settings
├── /api/reflection (POST) - Save/fetch user reflections
├── /api/status (GET) - Service health check
├── /api/transcribe (POST) - Speech-to-text
├── /api/summarize (POST) - Text summarization
├── /api/emotions-hybrid (POST) - Emotion analysis
├── /api/voice/elevenlabs (POST) - TTS with ElevenLabs
├── /api/voice/elevenlabs/voices (GET) - Available voices
├── /api/voice-clone (POST) - Create voice clone
├── /api/voice-clone/improve (POST) - Replace voice clone
└── /api/voice-clone/delete (POST) - Delete voice clone


Current State Variables (32 total)
// Core Recording State
hasPermission: boolean | null
isRecording: boolean
isProcessing: boolean
processingStage: string
progress: number

// Session Management
sessions: SessionData[]
currentSession: SessionData | null
activeTab: string

// UI State
isAdmin: boolean
breathingPhase: "inhale" | "exhale"
isSpeaking: boolean
utteranceRef: SpeechSynthesisUtterance | null

// Audio/Media Refs (8 refs)
mediaRecorderRef: useRef<MediaRecorder | null>
audioChunksRef: useRef<Blob[]>
audioContextRef: useRef<AudioContext | null>
currentAudioRef: useRef<HTMLAudioElement | null>
analyserRef: useRef<AnalyserNode | null>
streamRef: useRef<MediaStream | null>
breathingTimerRef: useRef<NodeJS.Timeout | null>
recognitionRef: useRef<any>
isRecordingRef: useRef<boolean>
currentRecordingTimeRef: useRef<number>
fullRecognitionTranscriptRef: useRef<string>

// Error States
speechRecognitionError: string | null
transcriptionError: string | null
microphoneError: string | null

// Service Configuration
serviceStatus: { huggingface: boolean, google: boolean }
actualTTSService: string
userId: string

// Voice Clone State
userVoiceCloneId: string | null
isCloningVoice: boolean
hasVoiceClone: boolean
hasRequestedVoiceClone: boolean

// Global Settings
globalSettings: GlobalSettings | null
globalSettingsLoading: boolean
globalSettingsError: string | null

// Voice Selection (unused)
selectedElevenLabsVoice: string
elevenLabsVoices: {id: string, name: string}[]
selectedGoogleLang: string
selectedGoogleGender: string
selectedHumeVoice: string

// Dead Code (unused)
apiCredits: Record<string, string | null>
isCheckingCredits: boolean
liveTranscript: string
showLiveTranscript: boolean

# Current Functions (25+ functions)
// Core Recording Functions
checkMicrophonePermission()
initializeMicrophone()
requestMicrophoneAccess()
startRecording()
stopRecording()
startSpeechRecognition()

// Audio Processing
processAudio()
transcribeAudio()
analyzeVocalCharacteristics()
playChime()

// AI Services
generateSummary()
analyzeEmotions()
speakSummary()

// Voice Clone Management
handleVoiceClone()
handleDeleteVoiceClone()

// Data Management
fetchReflections()
saveReflectionToSupabase()
getDeviceInfo()
getBrowserInfo()
calculateWordCount()

// UI Helpers
formatTime()
stopSpeech()
checkApiCredits()
handleGlobalSettingsChange()


#Current UI Structure
TalkToMyself (Main Component)
├── Permission Screen (hasPermission === false)
├── Loading Screen (hasPermission === null)
├── Settings Loading Screen (globalSettingsLoading)
├── Error Screen (globalSettingsError)
└── Main App
    ├── Header (branding, badges, status)
    ├── Error Warnings (speech, transcription, mic errors)
    └── Tabs
        ├── Record Tab (mic button, status, guidance)
        ├── Summary Tab (current session summary + TTS controls)
        ├── Analysis Tab (emotions + vocal characteristics)
        ├── History Tab (session list)
        └── Settings Tab (admin only)