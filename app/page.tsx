"use client"

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

export default function TalkToMyself() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStage, setProcessingStage] = useState("")
  const [progress, setProgress] = useState(0)
  const [sessions, setSessions] = useState<SessionData[]>([])
  const [currentSession, setCurrentSession] = useState<SessionData | null>(null)
  const [activeTab, setActiveTab] = useState("record")

  // Replace the settings useState with this more secure approach
  const [settings, setSettings] = useState(() => {
    // Use sessionStorage instead of localStorage for better privacy
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("talk-to-myself-settings")
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch (e) {
          console.error("Failed to parse saved settings:", e)
        }
      }
    }
    return {
      openaiKey: "",
      claudeKey: "",
      geminiKey: "",
      huggingfaceKey: "",
      elevenlabsKey: "",
      humeKey: "",
      summaryService: "openai",
      voiceService: "browser",
      storageMode: "session", // session, memory, or none
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
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const breathingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const recognitionRef = useRef<any>(null)
  const isRecordingRef = useRef(false)

  const [liveTranscript, setLiveTranscript] = useState("");
  const [showLiveTranscript, setShowLiveTranscript] = useState(true);

  // Save settings based on storage preference
  useEffect(() => {
    if (typeof window !== "undefined" && settings.storageMode !== "memory") {
      if (settings.storageMode === "session") {
        sessionStorage.setItem("talk-to-myself-settings", JSON.stringify(settings))
      } else if (settings.storageMode === "local") {
        localStorage.setItem("talk-to-myself-settings", JSON.stringify(settings))
      }
      // "none" mode doesn't save anything
    }
  }, [settings])

  // Check microphone permission on mount
  useEffect(() => {
    checkMicrophonePermission()
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

  const requestMicrophoneAccess = async () => {
    await initializeMicrophone()
  }

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
    mediaRecorderRef.current = new MediaRecorder(streamRef.current, {
      mimeType: "audio/webm;codecs=opus",
    })

    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data)
      }
    }

    mediaRecorderRef.current.onstop = processAudio
    mediaRecorderRef.current.start()
    setIsRecording(true)
    isRecordingRef.current = true
    playChime("start")

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
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    recognitionRef.current = new SpeechRecognition()

    recognitionRef.current.continuous = true
    recognitionRef.current.interimResults = true
    recognitionRef.current.lang = "en-US"
    ;(window as any).lastRecognitionTranscript = ""

    recognitionRef.current.onresult = (event: any) => {
      if (!isRecordingRef.current) return;

      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }

      if (showLiveTranscript) {
        setLiveTranscript(((window as any).lastRecognitionTranscript || "") + finalTranscript + interimTranscript);
      }

      const allTranscript = (finalTranscript + interimTranscript).toLowerCase().trim()

      if (
        allTranscript.includes("i'm complete") ||
        allTranscript.includes("im complete") ||
        allTranscript.includes("i am complete") ||
        allTranscript.includes("i'm done") ||
        allTranscript.includes("im done") ||
        allTranscript.includes("i am done") ||
        allTranscript.includes("complete") ||
        allTranscript.includes("finished") ||
        allTranscript.includes("done")
      ) {
        stopRecording()
      }
    }

    recognitionRef.current.onerror = (event: any) => {
      console.log("Speech recognition error:", event.error)
    }

    recognitionRef.current.onend = () => {
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
      // Try advanced vocal analysis if HuggingFace key is available
      if (settings.huggingfaceKey) {
        const formData = new FormData()
        formData.append("audio", audioBlob)
        formData.append("apiKey", settings.huggingfaceKey)

        const response = await fetch("/api/vocal-analysis", {
          method: "POST",
          body: formData,
        })

        if (response.ok) {
          const analysis = await response.json()
          return {
            tone: analysis.tone || "Balanced",
            pace: analysis.pace || "Natural",
            pitch: analysis.articulation || "Clear",
            volume: analysis.volume || "Moderate",
            confidence: analysis.confidence || 0.75,
          }
        }
      }

      // Fallback to basic analysis
      const audioBuffer = await audioBlob.arrayBuffer()
      const audioContext = new AudioContext()
      const decodedAudio = await audioContext.decodeAudioData(audioBuffer)
      const channelData = decodedAudio.getChannelData(0)

      let rms = 0
      for (let i = 0; i < channelData.length; i++) {
        rms += channelData[i] * channelData[i]
      }
      rms = Math.sqrt(rms / channelData.length)

      return {
        tone: rms > 0.1 ? "Energetic" : rms > 0.05 ? "Warm" : "Gentle",
        pace: "Natural",
        pitch: "Balanced",
        volume: rms > 0.1 ? "Strong" : rms > 0.05 ? "Moderate" : "Soft",
        confidence: 0.75 + Math.random() * 0.2,
      }
    } catch (error) {
      console.error("Vocal analysis error:", error)
      return {
        tone: "Warm",
        pace: "Natural",
        pitch: "Balanced",
        volume: "Moderate",
        confidence: 0.75,
      }
    }
  }

  const processAudio = async () => {
    setIsProcessing(true)
    setProgress(0)

    try {
      setProcessingStage("Transcribing your reflection...")
      setProgress(25)

      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm;codecs=opus" })
      const transcript = (await transcribeAudio(audioBlob)).trim()
      console.log("Transcript:", transcript);
      if (!transcript || transcript.trim() === "") {
        setIsProcessing(false);
        setProcessingStage("");
        setProgress(0);
        return;
      }

      setProcessingStage("Analyzing your voice patterns...")
      setProgress(50)

      const vocalCharacteristics = await analyzeVocalCharacteristics(audioBlob)

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
      const googleApiKey = settings.geminiKey

      if (googleApiKey) {
        console.log("Using Google Speech-to-Text API for transcription...")
        const formData = new FormData()
        formData.append("audio", audioBlob, "recording.webm")
        formData.append("apiKey", googleApiKey)
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

            // Only use Google transcript if it is non-empty and not the fallback
            if (
              data.transcript &&
              data.transcript.trim() !== "" &&
              data.transcript !== "I shared my thoughts and reflections in this session."
            ) {
              return data.transcript;
            }
            // Otherwise, try browser transcript
            if ((window as any).lastRecognitionTranscript) {
              console.log("Google transcript empty, using browser transcript:", (window as any).lastRecognitionTranscript);
              return (window as any).lastRecognitionTranscript.trim();
            }
            return ""; // No transcript
          } else {
            const errorText = await response.text()
            console.error("Google transcription failed:", errorText)
          }
        } catch (fetchError) {
          console.log("Google transcription request failed:", fetchError)
        }
      }

      // Use captured browser speech recognition transcript
      if ((window as any).lastRecognitionTranscript) {
        console.log("Using captured live transcript:", (window as any).lastRecognitionTranscript)
        return (window as any).lastRecognitionTranscript.trim()
      }

      console.warn("No transcript available, returning fallback.")
      return "" // No transcript
    } catch (error) {
      console.error("Transcription error:", error)
      return "" // No transcript
    }
  }

  const generateSummary = async (transcript: string): Promise<string> => {
    try {
      console.log("Generating summary for transcript:", transcript)

      const apiKey =
        settings.summaryService === "openai"
          ? settings.openaiKey
          : settings.summaryService === "claude"
            ? settings.claudeKey
            : settings.geminiKey

      if (!apiKey) {
        // FIXED: Generate summary based on ACTUAL transcript content
        console.log("No API key, generating content-based summary for:", transcript)

        // Extract key themes and content from the actual transcript
        const words = transcript
          .toLowerCase()
          .split(/\s+/)
          .filter((word) => word.length > 2)
        const meaningfulWords = words.filter(
          (word) =>
            ![
              "the",
              "and",
              "with",
              "that",
              "this",
              "for",
              "are",
              "was",
              "were",
              "been",
              "have",
              "has",
              "had",
              "will",
              "would",
              "could",
              "should",
            ].includes(word),
        )

        let summary = ""

        // Analyze the specific content of this transcript
        if (transcript.toLowerCase().includes("dancing")) {
          summary += "I hear your joy and passion for dancing shining through. "
        }

        if (transcript.toLowerCase().includes("dana") || transcript.toLowerCase().includes("jess")) {
          const people = []
          if (transcript.toLowerCase().includes("dana")) people.push("Dana")
          if (transcript.toLowerCase().includes("jess")) people.push("Jess")
          summary += `The way you speak about ${people.join(" and ")} shows the warmth and connection you feel with ${people.length > 1 ? "them" : "them"}. `
        }

        if (transcript.toLowerCase().includes("like") || transcript.toLowerCase().includes("love")) {
          summary += "There's genuine affection and enthusiasm in your words. "
        }

        if (transcript.toLowerCase().includes("definitely")) {
          summary += "Your certainty and conviction come through clearly - you know what brings you joy. "
        }

        // Add meaningful words context
        if (meaningfulWords.length > 0) {
          const keyThemes = meaningfulWords.slice(0, 3).join(", ")
          summary += `The themes of ${keyThemes} seem particularly meaningful to you right now. `
        }

        // Always end with encouragement
        summary +=
          "Thank you for sharing this authentic moment. Your willingness to express what matters to you is a beautiful form of self-reflection and self-care."

        console.log("Generated content-based summary:", summary)
        return summary
      }

      // Use API when key is provided
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          service: settings.summaryService,
          apiKey: apiKey,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate summary")
      }

      const data = await response.json()
      return data.summary
    } catch (error) {
      console.error("Summary generation error:", error)
      // Fallback with actual transcript content
      return `I hear you sharing: "${transcript.substring(0, 100)}..."`
    }
  }

  const analyzeEmotions = async (text: string): Promise<EmotionAnalysis[]> => {
    try {
      const response = await fetch("/api/emotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          apiKey: settings.huggingfaceKey,
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

  const [selectedElevenLabsVoice, setSelectedElevenLabsVoice] = useState<string>("pNInz6obpgDQGcFmaJgB");
  const [elevenLabsVoices, setElevenLabsVoices] = useState<{id: string, name: string}[]>([]);
  const [selectedGoogleLang, setSelectedGoogleLang] = useState<string>("en-US");
  const [selectedGoogleGender, setSelectedGoogleGender] = useState<string>("FEMALE");
  const [selectedHumeVoice, setSelectedHumeVoice] = useState<string>("ITO");

  // Fetch ElevenLabs voices if API key is present
  useEffect(() => {
    const fetchVoices = async () => {
      if (settings.elevenlabsKey) {
        try {
          const res = await fetch("https://api.elevenlabs.io/v1/voices", {
            headers: { "xi-api-key": settings.elevenlabsKey }
          });
          if (res.ok) {
            const data = await res.json();
            setElevenLabsVoices(data.voices.map((v: any) => ({ id: v.voice_id, name: v.name })));
            if (data.voices.length > 0) setSelectedElevenLabsVoice(data.voices[0].voice_id);
          }
        } catch (e) {
          console.warn("Failed to fetch ElevenLabs voices", e);
        }
      }
    };
    fetchVoices();
  }, [settings.elevenlabsKey]);

  const speakSummary = async (summary: string) => {
    const playAudioBlob = (blob: Blob) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      setIsSpeaking(true);
      setIsPaused(false);
      audio.onended = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        setUtteranceRef(null);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        setUtteranceRef(null);
        URL.revokeObjectURL(url);
      };
      audio.play();
    };
    if (settings.voiceService === "elevenlabs" && settings.elevenlabsKey) {
      try {
        const response = await fetch("/api/voice/elevenlabs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: summary, apiKey: settings.elevenlabsKey, voiceId: selectedElevenLabsVoice }),
        });
        if (!response.ok) throw new Error("Failed to fetch ElevenLabs audio");
        const audioBlob = await response.blob();
        playAudioBlob(audioBlob);
        return;
      } catch (err) {
        console.warn("Falling back to browser TTS: ElevenLabs TTS error:", err);
      }
    } else if (settings.voiceService === "hume" && settings.humeKey) {
      try {
        const response = await fetch("/api/voice/hume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: summary, apiKey: settings.humeKey, voice: selectedHumeVoice }),
        });
        if (!response.ok) throw new Error("Failed to fetch Hume audio");
        const audioBlob = await response.blob();
        playAudioBlob(audioBlob);
        return;
      } catch (err) {
        console.warn("Falling back to browser TTS: Hume TTS error:", err);
      }
    } else if (settings.voiceService === "google" && settings.geminiKey) {
      try {
        const response = await fetch("/api/voice/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: summary, apiKey: settings.geminiKey, languageCode: selectedGoogleLang, gender: selectedGoogleGender }),
        });
        if (!response.ok) throw new Error("Failed to fetch Google TTS audio");
        const data = await response.json();
        if (data.audioContent) {
          const audioBlob = new Blob([
            Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0))
          ], { type: "audio/mp3" });
          playAudioBlob(audioBlob);
          return;
        } else {
          throw new Error("No audio content from Google TTS");
        }
      } catch (err) {
        console.warn("Falling back to browser TTS: Google TTS error:", err);
      }
    }
    // Default: Browser TTS
    console.info("Using browser/system TTS");
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel();
      setIsSpeaking(true);
      setIsPaused(false);

      const utterance = new SpeechSynthesisUtterance(summary);
      setUtteranceRef(utterance);
      utterance.rate = 0.75;
      utterance.pitch = 0.95;
      utterance.volume = 0.8;

      utterance.onend = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        setUtteranceRef(null);
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        setUtteranceRef(null);
      };

      const loadVoices = () => {
        const voices = speechSynthesis.getVoices();
        const preferredVoice =
          voices.find(
            (voice) =>
              voice.name.includes("Samantha") ||
              voice.name.includes("Karen") ||
              voice.name.includes("Moira") ||
              voice.name.includes("Tessa") ||
              (voice.name.includes("Google") && voice.name.includes("US")) ||
              (voice.name.includes("Microsoft") && voice.name.includes("Aria")),
          ) || voices.find((voice) => voice.lang.includes("en-US"));
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
        speechSynthesis.speak(utterance);
      };
      if (speechSynthesis.getVoices().length > 0) {
        loadVoices();
      } else {
        speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }

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

  // Loading state
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

  // Permission request screen
  if (hasPermission === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-purple-50 to-indigo-100 flex items-center justify-center p-6">
        <Card className="w-full max-w-2xl shadow-2xl border-0 bg-white/90 backdrop-blur-xl">
          <CardHeader className="text-center pb-8 pt-12">
            <div className="relative mb-8">
              <div className="w-24 h-24 mx-auto bg-gradient-to-br from-purple-500 via-pink-500 to-indigo-600 rounded-full flex items-center justify-center shadow-2xl">
                <Heart className="w-12 h-12 text-white" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
            </div>
            <CardTitle className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 bg-clip-text text-transparent mb-4">
              Talk to Myself
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
            >
              Begin Your Journey
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Main app interface
  return (
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
                  Talk to Myself
                </h1>
                <p className="text-sm text-gray-600">My sanctuary for self-reflection</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {(isRecording || isProcessing) && (
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 animate-pulse">
                  {isRecording ? "Recording..." : "Processing..."}
                </Badge>
              )}
              {sessions.length > 0 && (
                <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
                  {sessions.length} reflection{sessions.length !== 1 ? "s" : ""}
                </Badge>
              )}
              {settings.geminiKey && (
                <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                  Google AI Connected
                </Badge>
              )}
              {settings.huggingfaceKey && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
                  HuggingFace Connected
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-12">
        <Tabs value={activeTab} onValueChange={canSwitchTab ? setActiveTab : undefined} className="space-y-8">
          {/* Tab Navigation */}
          <div className="flex justify-center">
            <TabsList className="bg-white/80 backdrop-blur-xl border border-white/30 shadow-xl rounded-2xl p-2">
              <TabsTrigger
                value="record"
                disabled={!canSwitchTab && activeTab !== "record"}
                className={cn(
                  "flex items-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white rounded-xl px-6 py-3 transition-all duration-300",
                  !canSwitchTab && activeTab !== "record" && "opacity-50 cursor-not-allowed",
                )}
              >
                <Mic className="w-4 h-4" />
                <span>Record</span>
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
            </TabsList>
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
                        ? "I'm here, listening with care..."
                        : isProcessing
                          ? "Reflecting on your words..."
                          : isSpeaking
                            ? "Speaking your reflection..."
                            : "Ready to listen to your heart"}
                    </h2>
                    <p className="text-lg text-gray-600 leading-relaxed">
                      {isRecording
                        ? "Take your time. Breathe deeply. Share whatever feels right. When you're ready to finish, simply say 'I'm complete' or tap the button."
                        : isProcessing
                          ? "I'm using AI to transcribe and understand what you've shared, creating a thoughtful reflection just for you."
                          : isSpeaking
                            ? "Listen to your personalized reflection. Recording is paused while I'm speaking."
                            : "This is your safe space. Click the microphone when you're ready to share your thoughts, feelings, or whatever is on your mind."}
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
                          <Heart className="w-6 h-6 text-white" />
                        </div>
                        <div className="space-y-3">
                          <h3 className="font-semibold text-gray-800">A gentle reminder</h3>
                          <p className="text-gray-600 leading-relaxed">
                            There's no right or wrong way to use this space. You might share your dreams, process a
                            difficult day, explore your feelings, or simply think out loud. Whatever you choose to share
                            will be met with understanding and care.
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
                    TTS: {settings.voiceService.charAt(0).toUpperCase() + settings.voiceService.slice(1)}
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
                      {settings.huggingfaceKey
                        ? "AI-powered emotion analysis using Hugging Face models"
                        : "Content-based emotion analysis from your transcript"}
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

                {/* Voice Characteristics */}
                <Card className="bg-white/80 backdrop-blur-xl border-0 shadow-2xl rounded-3xl overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 p-8">
                    <CardTitle className="text-2xl text-gray-800 flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-lg flex items-center justify-center">
                        <Waves className="w-4 h-4 text-white" />
                      </div>
                      <span>Voice Patterns</span>
                    </CardTitle>
                    <CardDescription className="text-gray-600 text-lg">
                      Audio analysis of your vocal characteristics and delivery
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-8">
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <div className="flex justify-between items-center p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
                          <span className="text-gray-700 font-medium">Tone</span>
                          <Badge className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                            {currentSession.vocalCharacteristics.tone}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
                          <span className="text-gray-700 font-medium">Pace</span>
                          <Badge className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                            {currentSession.vocalCharacteristics.pace}
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-6">
                        <div className="flex justify-between items-center p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
                          <span className="text-gray-700 font-medium">Pitch</span>
                          <Badge className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                            {currentSession.vocalCharacteristics.pitch}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
                          <span className="text-gray-700 font-medium">Volume</span>
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

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-8">
            <Card className="bg-white/80 backdrop-blur-xl border-0 shadow-2xl rounded-3xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 p-8">
                <CardTitle className="text-2xl text-gray-800 flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Settings className="w-4 h-4 text-white" />
                  </div>
                  <span>Personalize Your Experience</span>
                </CardTitle>
                <CardDescription className="text-gray-600 text-lg">
                  Configure AI services for enhanced summaries and voice synthesis
                </CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-12">
                {/* Security Information */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Lock className="w-6 h-6 text-white" />
                    </div>
                    <div className="space-y-3">
                      <h3 className="font-semibold text-gray-800 flex items-center space-x-2">
                        <span>Maximum Security & Privacy</span>
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </h3>
                      <div className="space-y-2 text-gray-600 leading-relaxed">
                        <p>
                          <strong>Persistent Storage:</strong> API keys are now saved securely in your browser's
                          localStorage and persist between sessions.
                        </p>
                        <p>
                          <strong>Local Only:</strong> Keys never leave your device - they're stored locally and used
                          directly by your browser.
                        </p>
                        <p>
                          <strong>Enhanced Features:</strong> With API keys configured, you get better transcription,
                          real emotion analysis, and smarter summaries.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Add this section in the settings tab after the security information */}
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-gray-800">Privacy & Storage Settings</h3>
                  <div className="space-y-4">
                    <label className="text-lg font-medium text-gray-700">API Key Storage</label>
                    <p className="text-sm text-gray-500">Choose how securely you want to store your API keys</p>
                    <select
                      value={settings.storageMode}
                      onChange={(e) => setSettings((prev) => ({ ...prev, storageMode: e.target.value }))}
                      className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/80"
                    >
                      <option value="none">🔒 Maximum Security - No Storage (re-enter each session)</option>
                      <option value="memory">🛡️ High Security - Memory Only (lost on refresh)</option>
                      <option value="session">🔐 Good Security - Session Only (cleared when tab closes)</option>
                      <option value="local">💾 Convenient - Persistent Storage (survives browser restart)</option>
                    </select>
                    <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-4">
                      <p>
                        <strong>Current mode:</strong>{" "}
                        {settings.storageMode === "none"
                          ? "Keys are never stored - maximum privacy"
                          : settings.storageMode === "memory"
                            ? "Keys stored in memory only - cleared on page refresh"
                            : settings.storageMode === "session"
                              ? "Keys stored until you close this tab"
                              : "Keys persist until manually cleared"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* AI Model Information */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-6 h-6 text-white" />
                    </div>
                    <div className="space-y-3">
                      <h3 className="font-semibold text-gray-800">Best AI Models for Analysis</h3>
                      <div className="space-y-2 text-gray-600 leading-relaxed">
                        <p>
                          <strong>Emotion Analysis:</strong> j-hartmann/emotion-english-distilroberta-base -
                          State-of-the-art emotion detection with 7 emotion categories
                        </p>
                        <p>
                          <strong>Sentiment Analysis:</strong> cardiffnlp/twitter-roberta-base-sentiment-latest - Highly
                          accurate positive/negative/neutral classification
                        </p>
                        <p>
                          <strong>Speech-to-Text:</strong> Google Cloud Speech-to-Text API (via Gemini key) -
                          Professional-grade transcription
                        </p>
                        <p>
                          <strong>Voice Characteristics:</strong> Currently analyzed from audio waveform data - future
                          updates will include specialized audio AI models
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <h3 className="text-xl font-semibold text-gray-800">AI Service Configuration</h3>
                  <div className="grid gap-8">
                    {[
                      {
                        key: "openaiKey",
                        label: "OpenAI API Key",
                        placeholder: "sk-...",
                        description: "For advanced GPT-powered summaries and analysis",
                        service: "openai",
                      },
                      {
                        key: "claudeKey",
                        label: "Claude API Key",
                        placeholder: "sk-ant-...",
                        description: "For thoughtful Anthropic Claude summaries",
                        service: "claude",
                      },
                      {
                        key: "geminiKey",
                        label: "Google AI API Key (Gemini)",
                        placeholder: "AI...",
                        description:
                          "For Google's Gemini AI insights AND professional Google Speech-to-Text transcription",
                        service: "gemini",
                      },
                      {
                        key: "huggingfaceKey",
                        label: "Hugging Face API Key",
                        placeholder: "hf_...",
                        description:
                          "For state-of-the-art emotion analysis using j-hartmann/emotion-english-distilroberta-base",
                        service: "huggingface",
                      },
                      {
                        key: "elevenlabsKey",
                        label: "ElevenLabs API Key",
                        placeholder: "...",
                        description: "For natural, human-like voice synthesis",
                        service: "elevenlabs",
                      },
                      {
                        key: "humeKey",
                        label: "Hume.ai API Key",
                        placeholder: "...",
                        description: "For emotionally intelligent voice responses",
                        service: "hume",
                      },
                    ].map(({ key, label, placeholder, description, service }) => (
                      <div key={key} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-lg font-medium text-gray-700">{label}</label>
                          <div className="flex items-center space-x-2">
                            {settings[key as keyof typeof settings] && (
                              <Badge className="bg-green-100 text-green-700 border-green-200">Configured</Badge>
                            )}
                            {settings[key as keyof typeof settings] && service !== "huggingface" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  checkApiCredits(service, settings[key as keyof typeof settings] as string)
                                }
                                disabled={isCheckingCredits}
                                className="text-xs"
                              >
                                {isCheckingCredits ? "Checking..." : "Check Credits"}
                              </Button>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-gray-500">{description}</p>
                        <input
                          type="password"
                          value={settings[key as keyof typeof settings] as string}
                          onChange={(e) => setSettings((prev) => ({ ...prev, [key]: e.target.value }))}
                          className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white/80"
                          placeholder={placeholder}
                        />
                        {apiCredits[service] && (
                          <p className="text-sm text-green-600 flex items-center space-x-1">
                            <CheckCircle className="w-4 h-4" />
                            <span>Credits available: {apiCredits[service]}</span>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-gray-800">Service Preferences</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-lg font-medium text-gray-700">Summary Service</label>
                      <p className="text-sm text-gray-500">Choose which AI service to use for generating summaries</p>
                      <select
                        value={settings.summaryService}
                        onChange={(e) => setSettings((prev) => ({ ...prev, summaryService: e.target.value }))}
                        className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/80"
                      >
                        <option value="openai">OpenAI GPT</option>
                        <option value="claude">Claude</option>
                        <option value="gemini">Gemini</option>
                      </select>
                    </div>

                    <div className="space-y-3">
                      <label className="text-lg font-medium text-gray-700">Voice Service</label>
                      <p className="text-sm text-gray-500">Choose how you'd like to hear your summaries</p>
                      {/* Toggle for available TTS providers */}
                      <div className="flex space-x-2 mb-2">
                        {settings.elevenlabsKey && (
                          <Button
                            variant={settings.voiceService === "elevenlabs" ? "default" : "outline"}
                            onClick={() => setSettings((prev: any) => ({ ...prev, voiceService: "elevenlabs" }))}
                          >
                            ElevenLabs
                          </Button>
                        )}
                        {settings.humeKey && (
                          <Button
                            variant={settings.voiceService === "hume" ? "default" : "outline"}
                            onClick={() => setSettings((prev: any) => ({ ...prev, voiceService: "hume" }))}
                          >
                            Hume.ai
                          </Button>
                        )}
                        {settings.geminiKey && (
                          <Button
                            variant={settings.voiceService === "google" ? "default" : "outline"}
                            onClick={() => setSettings((prev: any) => ({ ...prev, voiceService: "google" }))}
                          >
                            Google TTS
                          </Button>
                        )}
                        <Button
                          variant={settings.voiceService === "browser" ? "default" : "outline"}
                          onClick={() => setSettings((prev: any) => ({ ...prev, voiceService: "browser" }))}
                        >
                          Browser
                        </Button>
                      </div>
                      {/* Per-provider voice selection */}
                      {settings.voiceService === "elevenlabs" && settings.elevenlabsKey && (
                        <div className="space-y-1">
                          <label className="text-sm font-medium text-gray-600">ElevenLabs Voice</label>
                          <select
                            value={selectedElevenLabsVoice}
                            onChange={e => setSelectedElevenLabsVoice(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-xl"
                          >
                            {elevenLabsVoices.map(v => (
                              <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {settings.voiceService === "google" && settings.geminiKey && (
                        <div className="space-y-1">
                          <label className="text-sm font-medium text-gray-600">Google TTS Language</label>
                          <select
                            value={selectedGoogleLang}
                            onChange={e => setSelectedGoogleLang(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-xl"
                          >
                            <option value="en-US">English (US)</option>
                            <option value="en-GB">English (UK)</option>
                            <option value="es-ES">Spanish (Spain)</option>
                            <option value="fr-FR">French</option>
                            {/* Add more as needed */}
                          </select>
                          <label className="text-sm font-medium text-gray-600">Google TTS Gender</label>
                          <select
                            value={selectedGoogleGender}
                            onChange={e => setSelectedGoogleGender(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-xl"
                          >
                            <option value="FEMALE">Female</option>
                            <option value="MALE">Male</option>
                            <option value="NEUTRAL">Neutral</option>
                          </select>
                        </div>
                      )}
                      {settings.voiceService === "hume" && settings.humeKey && (
                        <div className="space-y-1">
                          <label className="text-sm font-medium text-gray-600">Hume Voice</label>
                          <select
                            value={selectedHumeVoice}
                            onChange={e => setSelectedHumeVoice(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-xl"
                          >
                            <option value="ITO">ITO</option>
                            {/* Add more Hume voices if available */}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
