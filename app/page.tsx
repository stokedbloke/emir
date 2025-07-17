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
  CheckCircle,
  Lock,
  Pause,
  Play,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { v4 as uuidv4 } from 'uuid';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface VocalCharacteristics {
  tone: string
  pace: string
  pitch: string
  volume: string
  confidence: number
}

interface EmotionAnalysis {
  emotion: string
  confidence: number
}

interface SessionData {
  id: string
  timestamp: Date
  transcript: string
  summary: string
  emotions: EmotionAnalysis[]
  vocalCharacteristics: VocalCharacteristics
  audioBlob?: Blob
}

// Initialize Supabase client for browser use. These values are public and safe to expose.
// Make sure to set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env and Vercel dashboard.
const supabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function TalkToMyself() {
  // All hooks must be declared here, before any return statement
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStage, setProcessingStage] = useState("")
  const [progress, setProgress] = useState(0)
  const [sessions, setSessions] = useState<SessionData[]>([])
  const [currentSession, setCurrentSession] = useState<SessionData | null>(null)
  const [activeTab, setActiveTab] = useState("record")
  const [isAdmin, setIsAdmin] = useState(false)
  const [settings, setSettings] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("emotional-mirror-settings")
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch (e) {
          console.error("Failed to parse saved settings:", e)
        }
      }
    }
    return {
      summaryService: "openai",
      voiceService: "browser",
      storageMode: "session",
    }
  })
  const [recordingTime, setRecordingTime] = useState(0)
  const [breathingPhase, setBreathingPhase] = useState<"inhale" | "exhale">("inhale")
  const [apiCredits, setApiCredits] = useState<Record<string, string | null>>({})
  const [isCheckingCredits, setIsCheckingCredits] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [utteranceRef, setUtteranceRef] = useState<SpeechSynthesisUtterance | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recordingTimerRef = useRef<number | null>(null)
  const breathingTimerRef = useRef<number | null>(null)
  const recognitionRef = useRef<any>(null)
  const isRecordingRef = useRef(false)
  const [liveTranscript, setLiveTranscript] = useState("");
  const [showLiveTranscript, setShowLiveTranscript] = useState(true);
  const { toast } = useToast();
  const fullRecognitionTranscriptRef = useRef("");
  const [serviceStatus, setServiceStatus] = useState({ huggingface: false, google: false });
  const [actualTTSService, setActualTTSService] = useState<string>("browser");
  const [userId, setUserId] = useState<string>("");
  const [speechErrorCount, setSpeechErrorCount] = useState(0);
  const [speechRecognitionError, setSpeechRecognitionError] = useState<string | null>(null);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const MAX_SPEECH_ERRORS = 3;
  const [selectedElevenLabsVoice, setSelectedElevenLabsVoice] = useState<string>("pNInz6obpgDQGcFmaJgB");
  const [elevenLabsVoices, setElevenLabsVoices] = useState<{id: string, name: string}[]>([]);
  const [selectedGoogleLang, setSelectedGoogleLang] = useState<string>("en-US");
  const [selectedGoogleGender, setSelectedGoogleGender] = useState<string>("FEMALE");
  const [selectedHumeVoice, setSelectedHumeVoice] = useState<string>("ITO");
  const [microphoneError, setMicrophoneError] = useState<string | null>(null);
  const [isRequestingMic, setIsRequestingMic] = useState(false);
  const [globalSettings, setGlobalSettings] = useState(null);

  useEffect(() => {
    fetch('/api/global-settings')
      .then(res => res.json())
      .then(data => setGlobalSettings(data.settings))
      .catch(() => setGlobalSettings(null));
  }, []);

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

  useEffect(() => {
    fetch('/api/status')
      .then(res => res.json())
      .then(setServiceStatus)
      .catch(() => setServiceStatus({ huggingface: false, google: false }));
  }, []);

  // Save settings based on storage preference
  useEffect(() => {
    if (typeof window !== "undefined" && settings.storageMode !== "memory") {
      if (settings.storageMode === "session") {
        sessionStorage.setItem("emotional-mirror-settings", JSON.stringify(settings))
      } else if (settings.storageMode === "local") {
        localStorage.setItem("emotional-mirror-settings", JSON.stringify(settings))
      }
      // "none" mode doesn't save anything
    }
  }, [settings])

  // Check microphone permission on mount
  useEffect(() => {
    checkMicrophonePermission()
  }, [])

  // Check if user is admin (for development/testing)
  useEffect(() => {
    // Check if the user is an admin by comparing the URL or sessionStorage secret to the public admin secret.
    // This is only for development/testing and does not provide real security.
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search)
      const adminSecret = urlParams.get("admin")
      const storedAdminSecret = sessionStorage.getItem("admin-secret")
      if (adminSecret === process.env.NEXT_PUBLIC_ADMIN_SECRET || storedAdminSecret === process.env.NEXT_PUBLIC_ADMIN_SECRET) {
        setIsAdmin(true)
        sessionStorage.setItem("admin-secret", adminSecret || storedAdminSecret || "")
      }
    }
  }, [])

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = setInterval(() => {
        if (isRecordingRef.current) {
          setRecordingTime((prev) => prev + 1)
        }
      }, 1000)
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
      setRecordingTime(0)
    }

    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
    }
  }, [isRecording])

  // Breathing animation
  useEffect(() => {
    if (isRecording) {
      breathingTimerRef.current = setInterval(() => {
        setBreathingPhase((prev) => (prev === "inhale" ? "exhale" : "inhale"))
      }, 3000)
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const checkMicrophonePermission = async () => {
    try {
      const result = await navigator.permissions.query({ name: "microphone" as PermissionName })
      if (result.state === "granted") {
        await initializeMicrophone()
      } else {
        setHasPermission(false)
      }
    } catch (error) {
      setHasPermission(false)
    }
  }

  const initializeMicrophone = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicrophoneError("Microphone access is not supported on this device or browser. Please use the latest version of Safari or Chrome on iOS/Android, or try on desktop.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
        },
      })
      streamRef.current = stream
      setHasPermission(true)

      audioContextRef.current = new AudioContext()
      analyserRef.current = audioContextRef.current.createAnalyser()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)
    } catch (error) {
      console.error("Microphone access denied:", error)
      setHasPermission(false)
    }
  }

  const requestMicrophoneAccess = () => {
    setIsRequestingMic(true);
    setMicrophoneError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicrophoneError("Microphone access is not supported on this device or browser. Please use the latest version of Safari or Chrome on iOS/Android, or try on desktop.");
      setIsRequestingMic(false);
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        streamRef.current = stream;
        setHasPermission(true);
        setIsRequestingMic(false);
        // You can now proceed to initialize the rest of your audio logic
        initializeMicrophoneAfterPermission(stream);
      })
      .catch((err) => {
        setMicrophoneError("Microphone access denied or unavailable. Please check your browser settings and try again.");
        setIsRequestingMic(false);
      });
  };

  // Separate function for post-permission logic
  const initializeMicrophoneAfterPermission = (stream) => {
    // ...rest of your microphone initialization logic that does not require user gesture...
  };

  const playChime = (type: "start" | "stop") => {
    const audioContext = new AudioContext()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    if (type === "start") {
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(660, audioContext.currentTime + 0.4)
    } else {
      oscillator.frequency.setValueAtTime(660, audioContext.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.5)
    }

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.5)
  }

  const startRecording = () => {
    if (!streamRef.current || isSpeaking) return

    if (speechSynthesis.speaking) {
      speechSynthesis.cancel()
      setIsSpeaking(false)
    }

    audioChunksRef.current = []
    console.log("Starting MediaRecorder with stream:", streamRef.current)
    console.log("Stream tracks:", streamRef.current.getTracks())
    console.log("Audio tracks:", streamRef.current.getAudioTracks())
    
    mediaRecorderRef.current = new MediaRecorder(streamRef.current, {
      mimeType: "audio/webm;codecs=opus",
    })

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
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecordingRef.current) {
      try {
        mediaRecorderRef.current.stop()
      } catch (error) {
        console.log("Error stopping MediaRecorder:", error)
      }

      setIsRecording(false)
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
      setSpeechErrorCount(0);
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
      const triggers = [
        "i am complete", "i'm complete"
      ];
      // If any trigger phrase is present, stop recording
      if (triggers.some(trigger => allTranscript.endsWith(trigger))) {
        stopRecording();
      }
    }

    recognitionRef.current.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error, event);
      if (event.error === "no-speech") {
        setSpeechErrorCount((count) => {
          const newCount = count + 1;
          if (newCount >= MAX_SPEECH_ERRORS) {
            setSpeechRecognitionError("No speech detected. Please check your microphone and try again.");
            toast({
              title: "No speech detected",
              description: "We couldn't hear anything. Please check your microphone and try again.",
              variant: "destructive",
            });
            stopRecording();
          }
          return newCount;
        });
      } else {
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

  const analyzeVocalCharacteristics = async (audioBlob: Blob): Promise<VocalCharacteristics> => {
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
      console.error("Frontend DSP analysis failed, using fallback.", error);
      return { tone: "Warm", pace: "Natural", pitch: "Balanced", volume: "Moderate", confidence: 0.75 };
    }
  };

  const processAudio = async () => {
    setIsProcessing(true)
    setProgress(0)

    try {
      setProcessingStage("Transcribing your reflection...")
      setProgress(25)

      console.log("Processing audio chunks:", audioChunksRef.current.length)
      console.log("Audio chunks sizes:", audioChunksRef.current.map(chunk => chunk.size))
      const totalSize = audioChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0)
      console.log("Total audio size:", totalSize, "bytes")

      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm;codecs=opus" })
      console.log("Created audio blob:", audioBlob.size, "bytes")
      
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
      const triggers = [
        "i am complete", "i'm complete"
      ];
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

      setProcessingStage("Analyzing your voice patterns...")
      setProgress(50)

      const vocalCharacteristics = await analyzeVocalCharacteristics(audioBlob);
      console.log("Vocal characteristics:", vocalCharacteristics);

      setProcessingStage("Creating your personalized summary...")
      setProgress(75)

      const summary = (await generateSummary(transcript)).trim()
      const lowerSummary = summary.toLowerCase();
      if (
        !summary ||
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

      setProcessingStage("Understanding emotional patterns...")
      setProgress(90)

      const emotions = await analyzeEmotions(transcript)

      setProcessingStage("Preparing your reflection...")
      setProgress(100)

      const newSession: SessionData = {
        id: Date.now().toString(),
        timestamp: new Date(),
        transcript,
        summary,
        emotions,
        vocalCharacteristics,
        audioBlob,
      }

      setSessions((prev) => [newSession, ...prev])
      setCurrentSession(newSession)
      setActiveTab("summary")

      setTimeout(() => speakSummary(summary), 1000)

      // Save to Supabase
      if (userId) {
        try {
          await saveReflectionToSupabase({
            userId,
            transcript,
            summary,
            emotions,
            vocal: vocalCharacteristics,
          });
        } catch (err) {
          console.error("Failed to save reflection to Supabase:", err);
        }
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
        const timeoutId = setTimeout(() => controller.abort(), 15000)

        const response = await fetch("/api/transcribe", {
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
      //  console.log("Summary service selected:", settings.summaryService);
      // Use API (keys are configured on backend)
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          service: settings.summaryService,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate summary")
      }

      const data = await response.json()
      const summary = data.summary?.trim() || "";

      // If the summary is empty or looks like a stub, return a better fallback
      if (
        !summary ||
        summary.toLowerCase().startsWith("the themes of") ||
        summary.toLowerCase().includes("please provide the personal share")
      ) {
        return transcript ? `You said: "${transcript}"` : "";
      }

      return summary;
    } catch (error) {
      // On error, fallback to transcript or nothing
      return transcript ? `You said: "${transcript}"` : "";
    }
  }

  const analyzeEmotions = async (text: string): Promise<EmotionAnalysis[]> => {
    try {
      const response = await fetch("/api/emotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        return data.emotions
      }
    } catch (error) {
      console.error("Emotion analysis error:", error)
    }

    // Fallback emotions
    return [
      { emotion: "Contemplative", confidence: 0.75 },
      { emotion: "Reflective", confidence: 0.7 },
      { emotion: "Peaceful", confidence: 0.65 },
    ]
  }

  // console.log("TTS service selected:", settings.voiceService);
  // Fetch ElevenLabs voices (API key is configured on backend)
  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const res = await fetch("/api/voice/elevenlabs/voices");
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

  const speakSummary = async (summary: string) => {
    if (!globalSettings) return; // Wait for settings to load

    const ttsService = globalSettings.tts_service;
    // Add any additional settings (voice, lang, etc.) as needed

    const playAudioBlob = (blob: Blob) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.onerror = () => URL.revokeObjectURL(url);
      audio.play();
    };

    if (ttsService === "elevenlabs") {
      try {
        const response = await fetch("/api/voice/elevenlabs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: summary, voiceId: globalSettings.elevenlabs_voice_id }),
        });
        if (!response.ok) throw new Error("Failed to fetch ElevenLabs audio");
        const audioBlob = await response.blob();
        playAudioBlob(audioBlob);
        return;
      } catch (err) {
        // Fallback to browser TTS below
      }
    }
    // ...repeat for other services if needed...

    // Fallback: Browser TTS
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(summary);
      window.speechSynthesis.speak(utterance);
    }
  };

  const pauseResumeSpeech = () => {
    if (speechSynthesis.speaking && !speechSynthesis.paused) {
      speechSynthesis.pause()
      setIsPaused(true)
    } else if (speechSynthesis.paused) {
      speechSynthesis.resume()
      setIsPaused(false)
    }
  }

  const stopSpeech = () => {
    speechSynthesis.cancel()
    setIsSpeaking(false)
    setIsPaused(false)
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

  // Fetch reflections from API route for the current user
  const fetchReflections = async (userId: string) => {
    if (!userId) return [];
    try {
      const res = await fetch('/api/reflection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        toast({
          title: 'Failed to fetch reflection history',
          description: 'There was a problem fetching your reflection history. Please try again.',
          variant: 'destructive',
        });
        return [];
      }
      const data = await res.json();
      // Map DB rows to SessionData shape
      return (data.reflections || []).map((row: any) => ({
        id: row.id,
        timestamp: new Date(row.created_at),
        transcript: row.transcript,
        summary: row.summary,
        emotions: row.emotions || [],
        vocalCharacteristics: row.vocal || {},
        audioBlob: undefined, // Not stored in DB
      }));
    } catch (err) {
      toast({
        title: 'Failed to fetch reflection history',
        description: 'There was a problem fetching your reflection history. Please try again.',
        variant: 'destructive',
      });
      return [];
    }
  };

  // Fetch on mount and when userId changes
  useEffect(() => {
    if (userId) {
      fetchReflections(userId).then(setSessions);
    }
  }, [userId]);

  // After saving a new reflection, re-fetch history
  const saveReflectionToSupabase = async (reflection: any) => {
    try {
      const res = await fetch('/api/reflection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reflection),
      });
      if (!res.ok) {
        toast({
          title: 'Failed to save reflection',
          description: 'There was a problem saving your reflection. Please try again.',
          variant: 'destructive',
        });
      } else {
        // Re-fetch history after successful save
        if (userId) {
          fetchReflections(userId).then(setSessions);
        }
      }
    } catch (err) {
      toast({
        title: 'Failed to save reflection',
        description: 'There was a problem saving your reflection. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Only after all hooks, handle early returns:
  if (hasPermission === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-purple-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-full mx-auto animate-pulse"></div>
            <div className="absolute inset-0 w-20 h-20 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-full mx-auto animate-ping opacity-20"></div>
          </div>
          <p className="text-gray-600 font-medium">Preparing your space...</p>
        </div>
      </div>
    )
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
              onClick={requestMicrophoneAccess}
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

  // Move this function here so setGlobalSettings is in scope
  const handleGlobalSettingsChange = (updates: Record<string, any>) => {
    fetch('/api/global-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // Refetch settings to update UI
          fetch('/api/global-settings')
            .then(res => res.json())
            .then(data => setGlobalSettings(data.settings));
        } else {
          alert(data.error || "Failed to update settings");
        }
      });
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-purple-50 to-indigo-100">
        {/* Ambient background elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"></div>
          <div
            className="absolute top-3/4 right-1/4 w-64 h-64 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"
            style={{ animationDelay: "2s" }}
          ></div>
          <div
            className="absolute bottom-1/4 left-1/2 w-64 h-64 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"
            style={{ animationDelay: "4s" }}
          ></div>
        </div>

        {/* Header */}
        <div className="relative bg-white/60 backdrop-blur-xl border-b border-white/30 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 via-pink-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                    <Heart className="w-6 h-6 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                    <Sparkles className="w-2 h-2 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                    Emotional Mirror
                  </h1>
                  <p className="text-sm text-gray-600">Reflect with clarity and compassion</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {(isRecording || isProcessing) && (
                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 animate-pulse">
                    {isRecording ? "Listening..." : "Processing..."}
                  </Badge>
                )}
                {sessions.length > 0 && (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
                    {sessions.length} reflection{sessions.length !== 1 ? "s" : ""}
                  </Badge>
                )}
                {serviceStatus.google && (
                  <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                    Google AI Connected
                  </Badge>
                )}
                {serviceStatus.huggingface && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
                    HuggingFace Connected
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

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
                            <TabsTrigger
                              value="transcript"
                              disabled={!canSwitchTab && activeTab !== "transcript"}
                              className={cn(
                                "flex items-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white rounded-xl px-6 py-3 transition-all duration-300",
                                !canSwitchTab && activeTab !== "transcript" && "opacity-50 cursor-not-allowed",
                              )}
                            >
                              <FileText className="w-4 h-4" />
                              <span>Transcript</span>
                            </TabsTrigger>
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
                            <span>History</span>
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
                        disabled={isProcessing || isSpeaking}
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
                            <MicOff className="w-16 h-16 text-white" />
                            <span className="text-white text-sm font-medium">{formatTime(recordingTime)}</span>
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
                              : "Ready to listen to your voice"}
                      </h2>
                      <p className="text-lg text-gray-600 leading-relaxed">
                        {isRecording
                          ? "Take your time. Breathe deeply. Share whatever feels right. When you're ready to finish, simply say 'I'm complete' or tap the button."
                          : isProcessing
                            ? "I'm using AI to transcribe and hear what you've shared, creating an objective synthesis."
                            : isSpeaking
                              ? "Listen to your personalized reflection. Recording is paused while I'm speaking."
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
                          onClick={() => speakSummary(currentSession.summary)}
                          disabled={isSpeaking}
                          className="flex items-center space-x-2 bg-white/80 border-purple-200 hover:bg-purple-50 rounded-xl px-6 py-3"
                        >
                          <Volume2 className="w-5 h-5 text-purple-600" />
                          <span className="text-purple-600 font-medium">Listen Again</span>
                        </Button>

                        {isSpeaking && (
                          <Button
                            variant="outline"
                            onClick={pauseResumeSpeech}
                            className="flex items-center space-x-2 bg-white/80 border-orange-200 hover:bg-orange-50 rounded-xl px-6 py-3"
                          >
                            {isPaused ? (
                              <>
                                <Play className="w-5 h-5 text-orange-600" />
                                <span className="text-orange-600 font-medium">Resume</span>
                              </>
                            ) : (
                              <>
                                <Pause className="w-5 h-5 text-orange-600" />
                                <span className="text-orange-600 font-medium">Pause</span>
                              </>
                            )}
                          </Button>
                        )}

                        {isSpeaking && (
                          <Button
                            variant="outline"
                            onClick={stopSpeech}
                            className="flex items-center space-x-2 bg-white/80 border-red-200 hover:bg-red-50 rounded-xl px-6 py-3"
                          >
                            <MicOff className="w-5 h-5 text-red-600" />
                            <span className="text-red-600 font-medium">Stop</span>
                          </Button>
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
                      {settings.voiceService === "elevenlabs" && elevenLabsVoices.find(v => v.id === selectedElevenLabsVoice) && (
                        <> - {elevenLabsVoices.find(v => v.id === selectedElevenLabsVoice)?.name}</>
                      )}
                      {settings.voiceService === "google" && (
                        <> - {selectedGoogleLang} / {selectedGoogleGender}</>
                      )}
                      {settings.voiceService === "hume" && (
                        <> - {selectedHumeVoice}</>
                      )}
                      {settings.voiceService === "browser" && <> - System Voice</>}
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
                          ? "AI-powered emotion analysis using Hugging Face models"
                          : <span className="text-orange-600 font-semibold">(Demo) Fallback emotion analysis – not real AI, for demonstration only</span>}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {currentSession.emotions.map((emotion, index) => (
                          <div
                            key={index}
                            className="bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 rounded-2xl p-6 border border-purple-100 hover:shadow-lg transition-all duration-300"
                          >
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="font-semibold text-gray-800 text-lg">{emotion.emotion}</h3>
                              <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                                {(emotion.confidence * 100).toFixed(0)}%
                              </Badge>
                            </div>
                            <div className="w-full bg-white/60 rounded-full h-3 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-purple-400 to-pink-500 h-3 rounded-full transition-all duration-1000 ease-out"
                                style={{ width: `${emotion.confidence * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
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
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            )}

            {/* Transcript Tab */}
            {currentSession && currentSession.transcript && (
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
                      {settings.geminiKey
                        ? "Transcribed using Google AI Speech-to-Text"
                        : "Transcribed using browser speech recognition"}
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
              </TabsContent>
            )}

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
    { key: "openai", label: "OpenAI", endpoint: "/api/summarize", testBody: { transcript: "Test summary", service: "openai" } },
    { key: "gemini", label: "Gemini", endpoint: "/api/summarize", testBody: { transcript: "Test summary", service: "gemini" } },
    { key: "claude", label: "Claude", endpoint: "/api/summarize", testBody: { transcript: "Test summary", service: "claude" } },
    { key: "huggingface", label: "HuggingFace (Emotions)", endpoint: "/api/emotions", testBody: { text: "I am happy and excited." } },
    { key: "elevenlabs", label: "ElevenLabs (TTS)", endpoint: "/api/voice/elevenlabs", testBody: { text: "Hello from ElevenLabs!" } },
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

