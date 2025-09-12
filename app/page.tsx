"use client"

// Add this at the top for TypeScript to recognize process.env in Next.js
// @ts-ignore
declare var process: {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: string; // Public: Supabase project URL for browser
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string; // Public: Supabase anon key for browser
    NEXT_PUBLIC_ADMIN_SECRET?: string; // Public: Optional admin secret for browser admin features
  };
};

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  Mic,
  MicOff,
  Settings,
  History,
  Brain,
  FileText,
  BarChart3,
  Shield,
  Volume2,
  Sparkles,
  Heart,
  Waves,
  AlertCircle,
  // 🗑️ DEAD CODE: These icons are imported but never used in the UI - can be removed
  CheckCircle,
  Lock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { v4 as uuidv4 } from 'uuid';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { VocalCharacteristics, EmotionAnalysis, SessionData, GlobalSettings } from "@/types";
import { API_ENDPOINTS, AUDIO_CONSTANTS, UI_CONSTANTS, DEFAULT_VALUES, SPEECH_TRIGGERS } from "@/constants";
import { calculateWordCount, formatTime, getDeviceInfo, getBrowserInfo, playChime } from "@/utils";
import { LoadingStates } from "@/components/LoadingStates";
import { BackgroundElements } from "@/components/BackgroundElements";
import { AppHeader } from "@/components/AppHeader";
import { useSettings } from "@/hooks/useSettings";
import { useServiceStatus } from "@/hooks/useServiceStatus";


// Initialize Supabase client for browser use. These values are public and safe to expose.
// Make sure to set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env and Vercel dashboard.
const supabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);


// Add browser detection utilities at the top of the component:
// 🗑️ DEAD CODE: These browser detection variables are defined but never used - can be removed
const isSafari = typeof window !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
const isFirefox = typeof window !== 'undefined' && navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

export default function TalkToMyself() {
  // All hooks must be declared here, before any return statement
  const [hasPermission, setHasPermission] = useState<boolean | null>(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  // Removed old local settings - now using global settings only
  // 🗑️ DEAD CODE: This breathing animation is purely cosmetic - can be removed if you want to simplify the UI
  // 🗑️ DEAD CODE: This entire API credit system is unused - can be removed
  const [apiCredits, setApiCredits] = useState<Record<string, string | null>>({})
  const [isCheckingCredits, setIsCheckingCredits] = useState(false)
  // Removed isPaused state - simplified to just stop button
  const [utteranceRef, setUtteranceRef] = useState<SpeechSynthesisUtterance | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  // 🗑️ DEAD CODE: These audio analysis refs are created but the audio analysis is never displayed - can be removed
  const audioContextRef = useRef<AudioContext | null>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const breathingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const recognitionRef = useRef<any>(null)
  const isRecordingRef = useRef(false)
  const currentRecordingTimeRef = useRef(0)
  // 🗑️ DEAD CODE: Live transcript is captured but never displayed in the UI - can be removed
  const { toast } = useToast();
  const fullRecognitionTranscriptRef = useRef("");
  const [actualTTSService, setActualTTSService] = useState<string>("browser");
  const [userId, setUserId] = useState<string>("");
  
  // Sessions state management - reverted from useSessions hook for simplicity
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [currentSession, setCurrentSession] = useState<SessionData | null>(null);

  // Fetch reflections from API route for the current user
  const fetchReflections = async (userId: string) => {
    if (!userId) return [];
    try {
      console.log("Fetching reflections for user:", userId);
      const res = await fetch(API_ENDPOINTS.REFLECTION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      console.log("Fetch response status:", res.status);

      if (!res.ok) {
        console.error("Failed to fetch reflections:", res.status, res.statusText);
        toast({
          title: "Error",
          description: "Failed to fetch reflection history",
          variant: "destructive",
        });
        return [];
      }

      const data = await res.json();
      console.log("Raw reflection data from API:", data);

      // Map DB rows to SessionData shape
      const mappedSessions = (data.reflections || []).map((row: any) => {
        console.log("Mapping row:", row);
        return {
          id: row.id,
          timestamp: new Date(row.created_at),
          transcript: row.transcript,
          summary: row.summary,
          emotions: row.emotions || [],
          vocalCharacteristics: row.vocal || {},
          audioBlob: undefined, // Not stored in DB
          recordingDuration: (() => {
            // New format: duration stored in device_info.recording_duration_seconds
            if (row.device_info && typeof row.device_info === 'object' && row.device_info.recording_duration_seconds) {
              return row.device_info.recording_duration_seconds;
            }
            // Fallback: return 0 for old records without duration
            return 0;
          })(),
        };
      });

      console.log("Mapped sessions:", mappedSessions);
      return mappedSessions;
    } catch (err) {
      console.error("Error fetching reflections:", err);
      toast({
        title: "Error",
        description: "Failed to fetch reflection history",
        variant: "destructive",
      });
      return [];
    }
  };

  // Save reflection to Supabase
  const saveReflectionToSupabase = async (reflection: any) => {
    try {
      console.log("Attempting to save reflection to Supabase:", reflection);
      const res = await fetch(API_ENDPOINTS.REFLECTION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reflection),
      });

      const responseData = await res.json();
      console.log("Supabase save response:", responseData);

        if (!res.ok) {
        console.error("Failed to save reflection:", res.status, res.statusText);
        toast({
          title: "Error",
          description: "Failed to save reflection",
          variant: "destructive",
        });
      } else {
        console.log("Successfully saved reflection to Supabase");
        // Re-fetch history after successful save
        if (userId) {
          console.log("Re-fetching reflections for user:", userId);
          const updatedSessions = await fetchReflections(userId);
          console.log("Updated sessions:", updatedSessions);
          setSessions(updatedSessions);
        }
      }
    } catch (err) {
      console.error("Error saving reflection:", err);
      toast({
        title: "Error",
        description: "Failed to save reflection",
        variant: "destructive",
      });
    }
  };
  
  // 🗑️ DEAD CODE: This counts speech errors but the count isn't displayed - could be simplified to just show/hide the error message
  // Removed speechErrorCount - no longer penalizing natural speech pauses
  const [speechRecognitionError, setSpeechRecognitionError] = useState<string | null>(null);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  // Removed MAX_SPEECH_ERRORS - no longer penalizing natural speech pauses
  // 🗑️ DEAD CODE: These voice selection variables are set but never used for actual voice selection - can be removed
  const [selectedElevenLabsVoice, setSelectedElevenLabsVoice] = useState<string>(DEFAULT_VALUES.ELEVENLABS_VOICE_ID);
  const [elevenLabsVoices, setElevenLabsVoices] = useState<{id: string, name: string}[]>([]);
  const [selectedGoogleLang, setSelectedGoogleLang] = useState<string>("en-US");
  const [selectedGoogleGender, setSelectedGoogleGender] = useState<string>("FEMALE");
  const [selectedHumeVoice, setSelectedHumeVoice] = useState<string>("ITO");
  
  // Use settings hook
  const { globalSettings, globalSettingsLoading, globalSettingsError, handleGlobalSettingsChange, setGlobalSettings } = useSettings();
  const { serviceStatus, setServiceStatus } = useServiceStatus();
  // UI state management - reverted from useUIState hook for better debugging
  const [activeTab, setActiveTab] = useState("record");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState("");
  const [progress, setProgress] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [breathingPhase, setBreathingPhase] = useState<"inhale" | "exhale">("inhale");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [showLiveTranscript, setShowLiveTranscript] = useState(true);
  const [microphoneError, setMicrophoneError] = useState<string | null>(null);
  const [isRequestingMic, setIsRequestingMic] = useState(false);
  const [isCloningVoice, setIsCloningVoice] = useState(false);
  const [hasRequestedVoiceClone, setHasRequestedVoiceClone] = useState(false);
  const [voiceCloneError, setVoiceCloneError] = useState<string | null>(null);
  
  // Voice clone state management
  const [userVoiceCloneId, setUserVoiceCloneId] = useState<string | null>(null);
  const [hasVoiceClone, setHasVoiceClone] = useState(false);

  // Helper function to calculate exact word counts



  // Settings loading is now handled by useSettings hook

  // Update actualTTSService when globalSettings changes
  useEffect(() => {
    if (globalSettings?.tts_service) {
      setActualTTSService(globalSettings.tts_service);
    }
  }, [globalSettings?.tts_service]);

  useEffect(() => {
    // Assign or retrieve a unique anonymous user ID for this browser/device.
    // This ID is stored in localStorage and used to associate reflections with the user in Supabase.
    let id = localStorage.getItem('em-user-id');
    if (!id) {
      id = uuidv4();
      localStorage.setItem('em-user-id', id);
    }
    setUserId(id);
  }, []);

  // Load voice clone state from localStorage
  useEffect(() => {
    if (userId) {
      const storedVoiceId = localStorage.getItem(`${DEFAULT_VALUES.USER_VOICE_CLONE_PREFIX}${userId}`);
      console.log('Loading voice clone state:', { userId, storedVoiceId, isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) });
      if (storedVoiceId) {
        setUserVoiceCloneId(storedVoiceId);
        setHasVoiceClone(true);
        console.log('Voice clone loaded from localStorage:', storedVoiceId);
      }
    }
  }, [userId]);


  // Removed old settings saving - now using global settings only

  // Simplified permission check - just set to false initially
  // User will request permission when they try to record
  useEffect(() => {
    console.log("App initialized - microphone permission will be requested when needed");
  }, [])

  // Fetch reflections when userId changes
  useEffect(() => {
    if (userId) {
      console.log("Initial fetch of reflections for user:", userId);
      fetchReflections(userId).then(setSessions);
    }
  }, [userId]);

  // Check if user is admin (for development/testing)
  useEffect(() => {
    // Check if the user is an admin by comparing the URL or sessionStorage secret to the public admin secret.
    // This is only for development/testing and does not provide real security.
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search)
      const adminSecret = urlParams.get("admin")
      const storedAdminSecret = sessionStorage.getItem(DEFAULT_VALUES.ADMIN_SECRET_KEY)
      if (adminSecret === process.env.NEXT_PUBLIC_ADMIN_SECRET || storedAdminSecret === process.env.NEXT_PUBLIC_ADMIN_SECRET) {
        setIsAdmin(true)
        sessionStorage.setItem(DEFAULT_VALUES.ADMIN_SECRET_KEY, adminSecret || storedAdminSecret || "")
      }
    }
  }, [])



  // ONLY timer we need - the red bubble counter
  useEffect(() => {
    if (isRecording) {
      const interval = setInterval(() => {
        currentRecordingTimeRef.current += 1
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [isRecording])

  // Breathing animation
  useEffect(() => {
    if (isRecording) {
      breathingTimerRef.current = setInterval(() => {
        setBreathingPhase((prev) => (prev === "inhale" ? "exhale" : "inhale"))
      }, UI_CONSTANTS.BREATHING_CYCLE_MS)
    } else {
      if (breathingTimerRef.current) {
        clearInterval(breathingTimerRef.current)
      }
      setBreathingPhase("inhale")
    }

    return () => {
      if (breathingTimerRef.current) {
        clearInterval(breathingTimerRef.current)
      }
    }
  }, [isRecording])

  // Prevent tab switching during recording or processing
  const canSwitchTab = !isRecording && !isProcessing && !isSpeaking


  const checkMicrophonePermission = async () => {
    try {
      console.log("Querying microphone permission...");
      
      // Check if permissions API is supported
      if (!navigator.permissions || !navigator.permissions.query) {
        console.log("Permissions API not supported, trying direct microphone access...");
        await initializeMicrophone();
        return;
      }
      
      const result = await navigator.permissions.query({ name: "microphone" as PermissionName })
      console.log("Permission result:", result.state);
      if (result.state === "granted") {
        console.log("Permission granted, initializing microphone...");
        await initializeMicrophone()
      } else {
        console.log("Permission not granted, setting hasPermission to false");
        setHasPermission(false)
      }
    } catch (error) {
      console.error("Error querying microphone permission:", error);
      // If permissions API fails, try direct microphone access
      console.log("Falling back to direct microphone access...");
      try {
        await initializeMicrophone();
      } catch (micError) {
        console.error("Direct microphone access also failed:", micError);
        setHasPermission(false);
      }
    }
  }

  const initializeMicrophone = async () => {
    console.log("Initializing microphone...");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.log("MediaDevices not supported");
      setMicrophoneError("Microphone access is not supported on this device or browser. Please use the latest version of Safari or Chrome on iOS/Android, or try on desktop.");
      setHasPermission(false);
      return;
    }
    try {
      console.log("Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: AUDIO_CONSTANTS.SAMPLE_RATE,
        },
      })
      console.log("Microphone access granted, setting up audio context...");
      streamRef.current = stream
      setHasPermission(true)

      audioContextRef.current = new AudioContext()
      analyserRef.current = audioContextRef.current.createAnalyser()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)
      console.log("Microphone initialization complete");
    } catch (error) {
      console.error("Microphone access denied:", error)
      setHasPermission(false)
    }
  }

  const requestMicrophoneAccess = () => {
    console.log('requestMicrophoneAccess called, current hasPermission:', hasPermission);
    setIsRequestingMic(true);
    setMicrophoneError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicrophoneError("Microphone access is not supported on this device or browser. Please use the latest version of Safari or Chrome on iOS/Android, or try on desktop.");
      setIsRequestingMic(false);
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream: MediaStream) => {
        console.log('Microphone access granted, setting up stream');
        streamRef.current = stream;
        setHasPermission(true);
        setIsRequestingMic(false);
        // You can now proceed to initialize the rest of your audio logic
        initializeMicrophoneAfterPermission(stream);
      })
      .catch((err) => {
        console.error('Microphone access denied:', err);
        setMicrophoneError("Microphone access denied or unavailable. Please check your browser settings and try again.");
        setIsRequestingMic(false);
      });
  };

  // Separate function for post-permission logic
  const initializeMicrophoneAfterPermission = (stream: MediaStream) => {
    // ...rest of your microphone initialization logic that does not require user gesture...
  };



  const startRecording = () => {
    if (!streamRef.current || isSpeaking) return

    if (!globalSettings) {
      toast({
        title: "Settings not loaded",
        description: "Please wait for settings to load before recording.",
        variant: "destructive",
      });
      return
    }

    // Note: Removed explicit permission checks to avoid browser compatibility issues
    // The existing hasPermission state and audio-capture error handling are sufficient

    // Don't delete voice clone when starting new recording - let it persist across sessions
    // Voice clone will only be deleted when user explicitly starts a new session or when handleVoiceClone is called
    
    // Don't reset voice clone request flag - let it persist across sessions
    // Voice clone will only be deleted when user explicitly clicks "Delete Clone"

    if (speechSynthesis.speaking) {
      speechSynthesis.cancel()
      setIsSpeaking(false)
    }

    // Reset recording time for new session
    currentRecordingTimeRef.current = 0
    audioChunksRef.current = []
    console.log("Starting MediaRecorder with stream:", streamRef.current)
    console.log("Stream tracks:", streamRef.current.getTracks())
    console.log("Audio tracks:", streamRef.current.getAudioTracks())
    
    let mimeType: string = AUDIO_CONSTANTS.MIME_TYPE_FALLBACK;
    if (typeof MediaRecorder !== 'undefined') {
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        // Try Safari-compatible fallback
        mimeType = '';
        console.warn('audio/webm not supported, falling back to default mimeType');
      } else {
        console.log('Using fallback MIME type:', mimeType);
      }
    }
    console.log('Creating MediaRecorder with mimeType:', mimeType, 'on mobile:', /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    try {
      const recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder
    mediaRecorderRef.current.ondataavailable = (event) => {
      console.log("MediaRecorder ondataavailable:", event.data.size, "bytes")
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data)
        console.log("Added audio chunk, total chunks:", audioChunksRef.current.length)
      } else {
        console.warn("Received empty audio chunk")
      }
    }

    mediaRecorderRef.current.onstop = processAudio
    try {
      mediaRecorderRef.current.start()
      console.log("MediaRecorder started successfully")
      setIsRecording(true)
      isRecordingRef.current = true
      // Reset speech recognition error when starting a new recording
      setSpeechRecognitionError(null)
      playChime("start")
    } catch (err) {
      console.error("Failed to start MediaRecorder:", err)
      setIsRecording(false)
      isRecordingRef.current = false
      toast({
        title: "Could not start recording",
        description: "Please check your microphone permissions, ensure no other app is using the mic, and try again.",
        variant: "destructive",
      });
    }

    // When you start a new recording, reset the ref:
    fullRecognitionTranscriptRef.current = "";

    startSpeechRecognition()
    } catch (err) {
      console.error("Failed to create MediaRecorder:", err)
      setIsRecording(false)
      isRecordingRef.current = false
      toast({
        title: "Could not start recording",
        description: "Failed to create MediaRecorder. Please check your browser and microphone permissions.",
        variant: "destructive",
      });
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecordingRef.current) {
      try {
        mediaRecorderRef.current.stop()
      } catch (error) {
        console.log("Error stopping MediaRecorder:", error)
      }

      setIsRecording(false)
      setIsProcessing(true) // Set processing state immediately to prevent UI flash
      isRecordingRef.current = false
      playChime("stop")

      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
          recognitionRef.current = null
        } catch (error) {
          console.log("Error stopping speech recognition:", error)
        }
      }
    }
    setLiveTranscript("");
  }

  const startSpeechRecognition = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      setSpeechRecognitionError("Speech recognition is not supported in this browser.");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    recognitionRef.current = new SpeechRecognition()

    recognitionRef.current.continuous = true
    recognitionRef.current.interimResults = true
    recognitionRef.current.lang = "en-US"
    ;(window as any).lastRecognitionTranscript = ""

    recognitionRef.current.onresult = (event: any) => {
      setSpeechRecognitionError(null);
      if (!isRecordingRef.current) return;

      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          fullRecognitionTranscriptRef.current += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }

      // For live display
      if (showLiveTranscript) {
        setLiveTranscript(fullRecognitionTranscriptRef.current + interimTranscript);
      }

      // Update lastRecognitionTranscript for fallback
      (window as any).lastRecognitionTranscript = fullRecognitionTranscriptRef.current + interimTranscript;

      const allTranscript = (fullRecognitionTranscriptRef.current + interimTranscript).toLowerCase().trim();
      // List of trigger phrases
      const triggers = SPEECH_TRIGGERS;
      // If any trigger phrase is present, stop recording
      if (triggers.some(trigger => allTranscript.endsWith(trigger))) {
        stopRecording();
      }
    }

    recognitionRef.current.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error, event);
      
      if (event.error === "audio-capture") {
        // Audio capture error - microphone access issue
        setSpeechRecognitionError("Microphone access denied. Please check your browser permissions and try again.");
            toast({
          title: "Microphone Access Denied",
          description: "Please allow microphone access in your browser and refresh the page.",
              variant: "destructive",
            });
            stopRecording();
      } else if (event.error === "no-speech") {
        // Ignore no-speech errors completely - silence is natural in speech
        // Users pause to think, breathe, or structure thoughts
        // Vocal characteristics (pace, volume) already capture speech patterns
        console.log("No-speech event (ignored):", event);
        // Do nothing - let users speak naturally without interruption
      } else {
        // Other speech recognition errors
        setSpeechRecognitionError(`Speech recognition error: ${event.error}`);
        toast({
          title: "Speech recognition error",
          description: event.error,
          variant: "destructive",
        });
        stopRecording();
      }
    };

    recognitionRef.current.onend = () => {
      console.warn("Speech recognition ended");
      if (isRecordingRef.current && recognitionRef.current) {
        setTimeout(() => {
          try {
            if (isRecordingRef.current && recognitionRef.current) {
              recognitionRef.current.start()
            }
          } catch (error) {
            console.log("Could not restart speech recognition:", error)
          }
        }, 100)
      }
    }

    try {
      recognitionRef.current.start()
    } catch (error) {
      setSpeechRecognitionError("Could not start speech recognition. Please check your browser and microphone.");
      console.log("Could not start speech recognition:", error)
    }
  }

  const checkApiCredits = async (service: string, apiKey: string) => {
    if (!apiKey) return null

    setIsCheckingCredits(true)
    try {
      const response = await fetch(`/api/credits/${service}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Response is not JSON")
      }

      const data = await response.json()
      setApiCredits((prev) => ({ ...prev, [service]: data.credits }))
      return data.credits
    } catch (error) {
      console.error(`Error checking ${service} credits:`, error)
      setApiCredits((prev) => ({ ...prev, [service]: "Error" }))
      return null
    } finally {
      setIsCheckingCredits(false)
    }
  }

  const analyzeVocalCharacteristics = async (audioBlob: Blob): Promise<VocalCharacteristics | null> => {
    try {
      const audioBuffer = await audioBlob.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const decodedAudio = await audioContext.decodeAudioData(audioBuffer);
      const channelData = decodedAudio.getChannelData(0);
      // DSP calculations
      let rms = 0;
      let zeroCrossings = 0;
      for (let i = 0; i < channelData.length; i++) {
        rms += channelData[i] * channelData[i];
      }
      rms = Math.sqrt(rms / channelData.length);
      for (let i = 1; i < channelData.length; i++) {
        if ((channelData[i] >= 0) !== (channelData[i - 1] >= 0)) {
          zeroCrossings++;
        }
      }
      const zcr = zeroCrossings / channelData.length;
      const silenceThreshold = 0.01;
      let speechSegments = 0;
      let totalSpeechTime = 0;
      let inSpeech = false;
      let currentSegmentLength = 0;
      for (let i = 0; i < channelData.length; i += 1000) {
        const segment = Math.abs(channelData[i]);
        if (segment > silenceThreshold) {
          if (!inSpeech) {
            speechSegments++;
            inSpeech = true;
            currentSegmentLength = 0;
          }
          currentSegmentLength++;
          totalSpeechTime++;
        } else {
          inSpeech = false;
        }
      }
      const duration = decodedAudio.duration;
      const speechRatio = totalSpeechTime / (channelData.length / 1000);
      const avgSegmentLength = speechSegments > 0 ? totalSpeechTime / speechSegments : 0;
      await audioContext.close();
      return {
        tone: zcr > 0.1 ? "Bright" : zcr > 0.05 ? "Balanced" : "Warm",
        pace: avgSegmentLength > 50 ? "Deliberate" : avgSegmentLength > 25 ? "Moderate" : "Quick",
        pitch: "Balanced", // Not directly measured, can be improved
        volume: rms > 0.1 ? "Strong" : rms > 0.05 ? "Moderate" : "Gentle",
        confidence: Math.min(0.95, 0.6 + rms * 2 + speechRatio * 0.3),
      };
    } catch (error) {
      console.error("Frontend DSP analysis failed:", error);
      // Return null to indicate analysis failed - no fake data
      return null;
    }
  };

  const processAudio = async () => {
    // setIsProcessing(true) is now set in stopRecording to prevent UI flash
    setProgress(0)

    try {
      setProcessingStage("Transcribing your audio...")
      setProgress(25)

      console.log("Processing audio chunks:", audioChunksRef.current.length)
      console.log("Audio chunks sizes:", audioChunksRef.current.map(chunk => chunk.size))
      const totalSize = audioChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0)
      console.log("Total audio size:", totalSize, "bytes")

      const audioBlob = new Blob(audioChunksRef.current, { type: AUDIO_CONSTANTS.MIME_TYPE })
      console.log("Created audio blob:", {
        size: audioBlob.size,
        type: audioBlob.type,
        expectedType: AUDIO_CONSTANTS.MIME_TYPE,
        isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      })
      
      if (!audioBlob || audioBlob.size === 0) {
        console.error("Audio blob is empty!")
        toast({
          title: "No audio detected",
          description: "No audio was recorded. Please check your microphone and try again.",
          variant: "destructive",
        });
        setIsProcessing(false);
        setProcessingStage("");
        setProgress(0);
        return;
      }

      let transcript = (await transcribeAudio(audioBlob)).trim();
      
      // Remove trigger phrase from the end of the transcript
      const triggers = SPEECH_TRIGGERS;
      for (const trigger of triggers) {
        if (transcript.toLowerCase().endsWith(trigger)) {
          transcript = transcript.slice(0, transcript.toLowerCase().lastIndexOf(trigger)).trim();
          break;
        }
      }
      console.log("Transcript (trigger removed):", transcript);
      if (!transcript || transcript.trim() === "") {
        setIsProcessing(false);
        setProcessingStage("");
        setProgress(0);
        return;
      }

      setProcessingStage("Generating your summary...")
      setProgress(50)

      // Process only essential analysis in parallel for immediate user experience
      // Move non-essential analysis (emotions, vocal characteristics) to background
      const startTime = Date.now();
      const [vocalCharacteristics, summary] = await Promise.all([
        analyzeVocalCharacteristics(audioBlob),
        generateSummary(transcript)
      ]);
      const processingTime = Date.now() - startTime;
      console.log(`Essential processing completed in ${processingTime}ms`);

      // Start emotion analysis in background - not needed for immediate user experience
      const emotionPromise = analyzeEmotions(transcript, audioBlob).catch(console.error);

      console.log("Vocal characteristics:", vocalCharacteristics);

      const trimmedSummary = summary.trim();
      
      // Start TTS generation in parallel while we process the results
      // This reduces perceived wait time by starting audio generation early
      let ttsPromise: Promise<void> | null = null;
      if (globalSettings?.tts_service === 'elevenlabs' && globalSettings?.elevenlabs_voice_id) {
        // Start TTS generation immediately after we have the summary
        ttsPromise = speakSummary(trimmedSummary);
      }
      const lowerSummary = trimmedSummary.toLowerCase();
      if (
        !trimmedSummary ||
        lowerSummary.includes("please provide the personal share you would like me to summarize") ||
        lowerSummary.includes("provide a personal share") ||
        lowerSummary.includes("please share") ||
        lowerSummary.includes("i need the text of the share")
      ) {
        setIsProcessing(false);
        setProcessingStage("");
        setProgress(0);
        return;
      }

      setProcessingStage("Ready!")
      setProgress(100)

      // Use ONLY the red bubble timer - store the duration directly
      const recordingDuration = currentRecordingTimeRef.current;
      
      console.log("Red bubble timer shows:", recordingDuration, "seconds");
      
      const newSession: SessionData = {
        id: Date.now().toString(),
        timestamp: new Date(), // Just use current time
        transcript,
        summary,
        emotions: [], // Will be populated when background analysis completes
        vocalCharacteristics: vocalCharacteristics || {
          tone: "Unknown",
          pace: "Unknown", 
          pitch: "Unknown",
          volume: "Unknown",
          confidence: 0
        },
        audioBlob,
        // Store the actual duration from the red bubble timer
        recordingDuration: recordingDuration,
      }

      setSessions((prev) => [newSession, ...prev])
      setCurrentSession(newSession)
      
      // Switch to summary tab after a brief delay to ensure UI is ready
      setTimeout(() => {
      setActiveTab("summary")
      }, 100)

      // Auto-play the summary immediately for fast user experience
      // If TTS is already generating, it will play when ready
      // Otherwise, start it with a small delay
      if (ttsPromise) {
        // TTS is already generating, it will play when ready
        console.log("TTS already generating, will play when ready");
      } else {
        // Start TTS with a small delay for immediate user feedback
        setTimeout(() => speakSummary(trimmedSummary), 1000);
      }


      // Complete background emotion analysis and save to Supabase
      if (userId) {
        // Run emotion analysis and Supabase save in background without blocking the UI
        (async () => {
          try {
            // Wait for emotion analysis to complete
            const emotions = await emotionPromise;
            console.log("Background emotion analysis completed:", emotions);
            
            // Update the current session with emotions
            if (emotions) {
              console.log("Updating UI with emotions:", emotions);
              setCurrentSession(prev => prev ? { ...prev, emotions } : null);
              setSessions(prev => prev.map(session => 
                session.id === newSession.id ? { ...session, emotions } : session
              ));
              
              // Force a re-render to ensure the analysis tab shows the emotions
              console.log("Emotions updated in UI, analysis tab should now show data");
            }
            
          const reflectionData = {
            userId,
            transcript,
            summary,
            emotions,
            vocal: vocalCharacteristics,
            device_info: getDeviceInfo(),
            browser_info: getBrowserInfo(),
            location_info: null, // Could add geolocation if needed
            tts_service_used: actualTTSService,
            summary_service_used: globalSettings?.summary_service || 'unknown',
            recording_duration: recordingDuration, // Store the actual duration from red bubble timer
          };
            console.log("Sending reflection data to Supabase (background):", reflectionData);
          console.log("Recording duration from red bubble:", recordingDuration, "seconds");
          await saveReflectionToSupabase(reflectionData);
            console.log("Reflection saved to Supabase successfully");
        } catch (err) {
            console.error("Failed to complete background processing:", err);
        }
        })();
      }
    } catch (error) {
      console.error("Processing error:", error)
    } finally {
      setIsProcessing(false)
      setProcessingStage("")
      setProgress(0)
    }
  }

  const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
    try {
      // Always try Google Speech-to-Text API (if configured on backend)
      console.log("Using Google Speech-to-Text API for transcription...")
      const formData = new FormData()
      formData.append("audio", audioBlob, "recording.webm")
      formData.append("service", "google")

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), UI_CONSTANTS.API_TIMEOUT_MS)

        const response = await fetch(API_ENDPOINTS.TRANSCRIBE, {
          method: "POST",
          body: formData,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        console.log("Google API response status:", response.status)

        if (response.ok) {
          const data = await response.json()
          console.log("Google transcription result:", data)
          console.log("Google STT raw response:", data)

          if (
            data.transcript &&
            data.transcript.trim() !== "" &&
            data.transcript !== "I shared my thoughts and reflections in this session."
          ) {
            setTranscriptionError(null);
            return data.transcript;
          } else {
            // Fallback to browser transcript if available
            if ((window as any).lastRecognitionTranscript && (window as any).lastRecognitionTranscript.trim() !== "") {
              console.warn("Google transcript empty, using browser transcript:", (window as any).lastRecognitionTranscript);
              // Suppress warning if browser transcript is present
              setTranscriptionError(null);
              return (window as any).lastRecognitionTranscript.trim();
            } else {
              console.warn("Both Google and browser transcripts are empty.");
              setTranscriptionError("Both Google and browser transcripts are empty. Please try again.");
              return "";
            }
          }
        } else {
          const errorText = await response.text()
          console.error("Google transcription failed:", errorText)
          // Only show warning if browser transcript is also empty
          if ((window as any).lastRecognitionTranscript && (window as any).lastRecognitionTranscript.trim() !== "") {
            console.warn("Google STT failed, using browser transcript:", (window as any).lastRecognitionTranscript);
            setTranscriptionError(null);
            return (window as any).lastRecognitionTranscript.trim();
          } else {
            setTranscriptionError(`Google transcription failed: ${errorText}`);
            console.warn("Google STT failed and browser transcript is empty.");
            return "";
          }
        }
      } catch (fetchError) {
        console.log("Google transcription request failed:", fetchError)
        // Only show warning if browser transcript is also empty
        if ((window as any).lastRecognitionTranscript && (window as any).lastRecognitionTranscript.trim() !== "") {
          console.warn("Google STT request failed, using browser transcript:", (window as any).lastRecognitionTranscript);
          setTranscriptionError(null);
          return (window as any).lastRecognitionTranscript.trim();
        } else {
          setTranscriptionError("Google transcription request failed and browser transcript is empty. Please try again.");
          console.warn("Google STT request failed and browser transcript is empty.");
          return "";
        }
      }

      if ((window as any).lastRecognitionTranscript && (window as any).lastRecognitionTranscript.trim() !== "") {
        console.log("Using captured live transcript:", (window as any).lastRecognitionTranscript)
        setTranscriptionError(null);
        return (window as any).lastRecognitionTranscript.trim()
      }

      console.warn("No transcript available, returning fallback.")
      setTranscriptionError("No transcript available. Please try again.");
      return "" // No transcript
    } catch (error) {
      console.error("Transcription error:", error)
      // Only show warning if browser transcript is also empty
      if ((window as any).lastRecognitionTranscript && (window as any).lastRecognitionTranscript.trim() !== "") {
        console.warn("Transcription error, using browser transcript:", (window as any).lastRecognitionTranscript);
        setTranscriptionError(null);
        return (window as any).lastRecognitionTranscript.trim();
      } else {
        setTranscriptionError("Transcription error and browser transcript is empty. Please try again.");
        console.warn("Transcription error and browser transcript is empty.");
        return "";
      }
    }
  }

  const generateSummary = async (transcript: string): Promise<string> => {
    try {
      console.log("Generating summary for transcript:", transcript)
      // Use API (keys are configured on backend)
      console.log('Generating summary with service:', globalSettings?.summary_service);
      const response = await fetch(API_ENDPOINTS.SUMMARIZE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          service: globalSettings?.summary_service, // <--- use this!
        }),
      })
      console.log('Summary API response status:', response.status);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // Don't show invasive error - just log and fallback gracefully
        console.warn('Summary API failed, using transcript as fallback');
        const fallbackSummary = transcript ? `I said: "${transcript}"` : "";
        console.log('Fallback summary generated:', fallbackSummary);
        return fallbackSummary;
      }

      const data = await response.json()
      const summary = data.summary?.trim() || "";

      // If the summary is empty or looks like a stub, return a better fallback
      if (
        !summary ||
        summary.toLowerCase().startsWith("the themes of") ||
        summary.toLowerCase().includes("please provide") ||
        summary.toLowerCase().includes("i need the") ||
        summary.toLowerCase().includes("original text") ||
        summary.length < 10 // Too short to be meaningful
      ) {
        console.warn('Summary appears to be a stub, using transcript as fallback');
        const fallbackSummary = transcript ? `I said: "${transcript}"` : "";
        console.log('Fallback summary generated:', fallbackSummary);
        return fallbackSummary;
      }

      return summary;
    } catch (error) {
      // On error, fallback to transcript or nothing
      console.warn('Summary generation error, using transcript as fallback');
      const fallbackSummary = transcript ? `I said: "${transcript}"` : "";
      console.log('Fallback summary generated:', fallbackSummary);
      return fallbackSummary;
    }
  }

  const analyzeEmotions = async (text: string, audioBlob?: Blob): Promise<EmotionAnalysis[]> => {
    try {
      // Convert audio blob to base64 for the API
      let audioBase64 = null;
      if (audioBlob) {
        audioBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(audioBlob);
        });
      }

      const response = await fetch(API_ENDPOINTS.EMOTIONS_HYBRID, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          audioBlob: audioBase64,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        console.log("Hybrid emotion analysis result:", data);
        return data.emotions
      }
    } catch (error) {
      console.error("Hybrid emotion analysis error:", error)
    }

    // No fallback emotions - return empty array when analysis fails
    console.warn("Emotion analysis failed, returning empty emotions array");
    return []
  }

  // console.log("TTS service selected:", settings.voiceService);
  // Fetch ElevenLabs voices (API key is configured on backend)
  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const res = await fetch(API_ENDPOINTS.VOICE_ELEVENLABS_VOICES);
        if (res.ok) {
          const data = await res.json();
          setElevenLabsVoices(data.voices.map((v: any) => ({ id: v.voice_id, name: v.name })));
          if (data.voices.length > 0) setSelectedElevenLabsVoice(data.voices[0].voice_id);
        }
      } catch (e) {
        console.warn("Failed to fetch ElevenLabs voices", e);
      }
    };
    fetchVoices();
  }, []);



  const handleDeleteVoiceClone = async () => {
    try {
      if (userVoiceCloneId) {
        // Delete voice clone from ElevenLabs
        await fetch(API_ENDPOINTS.VOICE_CLONE_DELETE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voiceId: userVoiceCloneId, userId }),
        });
        
        // Clear local state
        setUserVoiceCloneId(null);
        setHasVoiceClone(false);
        setHasRequestedVoiceClone(false);
        localStorage.removeItem(`${DEFAULT_VALUES.USER_VOICE_CLONE_PREFIX}${userId}`);
        
        toast({
          title: "Voice clone deleted",
          description: "You're now using the default voice for TTS.",
        });
      }
    } catch (error) {
      console.error('Failed to delete voice clone:', error);
      toast({
        title: "Failed to delete voice clone",
        description: "Please try again or contact support.",
        variant: "destructive",
      });
    }
  };

  /**
   * Handles voice cloning functionality using ElevenLabs API
   * 
   * This function manages both creating new voice clones and improving existing ones.
   * When a user already has a voice clone, it will replace it with an improved version
   * using the current audio recording. This ensures only one voice clone per user.
   * 
   * Flow:
   * 1. Check if audio is available from current session
   * 2. If user has existing voice clone → improve/replace it
   * 3. If no existing clone → create new one
   * 4. Update local state and localStorage
   * 5. Show appropriate success/error messages
   * 
   * Note: The "improve" functionality actually deletes the old clone and creates
   * a new one with the latest audio, rather than truly combining audio samples.
   */
  const handleVoiceClone = async () => {
      // Validate that we have audio to work with
      if (!currentSession?.audioBlob) {
        toast({
          title: "No audio available",
          description: "Please record a reflection first to clone your voice.",
          variant: "destructive",
        });
        return;
      }
      
      setIsCloningVoice(true);
      setHasRequestedVoiceClone(true); // Mark that user wants voice clone
      setVoiceCloneError(null); // Clear any previous errors
      
      // Show immediate feedback to user
      toast({
        title: "Starting voice clone...",
        description: "Creating your personalized voice clone. This may take a few seconds.",
      });
      
      try {
        // Create a new blob to ensure it's fresh
        const audioBlob = new Blob([currentSession.audioBlob], { type: currentSession.audioBlob.type });
        console.log('Fresh audio blob for FormData:', {
          size: audioBlob.size,
          type: audioBlob.type,
          originalSize: currentSession.audioBlob.size,
          originalType: currentSession.audioBlob.type
        });
        
        if (audioBlob.size === 0) {
          setVoiceCloneError('No audio data available. Please try recording again.');
          return;
        }
        
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('userId', userId);
        
        // If we already have a voice clone, improve it instead of creating a new one
        // This ensures we maintain only one voice clone per user
        if (hasVoiceClone && userVoiceCloneId) {
          formData.append('voiceId', userVoiceCloneId);
          console.log('Replacing existing voice clone:', userVoiceCloneId);
          
          const response = await fetch(API_ENDPOINTS.VOICE_CLONE_IMPROVE, {
            method: 'POST',
            body: formData,
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('Voice clone improved successfully:', data);
            
            // Update the voice clone ID (ElevenLabs returns a new ID for improved clones)
            setUserVoiceCloneId(data.voiceId);
            setHasVoiceClone(true);
            localStorage.setItem(`${DEFAULT_VALUES.USER_VOICE_CLONE_PREFIX}${userId}`, data.voiceId);
            
            toast({
              title: "Voice clone replaced! 🎉",
              description: "Your voice clone has been replaced with a new version using the latest audio. Click 'Listen' to hear the updated voice.",
            });
          } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to improve voice clone');
          }
        } else {
          // Create a new voice clone
        console.log('Creating voice clone for audio:', { size: audioBlob.size, type: audioBlob.type });
          
          const response = await fetch(API_ENDPOINTS.VOICE_CLONE, {
            method: 'POST',
            body: formData,
          });
          
          console.log('Voice clone creation response:', response.status);
          
          
          if (response.ok) {
            const data = await response.json();
            console.log('Voice clone created successfully:', data);
            
            setUserVoiceCloneId(data.voiceId);
            setHasVoiceClone(true);
            localStorage.setItem(`${DEFAULT_VALUES.USER_VOICE_CLONE_PREFIX}${userId}`, data.voiceId);
            
            toast({
              title: "Voice clone created! 🎉",
              description: "Your voice clone is ready! Click 'Listen' to hear your reflection in your own voice.",
            });
          } else {
            const errorData = await response.json().catch(() => ({}));
            
            // Check if it's an API limit error
            if (response.status === 403 && errorData.detail && errorData.detail.status === 'voice_add_edit_limit_reached') {
              throw new Error('API_LIMIT_REACHED');
            }
            
            throw new Error(errorData.detail?.message || errorData.error || 'Failed to create voice clone');
          }
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Please try again or use the default voice.";
        
        // Set error state for UI display instead of invasive toast
        if (errorMessage === 'API_LIMIT_REACHED') {
          setVoiceCloneError('Voice clone limit reached. Try again next month or use the default voice.');
        } else {
          setVoiceCloneError('Unable to create voice clone. You can still use the default voice.');
        }
      } finally {
        setIsCloningVoice(false);
      }
    };

  /**
   * Converts summary text to speech using the appropriate TTS service
   * 
   * Priority order:
   * 1. User's voice clone (if available and working)
   * 2. Default ElevenLabs voice (if configured)
   * 3. Browser's built-in speech synthesis (fallback)
   * 
   * @param summary - The text content to convert to speech
   */
  const speakSummary = async (summary: string) => {
    if (!globalSettings) return; // Wait for settings to load

    // Set speaking state immediately
    setIsSpeaking(true);

    const ttsService = globalSettings.tts_service;
    // Add any additional settings (voice, lang, etc.) as needed

    const playAudioBlob = async (blob: Blob) => {
      // Stop any existing audio first
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.remove();
        currentAudioRef.current = null;
      }
      
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      
      // Store reference to current audio
      currentAudioRef.current = audio;
      
      audio.onended = () => {
        URL.revokeObjectURL(url);
        // Don't clear currentAudioRef - keep it for replay
        setIsSpeaking(false);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        currentAudioRef.current = null;
        setIsSpeaking(false);
      };
      
      // Auto-play on desktop, manual play on mobile
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (isMobile) {
        // Mobile: wait for user interaction
        console.log('Audio ready for playback - waiting for user interaction');
        setIsAudioReady(true);
        setIsSpeaking(false);
      } else {
        // Desktop: auto-play
        console.log('Audio ready for playback - auto-playing on desktop');
        setIsSpeaking(true);
        audio.play().catch(err => {
          console.warn('Auto-play failed, falling back to manual play:', err);
          setIsAudioReady(true);
          setIsSpeaking(false);
        });
      }
    };

    console.log('TTS service selected:', globalSettings?.tts_service);
    console.log('Global settings for TTS:', {
      tts_service: globalSettings?.tts_service,
      elevenlabs_voice_id: globalSettings?.elevenlabs_voice_id
    });

    // Check if user has a voice clone and use it (this should work on both mobile and desktop)
    console.log('Voice clone check:', { userVoiceCloneId, hasVoiceClone, isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) });
    if (userVoiceCloneId && hasVoiceClone) {
      try {
        const payload = { text: summary, voiceId: userVoiceCloneId };
        console.log('Using voice clone for TTS:', payload);
        const response = await fetch(API_ENDPOINTS.VOICE_ELEVENLABS, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        
        console.log('Voice clone TTS response:', response.status);
        
        
        if (response.ok) {
          const audioBlob = await response.blob();
          console.log('Voice clone TTS response:', {
            size: audioBlob.size,
            type: audioBlob.type,
            status: response.status
          });
          
          if (audioBlob.size === 0) {
            console.error('Voice clone TTS returned empty audio blob');
            toast({
              title: "Voice clone error",
              description: "The voice clone was created but has no audio data. Please try creating a new voice clone.",
              variant: "destructive",
            });
            return;
          }
          
          setActualTTSService("elevenlabs");
          console.log('Voice clone TTS successful, playing audio - actualTTSService set to elevenlabs');
          await playAudioBlob(audioBlob);
          return;
        } else {
          const errorText = await response.text().catch(() => 'Unknown error');
          setVoiceCloneError(`Voice clone TTS failed. Using default voice instead.`);
          return;
        }
      } catch (err) {
        setVoiceCloneError(`Voice clone TTS error. Using default voice instead.`);
        return;
      }
    }

    // Fallback to default ElevenLabs voice if configured
    if (globalSettings?.tts_service === 'elevenlabs') {
      try {
        const payload = { text: summary, voiceId: globalSettings.elevenlabs_voice_id || DEFAULT_VALUES.ELEVENLABS_VOICE_ID };
        console.log('Sending ElevenLabs TTS payload:', payload);
        const response = await fetch(API_ENDPOINTS.VOICE_ELEVENLABS, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        console.log('ElevenLabs API response status:', response.status);
        if (!response.ok) throw new Error("Failed to fetch ElevenLabs audio");
        const audioBlob = await response.blob();
        setActualTTSService("elevenlabs");
        await playAudioBlob(audioBlob);
        return;
      } catch (err) {
        console.warn('Falling back to browser TTS: ElevenLabs TTS error:', err);
      }
    }
    // ...repeat for other services if needed...

    // Fallback: Browser TTS
    if ("speechSynthesis" in window) {
      setActualTTSService("browser");
      const utterance = new SpeechSynthesisUtterance(summary);
      
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(utterance);
    } else {
      // No TTS available
        setIsSpeaking(false);
    }
  };

  // Removed pauseResumeSpeech - simplified to just stop button

  const playAudio = () => {
    console.log('playAudio called, currentAudioRef:', !!currentAudioRef.current);
    if (currentAudioRef.current) {
      setIsSpeaking(true);
      // Reset audio to beginning for replay
      currentAudioRef.current.currentTime = 0;
      // Don't clear isAudioReady - keep it true so we can replay
      currentAudioRef.current.play().catch(err => {
        console.error('Failed to play audio:', err);
        setIsSpeaking(false);
      });
    } else {
      console.warn('No audio to play - currentAudioRef is null');
    }
  };

  const stopSpeech = () => {
    // Stop browser speech synthesis
    speechSynthesis.cancel()
    
    // Stop current audio element (ElevenLabs TTS)
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      // Don't remove or clear - keep for replay
    }
    
    // Also stop any other audio elements as backup
    const existingAudio = document.querySelector('audio');
    if (existingAudio) {
      existingAudio.pause();
      existingAudio.remove();
    }
    
    // Reset state
    setIsSpeaking(false)
    // Don't reset isAudioReady - keep audio ready for replay
    setUtteranceRef(null)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
          recognitionRef.current = null
        } catch (error) {
          console.log("Cleanup error:", error)
        }
      }
    }
  }, [])


  // Only after all hooks, handle early returns:
  if (hasPermission === null) {
    return <LoadingStates isPreparing={true} isLoadingSettings={false} hasSettingsError={false} globalSettingsError={null} />
  }

  // Show loading state while global settings are loading
  if (globalSettingsLoading) {
    return <LoadingStates isPreparing={false} isLoadingSettings={true} hasSettingsError={false} globalSettingsError={null} />
  }

  // Show error state if global settings failed to load
  if (globalSettingsError && !globalSettings) {
    return <LoadingStates isPreparing={false} isLoadingSettings={false} hasSettingsError={true} globalSettingsError={globalSettingsError} />
  }
  if (hasPermission === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-purple-50 to-indigo-100 flex items-center justify-center p-6">
        <Card className="w-full max-w-2xl shadow-2xl border-0 bg-white/90 backdrop-blur-xl">
          <CardHeader className="text-center pb-8 pt-12">
            <div className="relative mb-8">
              <div className="relative">
                {/* Emotional Mirror Brand SVG Logo */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-12 h-12">
                  <defs>
                    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#8e2de2"/>
                      <stop offset="100%" stopColor="#f2994a"/>
                    </linearGradient>
                  </defs>
                  <rect width="100" height="100" rx="20" fill="url(#grad)"/>
                  <rect y="50" width="100" height="1.5" fill="#fff" opacity="0.2"/>
                  <path d="M30 20 H70 A5 5 0 0 1 75 25 V45 A5 5 0 0 1 70 50 H50 L45 60 V50 H30 A5 5 0 0 1 25 45 V25 A5 5 0 0 1 30 20 Z" fill="#fff"/>
                  <path d="M30 80 H70 A5 5 0 0 0 75 75 V55 A5 5 0 0 0 70 50 H50 L45 40 V50 H30 A5 5 0 0 0 25 55 V75 A5 5 0 0 0 30 80 Z" fill="#fff" opacity="0.3"/>
                </svg>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                  <Sparkles className="w-2 h-2 text-white" />
                </div>
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
            </div>
            <CardTitle className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 bg-clip-text text-transparent mb-4">
              Emotional Mirror
            </CardTitle>
            <CardDescription className="text-xl text-gray-600 max-w-lg mx-auto leading-relaxed">
              A gentle space for self-reflection, where your thoughts are heard with compassion and understanding
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-8 pb-12">
            <div className="space-y-6">
              <p className="text-gray-700 leading-relaxed max-w-md mx-auto">
                To create your personal sanctuary for reflection, we need to listen to your voice with care and respect.
              </p>
              <div className="flex items-center justify-center space-x-3 text-sm text-gray-500 bg-gray-50 rounded-full px-6 py-3 max-w-sm mx-auto">
                <Shield className="w-5 h-5 text-green-500" />
                <span>Your privacy is sacred to us</span>
              </div>
            </div>
            <Button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                requestMicrophoneAccess();
              }}
              type="button"
              size="lg"
              className="bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-600 hover:from-purple-600 hover:via-pink-600 hover:to-indigo-700 text-white font-medium px-12 py-4 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
              disabled={isRequestingMic}
            >
              {isRequestingMic ? "Requesting Microphone..." : "Begin Your Journey"}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Place this BEFORE your return (
  const visibleTabs =
    1 + // record
    (currentSession ? 3 : 0) +
    (sessions.filter(s => s.transcript).length > 0 ? 1 : 0) +
    (isAdmin ? 1 : 0);

  // handleGlobalSettingsChange is now provided by useSettings hook

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-purple-50 to-indigo-100">
        <BackgroundElements />

        <AppHeader 
          isRecording={isRecording}
          isProcessing={isProcessing}
          sessionsCount={sessions.length}
          serviceStatus={serviceStatus}
        />

        {/* Error Warnings */}
        {speechRecognitionError && (
          <div className="max-w-xl mx-auto my-6 p-4 bg-red-100 text-red-800 rounded-xl border border-red-300 text-center text-lg font-semibold shadow">
            {speechRecognitionError}
          </div>
        )}
        {transcriptionError && (
          <div className="max-w-xl mx-auto my-6 p-4 bg-yellow-100 text-yellow-900 rounded-xl border border-yellow-300 text-center text-lg font-semibold shadow">
            {transcriptionError}
          </div>
        )}
        {microphoneError && (
          <div className="max-w-xl mx-auto my-6 p-4 bg-red-100 text-red-800 rounded-xl border border-red-300 text-center text-lg font-semibold shadow">
            {microphoneError}
          </div>
        )}

        <div className="relative max-w-7xl mx-auto px-6 py-12">
          <Tabs value={activeTab} onValueChange={canSwitchTab ? setActiveTab : undefined} className="space-y-8">
            {/* Tab Navigation */}
            <div className="flex justify-center">
              {visibleTabs > 1 && (
                <TabsList className="bg-white/80 backdrop-blur-xl border border-white/30 shadow-xl rounded-2xl p-2">
                  {
                    (
                      1 // Always show "record"
                      + (currentSession ? 3 : 0) // summary, analysis, transcript
                      + (sessions.filter(s => s.transcript).length > 0 ? 1 : 0) // history
                      + (isAdmin ? 1 : 0) // settings
                    ) > 1 && (
                      <>
                        <TabsTrigger
                          value="record"
                          disabled={!canSwitchTab && activeTab !== "record"}
                          className={cn(
                            "flex items-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white rounded-xl px-6 py-3 transition-all duration-300",
                            !canSwitchTab && activeTab !== "record" && "opacity-50 cursor-not-allowed",
                          )}
                        >
                          <Mic className="w-4 h-4" />
                          <span>Listen</span>
                        </TabsTrigger>
                        {currentSession && (
                          <>
                            <TabsTrigger
                              value="summary"
                              disabled={!canSwitchTab && activeTab !== "summary"}
                              className={cn(
                                "flex items-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white rounded-xl px-6 py-3 transition-all duration-300",
                                !canSwitchTab && activeTab !== "summary" && "opacity-50 cursor-not-allowed",
                              )}
                            >
                              <Brain className="w-4 h-4" />
                              <span>Summary</span>
                            </TabsTrigger>
                            <TabsTrigger
                              value="analysis"
                              disabled={!canSwitchTab && activeTab !== "analysis"}
                              className={cn(
                                "flex items-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white rounded-xl px-6 py-3 transition-all duration-300",
                                !canSwitchTab && activeTab !== "analysis" && "opacity-50 cursor-not-allowed",
                              )}
                            >
                              <BarChart3 className="w-4 h-4" />
                              <span>Analysis</span>
                            </TabsTrigger>
                            {/* Transcript Tab - Hidden but functionality preserved */}
                            {/* <TabsTrigger
                              value="transcript"
                              disabled={!canSwitchTab && activeTab !== "transcript"}
                              className={cn(
                                "flex items-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white rounded-xl px-6 py-3 transition-all duration-300",
                                !canSwitchTab && activeTab !== "transcript" && "opacity-50 cursor-not-allowed",
                              )}
                            >
                              <FileText className="w-4 h-4" />
                              <span>Transcript</span>
                            </TabsTrigger> */}
                          </>
                        )}
                        {sessions.length > 0 && (
                          <TabsTrigger
                            value="history"
                            disabled={!canSwitchTab && activeTab !== "history"}
                            className={cn(
                              "flex items-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white rounded-xl px-6 py-3 transition-all duration-300",
                              !canSwitchTab && activeTab !== "history" && "opacity-50 cursor-not-allowed",
                            )}
                          >
                            <History className="w-4 h-4" />
                            <span>Reflections</span>
                          </TabsTrigger>
                        )}
                        {isAdmin && (
                          <TabsTrigger
                            value="settings"
                            disabled={!canSwitchTab && activeTab !== "settings"}
                            className={cn(
                              "flex items-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white rounded-xl px-6 py-3 transition-all duration-300",
                              !canSwitchTab && activeTab !== "settings" && "opacity-50 cursor-not-allowed",
                            )}
                          >
                            <Settings className="w-4 h-4" />
                            <span>Settings</span>
                          </TabsTrigger>
                        )}
                      </>
                    )
                  }
                </TabsList>
              )}
            </div>

            {/* Recording Tab */}
            <TabsContent value="record" className="space-y-8">
              <Card className="bg-white/80 backdrop-blur-xl border-0 shadow-2xl rounded-3xl overflow-hidden">
                <CardContent className="p-16">
                  <div className="flex flex-col items-center space-y-12">
                    {/* Recording Button */}
                    <div className="relative">
                      <Button
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={isProcessing || isAudioReady}
                        size="lg"
                        className={cn(
                          "w-40 h-40 rounded-full transition-all duration-500 shadow-2xl border-4",
                          isRecording
                            ? "bg-gradient-to-br from-rose-400 via-pink-500 to-purple-600 border-white/50 transform scale-110"
                            : "bg-gradient-to-br from-purple-500 via-pink-500 to-indigo-600 border-white/30 hover:scale-105 hover:shadow-3xl",
                          (isProcessing || isSpeaking) && "opacity-50 cursor-not-allowed",
                          isRecording && breathingPhase === "inhale" && "transform scale-110",
                          isRecording && breathingPhase === "exhale" && "transform scale-105",
                        )}
                      >
                        {isRecording ? (
                          <div className="flex flex-col items-center space-y-2">
                            <Mic className="w-16 h-16 text-white" />
                            <span className="text-white text-sm font-medium">{formatTime(currentRecordingTimeRef.current)}</span>
                          </div>
                        ) : (
                          <Mic className="w-16 h-16 text-white" />
                        )}
                      </Button>

                      {/* Gentle breathing ring for recording */}
                      {isRecording && (
                        <div
                          className={cn(
                            "absolute inset-0 rounded-full border-2 border-white/30 transition-all duration-3000 ease-in-out",
                            breathingPhase === "inhale" ? "scale-125" : "scale-110",
                          )}
                        ></div>
                      )}
                    </div>

                    {/* Status Text */}
                    <div className="text-center space-y-4 max-w-2xl">
                      <h2 className="text-3xl font-bold text-gray-800">
                        {isRecording
                          ? "I'm here, actively listening to you with care..."
                          : isProcessing
                            ? "Reflecting on your words..."
                            : isSpeaking
                              ? "Speaking your reflection..."
                              : isAudioReady
                                ? "Your reflection is ready to play"
                              : "Ready to listen to your voice"}
                      </h2>
                      <p className="text-lg text-gray-600 leading-relaxed">
                        {isRecording
                          ? "Take your time. Breathe deeply. Share whatever feels right. When you're ready to finish, simply say 'I'm complete' or tap the button."
                          : isProcessing
                            ? "I'm using AI to transcribe and hear what you've shared, creating an objective synthesis."
                            : isSpeaking
                              ? "Listen to your personalized reflection. Recording is paused while I'm speaking."
                              : isAudioReady
                                ? "Click the Play button to hear your personalized reflection."
                              : "This is your safe space. Click the microphone when you're ready to share your thoughts, feelings, anything you want help remembering or whatever is on your mind."}
                      </p>
                    </div>

                    {/* Processing Progress */}
                    {isProcessing && (
                      <div className="w-full max-w-lg space-y-6">
                        <div className="flex items-center justify-center space-x-3 text-gray-600">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
                            <div
                              className="w-2 h-2 bg-pink-500 rounded-full animate-bounce"
                              style={{ animationDelay: "0.1s" }}
                            ></div>
                            <div
                              className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"
                              style={{ animationDelay: "0.2s" }}
                            ></div>
                          </div>
                          <span className="font-medium">{processingStage}</span>
                        </div>
                        <Progress value={progress} className="h-3 bg-white/50 rounded-full overflow-hidden" />
                      </div>
                    )}

                    {/* Gentle guidance */}
                    {!isRecording && !isProcessing && (
                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-8 max-w-2xl">
                        <div className="flex items-start space-x-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-8 h-8">
                              <defs>
                                <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
                                  <stop offset="0%" stopColor="#8e2de2"/>
                                  <stop offset="100%" stopColor="#f2994a"/>
                                </linearGradient>
                              </defs>
                              <rect width="100" height="100" rx="20" fill="url(#grad2)"/>
                              <rect y="50" width="100" height="1.5" fill="#fff" opacity="0.2"/>
                              <path d="M30 20 H70 A5 5 0 0 1 75 25 V45 A5 5 0 0 1 70 50 H50 L45 60 V50 H30 A5 5 0 0 1 25 45 V25 A5 5 0 0 1 30 20 Z" fill="#fff"/>
                              <path d="M30 80 H70 A5 5 0 0 0 75 75 V55 A5 5 0 0 0 70 50 H50 L45 40 V50 H30 A5 5 0 0 0 25 55 V75 A5 5 0 0 0 30 80 Z" fill="#fff" opacity="0.3"/>
                            </svg>
                          </div>
                          <div className="space-y-3">
                            <h3 className="font-semibold text-gray-800">A gentle reminder</h3>
                            <p className="text-gray-600 leading-relaxed">
                              There's no right or wrong way to use this space. You might share your dreams, process a
                              difficult day, explore your feelings, or simply think out loud. Whatever you choose to share
                              will be private and secure.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Summary Tab */}
            {currentSession && (
              <TabsContent value="summary" className="space-y-8">
                <Card className="bg-white/80 backdrop-blur-xl border-0 shadow-2xl rounded-3xl overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-white/30 p-8">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-2xl text-gray-800 mb-2">Your Reflection</CardTitle>
                        <CardDescription className="text-gray-600 text-lg">
                          {currentSession.timestamp.toLocaleDateString("en-US", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </CardDescription>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Button
                          variant="outline"
                          onClick={() => {
                            console.log('Listen button clicked, states:', { isSpeaking, isAudioReady, hasSummary: !!currentSession?.summary });
                            if (isSpeaking) {
                              // Stop current audio/speech
                              console.log('Stopping current speech');
                              stopSpeech();
                            } else if (isAudioReady) {
                              // Play the ready audio
                              console.log('Playing ready audio');
                              playAudio();
                            } else {
                            // Stop any current speech before starting new
                              console.log('Starting new speech generation');
                            if (speechSynthesis.speaking) {
                              speechSynthesis.cancel();
                            }
                            // Clear any existing audio elements
                            const existingAudio = document.querySelector('audio');
                            if (existingAudio) {
                              existingAudio.pause();
                              existingAudio.remove();
                            }
                              // Reset speaking state and audio ready state
                            setIsSpeaking(false);
                              setIsAudioReady(false);
                            // Start new speech
                            speakSummary(currentSession.summary);
                            }
                          }}
                          disabled={!currentSession?.summary}
                          className={cn(
                            "flex items-center space-x-2 rounded-xl px-6 py-3 transition-all duration-300",
                            isSpeaking 
                              ? "bg-white/80 border-red-200 hover:bg-red-50" 
                              : "bg-white/80 border-purple-200 hover:bg-purple-50"
                          )}
                        >
                          {isSpeaking ? (
                            <MicOff className="w-5 h-5 text-red-600" />
                          ) : (
                          <Volume2 className="w-5 h-5 text-purple-600" />
                          )}
                          <span className={cn(
                            "font-medium",
                            isSpeaking ? "text-red-600" : "text-purple-600"
                          )}>
                            {isSpeaking ? "Stop" : "Listen"}
                          </span>
                        </Button>

                        {/* Voice Clone Toggle */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                              onClick={handleVoiceClone}
                              disabled={isCloningVoice}
                              className={cn(
                                "flex items-center space-x-2 rounded-xl px-6 py-3 transition-all duration-300",
                                hasVoiceClone 
                                  ? "bg-green-50 border-green-200 hover:bg-green-100" 
                                  : "bg-white/80 border-blue-200 hover:bg-blue-50"
                              )}
                            >
                              {isCloningVoice ? (
                                <>
                                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                  <span className="text-blue-600 font-medium">Cloning...</span>
                                </>
                              ) : hasVoiceClone ? (
                                <>
                                  <Mic className="w-5 h-5 text-green-600" />
                                  <span className="text-green-600 font-medium">Replace Voice Clone</span>
                              </>
                            ) : (
                              <>
                                  <Mic className="w-5 h-5 text-blue-600" />
                                  <span className="text-blue-600 font-medium">Clone Voice</span>
                              </>
                            )}
                          </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {hasVoiceClone 
                              ? "Replace your existing voice clone with a new version using the current audio recording. This will create a fresh voice clone with the latest audio data."
                              : "Clone your voice to hear reflections in your own voice. Audio is processed by ElevenLabs and not stored permanently."
                            }
                          </TooltipContent>
                        </Tooltip>
                        
                        {/* Voice Clone Error Display */}
                        {voiceCloneError && (
                          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                            {voiceCloneError}
                          </div>
                        )}

                        {/* Delete Clone Button - only show when voice clone exists */}
                        {hasVoiceClone && userVoiceCloneId && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                                onClick={handleDeleteVoiceClone}
                                disabled={false}
                            className="flex items-center space-x-2 bg-white/80 border-red-200 hover:bg-red-50 rounded-xl px-6 py-3"
                          >
                            <MicOff className="w-5 h-5 text-red-600" />
                                <span className="text-red-600 font-medium">Delete Clone</span>
                          </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Delete your voice clone and return to using the default voice
                            </TooltipContent>
                          </Tooltip>
                        )}

                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-12">
                    <div className="max-w-4xl mx-auto">
                      <div className="relative">
                        <div className="absolute -left-6 top-0 w-1 h-full bg-gradient-to-b from-purple-400 to-pink-500 rounded-full"></div>
                        <blockquote className="text-xl text-gray-700 leading-relaxed font-medium italic pl-8">
                          "{currentSession.summary}"
                          {currentSession.summary?.startsWith("I said:") && (
                            <span className="text-sm text-gray-400 ml-2" title="Using original transcript as summary">
                              (original)
                            </span>
                          )}
                        </blockquote>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {currentSession && (
                  <div className="flex items-center space-x-2 mt-2">
                    <Badge variant="secondary">
                      TTS: {actualTTSService === "elevenlabs" ? "ElevenLabs"
                        : actualTTSService === "hume" ? "Hume.ai"
                        : actualTTSService === "google" ? "Google TTS"
                        : "Browser"}
                      {hasVoiceClone && userVoiceCloneId && (
                        <> - Your Voice Clone</>
                      )}
                      {/* Debug info - moved to useEffect */}
                      {!hasVoiceClone && globalSettings?.tts_service === "elevenlabs" && elevenLabsVoices.find(v => v.id === globalSettings.elevenlabs_voice_id) && (
                        <> - {elevenLabsVoices.find(v => v.id === globalSettings.elevenlabs_voice_id)?.name}</>
                      )}
                      {globalSettings?.tts_service === "google" && (
                        <> - {globalSettings.google_lang || selectedGoogleLang} / {globalSettings.google_gender || selectedGoogleGender}</>
                      )}
                      {globalSettings?.tts_service === "hume" && (
                        <> - {globalSettings.hume_voice || selectedHumeVoice}</>
                      )}
                      {globalSettings?.tts_service === "browser" && <> - System Voice</>}
                    </Badge>
                  </div>
                )}
              </TabsContent>
            )}

            {/* Analysis Tab */}
            {currentSession && (
              <TabsContent value="analysis" className="space-y-8">
                <div className="grid gap-8">
                  {/* Emotions */}
                  <Card className="bg-white/80 backdrop-blur-xl border-0 shadow-2xl rounded-3xl overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 p-8">
                      <CardTitle className="text-2xl text-gray-800 flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-500 rounded-lg flex items-center justify-center">
                          <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <span>Emotional Landscape</span>
                      </CardTitle>
                      <CardDescription className="text-gray-600 text-lg">
                        {serviceStatus.huggingface
                          ? "Hybrid emotion analysis combining text and audio models for maximum accuracy"
                          : <span className="text-orange-600 font-semibold">(Demo) Fallback emotion analysis – not real AI, for demonstration only</span>}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-8">
                      {/* Source Legend */}
                      <div className="mb-6 p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Analysis Sources:</h4>
                        <div className="flex flex-wrap gap-4 text-xs">
                          <div className="flex items-center space-x-2">
                            <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                              <div className="flex items-center space-x-1">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span>Hybrid</span>
                              </div>
                            </Badge>
                            <span className="text-gray-600">Both text & audio analysis</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
                              <div className="flex items-center space-x-1">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <span>Text</span>
                              </div>
                            </Badge>
                            <span className="text-gray-600">Word meaning analysis</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">
                              <div className="flex items-center space-x-1">
                                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                                <span>Audio</span>
                              </div>
                            </Badge>
                            <span className="text-gray-600">Voice tone analysis</span>
                          </div>
                        </div>
                      </div>
                      {currentSession.emotions && currentSession.emotions.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {currentSession.emotions.map((emotion, index) => {
                            // Determine source information
                            const sources = (emotion as any).sources || ['text']; // Fallback for old data
                            const isHybrid = sources.includes('text') && sources.includes('audio');
                            const isTextOnly = sources.includes('text') && !sources.includes('audio');
                            const isAudioOnly = sources.includes('audio') && !sources.includes('text');
                            
                            // Create tooltip content
                            const getTooltipContent = () => {
                              if (isHybrid) {
                                return "This emotion was detected by both text analysis (analyzing your words) and audio analysis (analyzing your voice tone). This cross-referenced result has higher confidence.";
                              } else if (isTextOnly) {
                                return "This emotion was detected by text analysis, which analyzes the meaning and sentiment of your spoken words using HuggingFace's RoBERTa model.";
                              } else if (isAudioOnly) {
                                return "This emotion was detected by audio analysis, which analyzes your voice tone, pitch, and inflection using HuggingFace's Wav2Vec2 model.";
                              }
                              return "Emotion analysis result";
                            };

                            // Create source badge
                            const getSourceBadge = () => {
                              if (isHybrid) {
                                return (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                                        <div className="flex items-center space-x-1">
                                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                          <span>Hybrid</span>
                                        </div>
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{getTooltipContent()}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              } else if (isTextOnly) {
                                return (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
                                        <div className="flex items-center space-x-1">
                                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                          <span>Text</span>
                                        </div>
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{getTooltipContent()}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              } else if (isAudioOnly) {
                                return (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">
                                        <div className="flex items-center space-x-1">
                                          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                                          <span>Audio</span>
                                        </div>
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{getTooltipContent()}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              }
                              return null;
                            };

                            return (
                          <div
                            key={index}
                            className="bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 rounded-2xl p-6 border border-purple-100 hover:shadow-lg transition-all duration-300"
                          >
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="font-semibold text-gray-800 text-lg">{emotion.emotion}</h3>
                                  <div className="flex items-center space-x-2">
                                    {getSourceBadge()}
                              <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                                {(emotion.confidence * 100).toFixed(0)}%
                              </Badge>
                                  </div>
                            </div>
                            <div className="w-full bg-white/60 rounded-full h-3 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-purple-400 to-pink-500 h-3 rounded-full transition-all duration-1000 ease-out"
                                style={{ width: `${emotion.confidence * 100}%` }}
                              ></div>
                            </div>
                          </div>
                            );
                          })}
                      </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-1.009-5.824-2.709" />
                            </svg>
                          </div>
                          <h3 className="text-lg font-semibold text-gray-700 mb-2">Emotion Analysis Unavailable</h3>
                          <p className="text-gray-500">Emotion analysis failed. This could be due to network issues or service limitations.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Voice Characteristics (DSP) */}
                  <Card className="bg-white/80 backdrop-blur-xl border-0 shadow-2xl rounded-3xl overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 p-8">
                      <CardTitle className="text-2xl text-gray-800 flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-lg flex items-center justify-center">
                          <Waves className="w-4 h-4 text-white" />
                        </div>
                        <span>Voice Patterns (DSP)</span>
                      </CardTitle>
                      <CardDescription className="text-gray-600 text-lg">
                        Audio analysis of your vocal characteristics and delivery
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-8">
                      {currentSession.vocalCharacteristics.tone === "Unknown" ? (
                        <div className="text-center py-12">
                          <div className="text-gray-400 text-lg mb-2">Vocal Analysis Unavailable</div>
                          <div className="text-gray-500 text-sm">
                            Audio analysis failed. This could be due to audio quality issues or browser limitations.
                          </div>
                        </div>
                      ) : (
                      <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-6">
                          <div className="flex justify-between items-center p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-gray-700 font-medium underline decoration-dotted cursor-help">Tone</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                Tone is estimated using the zero crossing rate (ZCR) of your audio. Higher ZCR means a brighter tone, lower means a warmer tone.
                              </TooltipContent>
                            </Tooltip>
                            <Badge className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                              {currentSession.vocalCharacteristics.tone}
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-gray-700 font-medium underline decoration-dotted cursor-help">Pace</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                Pace is estimated by analyzing the average length of speech segments above a silence threshold. Longer segments mean a more deliberate pace.
                              </TooltipContent>
                            </Tooltip>
                            <Badge className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                              {currentSession.vocalCharacteristics.pace}
                            </Badge>
                          </div>
                        </div>
                        <div className="space-y-6">
                          <div className="flex justify-between items-center p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-gray-700 font-medium underline decoration-dotted cursor-help">Pitch</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                Pitch is not directly measured, but inferred from the balance of the audio waveform and articulation. This is a rough estimate.
                              </TooltipContent>
                            </Tooltip>
                            <Badge className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                              {currentSession.vocalCharacteristics.pitch}
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-gray-700 font-medium underline decoration-dotted cursor-help">Volume</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                Volume is estimated using the root mean square (RMS) energy of your audio. Higher RMS means a stronger volume.
                              </TooltipContent>
                            </Tooltip>
                            <Badge className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                              {currentSession.vocalCharacteristics.volume}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            )}

            {/* Transcript Tab - Hidden but functionality preserved */}
            {/* {currentSession && currentSession.transcript && (
              <TabsContent value="transcript" className="space-y-8">
                <Card className="bg-white/80 backdrop-blur-xl border-0 shadow-2xl rounded-3xl overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-gray-50 to-slate-50 p-8">
                    <CardTitle className="text-2xl text-gray-800 flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-slate-500 rounded-lg flex items-center justify-center">
                        <FileText className="w-4 h-4 text-white" />
                      </div>
                      <span>Your Words</span>
                    </CardTitle>
                    <CardDescription className="text-gray-600 text-lg">
                      Transcribed using Google AI Speech-to-Text
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-12">
                    <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl p-8 border border-gray-200">
                      <p className="text-gray-700 leading-relaxed text-lg whitespace-pre-wrap font-mono">
                        {currentSession.transcript}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                {currentSession && (
                  <div className="text-sm text-gray-500 mt-2">
                    {(() => {
                      const transcriptWords = calculateWordCount(currentSession.transcript || '');
                      const summaryWords = calculateWordCount(currentSession.summary || '');
                      
                      // Use the stored recording duration from the red bubble timer
                      const duration = currentSession.recordingDuration || 0;
                      
                      if (duration === 0) {
                        return `Transcript: ${transcriptWords} words | Summary: ${summaryWords} words`;
                      }
                      
                      const m = Math.floor(duration / 60);
                      const s = Math.round(duration % 60);
                      return `Transcript: ${transcriptWords} words | Summary: ${summaryWords} words | Duration: ${m}:${s.toString().padStart(2, '0')} min`;
                    })()}
                  </div>
                )}
              </TabsContent>
            )} */}

            {/* History Tab */}
            {sessions.filter(s => s.transcript).length > 0 && (
              <TabsContent value="history" className="space-y-8">
                <Card className="bg-white/80 backdrop-blur-xl border-0 shadow-2xl rounded-3xl overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 p-8">
                    <CardTitle className="text-2xl text-gray-800 flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
                        <History className="w-4 h-4 text-white" />
                      </div>
                      <span>Your Journey</span>
                    </CardTitle>
                    <CardDescription className="text-gray-600 text-lg">
                      A collection of your reflections and growth over time
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-8">
                    <div className="space-y-6">
                      {sessions.filter(s => s.transcript).map((session, index) => (
                        <div
                          key={session.id}
                          className={cn(
                            "p-6 rounded-2xl cursor-pointer transition-all duration-300 border-2",
                            currentSession?.id === session.id
                              ? "bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 shadow-lg"
                              : "bg-white/60 border-gray-200 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 hover:border-purple-200 hover:shadow-lg",
                          )}
                          onClick={() => setCurrentSession(session)}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-3">
                                <Badge variant="outline" className="text-xs">
                                  Session {sessions.length - index}
                                </Badge>
                                <span className="text-sm text-gray-500">
                                  {session.timestamp.toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                              <div className="text-gray-500 text-xs mt-2">
                                <strong>Transcript:</strong> {session.transcript}
                              </div>
                              <div className="text-gray-700 mt-1">
                                <strong>Summary:</strong> {session.summary}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 ml-6">
                              {session.emotions.slice(0, 3).map((emotion, emotionIndex) => (
                                <Badge
                                  key={emotionIndex}
                                  variant="secondary"
                                  className="text-xs bg-purple-100 text-purple-700"
                                >
                                  {emotion.emotion}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {(() => {
                              const transcriptWords = calculateWordCount(session.transcript || '');
                              const summaryWords = calculateWordCount(session.summary || '');
                              
                              // Use the stored recording duration from the red bubble timer
                              const duration = session.recordingDuration || 0;
                              
                              if (duration === 0) {
                                return `${transcriptWords} words | ${summaryWords} words`;
                              }
                              
                              const m = Math.floor(duration / 60);
                              const s = Math.round(duration % 60);
                              return `${transcriptWords} words | ${summaryWords} words | ${m}:${s.toString().padStart(2, '0')} min`;
                            })()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Settings Tab - Admin Only */}
            {isAdmin && (
              <TabsContent value="settings" className="space-y-8">
              <Card className="bg-white/80 backdrop-blur-xl border-0 shadow-2xl rounded-3xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 p-8">
                  <CardTitle className="text-2xl text-gray-800 flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Settings className="w-4 h-4 text-white" />
                    </div>
                    <span>Admin Settings</span>
                  </CardTitle>
                  <CardDescription className="text-gray-600 text-lg">
                    Configure AI service preferences and debug tools. <br />
                    <strong>Note:</strong> API keys are managed securely in Vercel environment variables and are never exposed to the browser or stored in the UI.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-8 space-y-12">
                  {/* Service Preferences Section */}
                  <div className="space-y-6">
                    <h3 className="text-xl font-semibold text-gray-800">Service Preferences</h3>
                    <div className="flex flex-col gap-4">
                      <label className="font-medium text-gray-700">Summary Service</label>
                      <select
                        className="w-full max-w-xs p-2 border rounded"
                        value={globalSettings?.summary_service || ''}
                        onChange={e => handleGlobalSettingsChange({ summary_service: e.target.value })}
                      >
                        <option value="openai">OpenAI</option>
                        <option value="gemini">Google Gemini</option>
                        <option value="claude">Anthropic Claude</option>
                      </select>
                      <div className="text-sm text-gray-500">Current: {globalSettings?.summary_service}</div>
                      </div>
                    <div className="flex flex-col gap-4 mt-6">
                      <label className="font-medium text-gray-700">TTS (Voice) Service</label>
                        <select
                        className="w-full max-w-xs p-2 border rounded"
                        value={globalSettings?.tts_service || ''}
                        onChange={e => handleGlobalSettingsChange({ tts_service: e.target.value })}
                      >
                        <option value="browser">Browser (System Voice)</option>
                        <option value="elevenlabs">ElevenLabs</option>
                        <option value="google">Google TTS</option>
                        <option value="hume">Hume.ai</option>
                        </select>
                      <div className="text-sm text-gray-500">Current: {globalSettings?.tts_service}</div>
                      </div>
                    {/* Add similar controls for elevenlabs_voice_id, google_lang, google_gender, hume_voice if needed */}
                    <label>ElevenLabs Voice</label>
                            <select
                      value={globalSettings?.elevenlabs_voice_id || ''}
                      onChange={e => handleGlobalSettingsChange({ elevenlabs_voice_id: e.target.value })}
                            >
                              {elevenLabsVoices.map(v => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                              ))}
                            </select>
                    <label>Hume Voice</label>
                    <input
                      type="text"
                      value={globalSettings?.hume_voice || ''}
                      onChange={e => handleGlobalSettingsChange({ hume_voice: e.target.value })}
                    />
                    <label>Google TTS Language</label>
                    <input
                      type="text"
                      value={globalSettings?.google_lang || ''}
                      onChange={e => handleGlobalSettingsChange({ google_lang: e.target.value })}
                    />
                    <label>Google TTS Gender</label>
                            <select
                      value={globalSettings?.google_gender || ''}
                      onChange={e => handleGlobalSettingsChange({ google_gender: e.target.value })}
                            >
                              <option value="FEMALE">Female</option>
                              <option value="MALE">Male</option>
                            </select>
                          </div>
                  {/* Service Status Section */}
                  <div className="space-y-6">
                    <h3 className="text-xl font-semibold text-gray-800">Service Status</h3>
                    <ServiceStatusAndTestTools />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </TooltipProvider>
  )
}

// ServiceStatusAndTestTools component
function ServiceStatusAndTestTools() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [testResults, setTestResults] = useState<{ [key: string]: string }>({});
  const [testLoading, setTestLoading] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    fetch("/api/status")
      .then((res) => res.json())
      .then((data) => setStatus(data))
      .finally(() => setLoading(false));
  }, []);

  const services = [
    { key: "openai", label: "OpenAI", endpoint: API_ENDPOINTS.SUMMARIZE, testBody: { transcript: "Test summary", service: "openai" } },
    { key: "gemini", label: "Gemini", endpoint: API_ENDPOINTS.SUMMARIZE, testBody: { transcript: "Test summary", service: "gemini" } },
    { key: "claude", label: "Claude", endpoint: API_ENDPOINTS.SUMMARIZE, testBody: { transcript: "Test summary", service: "claude" } },
    { key: "huggingface", label: "HuggingFace (Emotions)", endpoint: "/api/emotions", testBody: { text: "I am happy and excited." } },
    { key: "elevenlabs", label: "ElevenLabs (TTS)", endpoint: API_ENDPOINTS.VOICE_ELEVENLABS, testBody: { text: "Hello from ElevenLabs!" } },
    { key: "hume", label: "Hume (TTS)", endpoint: "/api/voice/hume", testBody: { text: "Hello from Hume!" } },
    { key: "google", label: "Google TTS", endpoint: "/api/voice/google", testBody: { text: "Hello from Google!" } },
  ];

  const handleTest = async (service: any) => {
    setTestLoading((prev) => ({ ...prev, [service.key]: true }));
    setTestResults((prev) => ({ ...prev, [service.key]: "" }));
    try {
      const res = await fetch(service.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(service.testBody),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setTestResults((prev) => ({ ...prev, [service.key]: JSON.stringify(data) }));
      } else {
        setTestResults((prev) => ({ ...prev, [service.key]: `Error: ${res.status}` }));
      }
    } catch (e: any) {
      setTestResults((prev) => ({ ...prev, [service.key]: `Error: ${e.message}` }));
    } finally {
      setTestLoading((prev) => ({ ...prev, [service.key]: false }));
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <strong>Instructions:</strong> Use the buttons below to check which AI services are up and test their connectivity. If a service fails, check your Vercel environment variables and quotas.
                        </div>
      {loading ? (
        <div>Loading service status...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {services.map((service) => (
            <div key={service.key} className="p-4 border rounded-xl bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{service.label}</span>
                {status && status[service.key] !== undefined && (
                  <span className={status[service.key] ? "text-green-600" : "text-red-600"}>
                    {status[service.key] ? "Up" : "Down"}
                  </span>
                )}
                          </div>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                onClick={() => handleTest(service)}
                disabled={testLoading[service.key]}
              >
                {testLoading[service.key] ? "Testing..." : "Test API"}
              </button>
              {testResults[service.key] && (
                <div className="mt-2 text-xs text-gray-700 break-all">
                  {testResults[service.key]}
                          </div>
                        )}
                      </div>
          ))}
                    </div>
            )}
        </div>
  );
}

