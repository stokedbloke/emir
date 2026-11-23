"use client"

// Add this at the top for TypeScript to recognize process.env in Next.js
// @ts-ignore
declare var process: {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: string; // Public: Supabase project URL for browser
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string; // Public: Supabase anon key for browser
    NODE_ENV?: string; // Node environment (development, production, test)
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
  Info,
  // 🗑️ DEAD CODE: These icons are imported but never used in the UI - can be removed
  CheckCircle,
  Lock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { v4 as uuidv4 } from 'uuid';

import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { VocalCharacteristics, EmotionAnalysis, SessionData, GlobalSettings, TranscriptionInfo } from "@/types";

// Vercel refuses uploads over 4.5 MB, so larger recordings keep the browser transcript.
const PROCESSING_MS_KEY = "em-processing-ms";
const SERVER_TRANSCRIPT_MAX_BYTES = 4 * 1024 * 1024;
// How long to wait for the server transcript before using the browser's: a
// base wait plus a little per second of recording, up to a ceiling.
const SERVER_TRANSCRIPT_BASE_WAIT_MS = 6000;
const SERVER_TRANSCRIPT_WAIT_PER_SECOND_MS = 50;
const SERVER_TRANSCRIPT_MAX_WAIT_MS = 12000;
import { API_ENDPOINTS, AUDIO_CONSTANTS, UI_CONSTANTS, DEFAULT_VALUES, SPEECH_TRIGGERS } from "@/constants";
import { calculateWordCount, formatTime, getDeviceInfo, getBrowserInfo, playChime } from "@/utils";
import { LoadingStates } from "@/components/LoadingStates";
import { BackgroundElements } from "@/components/BackgroundElements";
import { AppHeader } from "@/components/AppHeader";
import { useSettings } from "@/hooks/useSettings";
import { useAccount } from "@/hooks/useAccount";
import { AccountPanel } from "@/components/AccountPanel";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { JournalPrompt } from "@/components/JournalPrompt";
import { PromptManager } from "@/components/PromptManager";
import { useServiceStatus } from "@/hooks/useServiceStatus";




// Add browser detection utilities at the top of the component:
// 🗑️ DEAD CODE: These browser detection variables are defined but never used - can be removed
const isSafari = typeof window !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
const isFirefox = typeof window !== 'undefined' && navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

export default function TalkToMyself() {
  // Mobile-aware debug helper to reduce logging overhead on mobile devices
  const isMobileUA = typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const debug = isMobileUA ? (..._args: unknown[]) => { } : console.debug;

  // Track if component is mounted to prevent state updates after unmount
  const isMounted = useRef(true);

  // All hooks must be declared here, before any return statement
  const [hasPermission, setHasPermission] = useState<boolean | null>(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  // Sent with voice requests so the server lets the admin list and play every voice.
  const adminHeaders = (): Record<string, string> => {
    const secret = isAdmin ? sessionStorage.getItem(DEFAULT_VALUES.ADMIN_SECRET_KEY) : null
    return secret ? { "x-admin-secret": secret } : {}
  }
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
  // Words heard in the current phrase that the browser has not confirmed yet.
  const pendingRecognitionRef = useRef("");
  // How the latest recording was transcribed, saved with the reflection so the
  // server and browser transcripts can be compared.
  const transcriptionInfoRef = useRef<TranscriptionInfo | null>(null);
  const [actualTTSService, setActualTTSService] = useState<string>("browser");
  // Identity: a silent anonymous session, with an optional email and password.
  const { userId, email: accountEmail, accountsAvailable, authHeaders, signUp, signIn, signOut } = useAccount();
  // The sign-in / create-account form, shown over whatever screen is open.
  const [accountForm, setAccountForm] = useState<"signin" | "signup" | null>(null);

  const handleSignOut = async () => {
    await signOut();
    toast({ title: "Signed out", description: "Your reflections stay in your account. This browser now starts fresh." });
  };

  // Sessions state management - reverted from useSessions hook for simplicity
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [currentSession, setCurrentSession] = useState<SessionData | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const followUpParentRef = useRef<{ threadId: string; parentSessionId: string } | null>(null);
  const recordingThreadContextRef = useRef<{ threadId?: string; parentSessionId?: string } | null>(null);

  // Fetch reflections from API route for the current user
  const fetchReflections = async (userId: string) => {
    if (!userId) return [];
    try {
      console.log("Fetching reflections for user:", userId);
      const res = await fetch(API_ENDPOINTS.REFLECTION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
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
      const reflectionRows = data.reflections || [];
      const persistedIds = new Set(reflectionRows.map((row: any) => String(row.id)));
      const mappedSessions = reflectionRows.map((row: any) => {
        console.log("Mapping row:", row);
        const deviceInfo = typeof row.device_info === "string"
          ? JSON.parse(row.device_info)
          : (row.device_info || {});
        const persistedParentId = deviceInfo.parent_session_id;
        const parentSessionId = persistedParentId && persistedIds.has(String(persistedParentId))
          ? String(persistedParentId)
          : undefined;
        const threadId = deviceInfo.thread_id ? String(deviceInfo.thread_id) : String(row.id);
        return {
          id: String(row.id),
          timestamp: new Date(row.created_at),
          transcript: row.transcript,
          summary: row.summary,
          emotions: row.emotions || [],
          vocalCharacteristics: row.vocal || {},
          audioBlob: undefined, // Not stored in DB
          transcription: deviceInfo.transcription || undefined,
          threadId,
  parentSessionId,
  recordingDuration: (() => {
            // New format: duration stored in device_info.recording_duration_seconds
            if (deviceInfo.recording_duration_seconds) {
              return deviceInfo.recording_duration_seconds;
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

  // Save reflection to Supabase. Resolves once the server confirms the save;
  // throws after three failed attempts (or at once when the server rejects it).
  const saveReflectionToSupabase = async (reflection: any) => {
    let lastError: Error = new Error("Failed to save reflection");
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(API_ENDPOINTS.REFLECTION, {
          signal: AbortSignal.timeout(UI_CONSTANTS.API_TIMEOUT_MS),
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
          body: JSON.stringify(reflection),
        });
        if (res.ok) return;
        const responseData = await res.json().catch(() => ({}));
        lastError = new Error(responseData.error || `Reflection save failed (${res.status})`);
        // The server refused this reflection; sending it again will not help.
        if (res.status >= 400 && res.status < 500) break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error("Failed to save reflection");
      }
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 1500));
    }
    console.error("Error saving reflection after retries:", lastError);
    throw lastError;
  };

  // Reflections the server has not confirmed yet. They are kept in this
  // browser's storage (the source of truth, so reloads don't lose them) and
  // mirrored into state for display.
  const [pendingReflections, setPendingReflections] = useState<any[]>([]);
  const [savingIds, setSavingIds] = useState<string[]>([]);
  // Reflection whose emotion analysis is still running.
  const [analyzingEmotionsId, setAnalyzingEmotionsId] = useState<string | null>(null);
  const savingIdsRef = useRef(new Set<string>());
  const pendingStorageKey = (uid: string) => `em-pending-reflections-${uid}`;

  const readPendingReflections = (uid: string): any[] => {
    try {
      const list = JSON.parse(localStorage.getItem(pendingStorageKey(uid)) || "[]");
      return Array.isArray(list) ? list.filter((item) => item && item.id) : [];
    } catch {
      return [];
    }
  };

  const updatePendingReflections = (uid: string, change: (list: any[]) => any[]) => {
    const next = change(readPendingReflections(uid));
    try {
      if (next.length > 0) localStorage.setItem(pendingStorageKey(uid), JSON.stringify(next));
      else localStorage.removeItem(pendingStorageKey(uid));
    } catch (error) {
      console.error("Could not store the unsaved reflection on this device:", error);
    }
    setPendingReflections(next);
  };

  const pendingToSession = (reflection: any): SessionData => ({
    id: String(reflection.id),
    timestamp: new Date(reflection.created_at || Date.now()),
    transcript: reflection.transcript,
    summary: reflection.summary,
    emotions: reflection.emotions || [],
    vocalCharacteristics: reflection.vocal || {},
    recordingDuration: reflection.recording_duration || 0,
    threadId: reflection.device_info?.thread_id ? String(reflection.device_info.thread_id) : String(reflection.id),
    parentSessionId: reflection.device_info?.parent_session_id,
    transcription: reflection.device_info?.transcription,
  });

  // Queue the reflection on this device, then save it. It leaves the queue only
  // when the server confirms, so a failed save can always be retried.
  const persistReflection = async (reflection: any): Promise<boolean> => {
    const uid = reflection.userId;
    updatePendingReflections(uid, (list) => [...list.filter((item) => item.id !== reflection.id), reflection]);
    savingIdsRef.current.add(reflection.id);
    setSavingIds(Array.from(savingIdsRef.current));
    try {
      await saveReflectionToSupabase(reflection);
      updatePendingReflections(uid, (list) => list.filter((item) => item.id !== reflection.id));
      return true;
    } catch {
      return false;
    } finally {
      savingIdsRef.current.delete(reflection.id);
      setSavingIds(Array.from(savingIdsRef.current));
    }
  };

  // Try every queued reflection again, oldest first so a follow-up is sent
  // after the reflection it follows. Returns how many are still unsaved.
  const retryPendingReflections = async (uid: string): Promise<number> => {
    const queued = readPendingReflections(uid)
      .filter((item) => !savingIdsRef.current.has(item.id))
      .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
    for (const reflection of queued) {
      await persistReflection(reflection);
    }
    return readPendingReflections(uid).length;
  };

  // 🗑️ DEAD CODE: This counts speech errors but the count isn't displayed - could be simplified to just show/hide the error message
  // Removed speechErrorCount - no longer penalizing natural speech pauses
  const [speechRecognitionError, setSpeechRecognitionError] = useState<string | null>(null);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  // Removed MAX_SPEECH_ERRORS - no longer penalizing natural speech pauses
  // 🗑️ DEAD CODE: These voice selection variables are set but never used for actual voice selection - can be removed
  const [selectedElevenLabsVoice, setSelectedElevenLabsVoice] = useState<string>("");
  const [elevenLabsVoices, setElevenLabsVoices] = useState<{ id: string, name: string, category?: string }[]>([]);
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
  const [processingSecondsLeft, setProcessingSecondsLeft] = useState<number | null>(null);
  const processingStartedRef = useRef(0);
  const appliedVoiceRef = useRef<string | null>(null);

  // While a reflection is being processed, move the bar steadily and say
  // roughly how long is left, going by how long the last one took here.
  useEffect(() => {
    if (!isProcessing) { setProcessingSecondsLeft(null); return; }
    const started = Date.now();
    processingStartedRef.current = started;
    const last = Number(localStorage.getItem(PROCESSING_MS_KEY));
    const estimate = Math.min(30000, Math.max(4000, last > 0 ? last : 10000));
    const tick = () => {
      const elapsed = Date.now() - started;
      // Reaches about 85% at the estimate and keeps creeping after it.
      const shown = 95 * (1 - Math.exp(-elapsed / (estimate / 2)));
      setProgress((current) => (current >= 100 ? current : Math.max(current, shown)));
      setProcessingSecondsLeft(Math.ceil((estimate - elapsed) / 1000));
    };
    setProgress(0);
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [isProcessing]);
  const [processingError, setProcessingError] = useState<string | null>(null);
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

  // Signing out starts this browser afresh, so clear what was on screen.
  // Signing in does not: this browser's reflections move into the account, so
  // the open reflection and the current tab stay as they are.
  const previousUserIdRef = useRef("");
  useEffect(() => {
    if (previousUserIdRef.current && previousUserIdRef.current !== userId && !accountEmail) {
      setSessions([]);
      setCurrentSession(null);
      setActiveTab("record");
    }
    previousUserIdRef.current = userId;
  }, [userId, accountEmail]);

  // Recover reflections whose server save failed: show them in the history and
  // try saving again now, and whenever the connection comes back.
  useEffect(() => {
    if (!userId) return;
    try {
      // Earlier versions kept a single unsaved reflection under this key.
      const legacyKey = `em-pending-reflection-${userId}`;
      const legacy = localStorage.getItem(legacyKey);
      if (legacy) {
        const reflection = JSON.parse(legacy);
        if (reflection?.id) {
          updatePendingReflections(userId, (list) => list.some((item) => item.id === reflection.id) ? list : [...list, reflection]);
        }
        localStorage.removeItem(legacyKey);
      }
    } catch (error) {
      console.error("Failed to load pending reflection:", error);
    }
    const queued = readPendingReflections(userId);
    setPendingReflections(queued);
    if (queued.length > 0) {
      setSessions((prev) => {
        const known = new Set(prev.map((session) => session.id));
        return [...queued.filter((item) => !known.has(String(item.id))).map(pendingToSession), ...prev];
      });
      retryPendingReflections(userId);
    }
    const onOnline = () => { retryPendingReflections(userId); };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [userId]);

  // The voice clone belongs to the person, not the browser. Start from what
  // this browser remembers, then ask the server which clone this history owns,
  // so a clone made on another device (or before signing in) is found here too.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const cloneKey = `${DEFAULT_VALUES.USER_VOICE_CLONE_PREFIX}${userId}`;
    const choiceKey = `em-elevenlabs-voice-${userId}`;
    const remembered = localStorage.getItem(cloneKey);
    setUserVoiceCloneId(remembered);
    setHasVoiceClone(Boolean(remembered));
    if (remembered) setSelectedElevenLabsVoice(remembered);

    (async () => {
      try {
        const response = await fetch(API_ENDPOINTS.VOICE_CLONE_MINE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
          body: JSON.stringify({ userId }),
        });
        // If the server cannot say, keep what this browser remembers.
        if (!response.ok || cancelled) return;
        const { voiceId } = await response.json();
        if (cancelled || voiceId === remembered) return;
        if (typeof voiceId === 'string' && voiceId) {
          localStorage.setItem(cloneKey, voiceId);
          // Keep a deliberate choice of another voice; otherwise use the clone.
          const choice = localStorage.getItem(choiceKey);
          if (choice === null || choice === remembered) localStorage.setItem(choiceKey, voiceId);
          setUserVoiceCloneId(voiceId);
          setHasVoiceClone(true);
        } else {
          // The remembered clone no longer exists.
          localStorage.removeItem(cloneKey);
          if (localStorage.getItem(choiceKey) === remembered) localStorage.removeItem(choiceKey);
          setUserVoiceCloneId(null);
          setHasVoiceClone(false);
        }
      } catch (error) {
        console.warn('Could not check for a voice clone:', error);
      }
    })();
    return () => { cancelled = true; };
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
      // Keep reflections that exist only on this device (not saved yet).
      fetchReflections(userId).then((rows: SessionData[]) => setSessions((prev) => {
        const saved = new Set(rows.map((row) => row.id));
        // The recording itself is never stored on the server. Keep the copy in
        // memory, so Clone Voice still works after signing up or signing in.
        const audio = new Map(prev.filter((session) => session.audioBlob).map((session) => [session.id, session.audioBlob]));
        return [
          ...prev.filter((session) => !saved.has(session.id)),
          ...rows.map((row) => audio.has(row.id) ? { ...row, audioBlob: audio.get(row.id) } : row),
        ];
      }));
    }
  }, [userId]);

  // Check if user is admin (for development/testing)
  useEffect(() => {
    // The admin secret is typed into the URL (?admin=...) and verified by the server.
    // It is never compiled into the client bundle.
    const urlParams = new URLSearchParams(window.location.search)
    const candidate = urlParams.get("admin") || sessionStorage.getItem(DEFAULT_VALUES.ADMIN_SECRET_KEY)
    if (!candidate) return
    fetch(API_ENDPOINTS.GLOBAL_SETTINGS, { method: "POST", headers: { "x-admin-secret": candidate } })
      .then((res) => {
        if (res.ok) {
          sessionStorage.setItem(DEFAULT_VALUES.ADMIN_SECRET_KEY, candidate)
          setIsAdmin(true)
        } else {
          sessionStorage.removeItem(DEFAULT_VALUES.ADMIN_SECRET_KEY)
        }
      })
      .catch(() => {})
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

  // === LIFECYCLE CLEANUP HOOKS ===
  // Clean up resources when component unmounts or tab is hidden (only when not recording)
  // IMPORTANT: This must be declared before any conditional returns to comply with Rules of Hooks
  useEffect(() => {
    const onHide = () => {
      if (!isRecordingRef.current) {
        cleanupAudioResources();
      }
    };

    const events = [
      { target: document, type: 'visibilitychange', handler: onHide },
      { target: window, type: 'pagehide', handler: onHide },
      { target: window, type: 'beforeunload', handler: onHide }
    ];

    events.forEach(({ target, type, handler }) =>
      target.addEventListener(type, handler as EventListener)
    );

    return () => {
      isMounted.current = false;
      events.forEach(({ target, type, handler }) =>
        target.removeEventListener(type, handler as EventListener)
      );
      // Final cleanup when unmounting, only if not actively recording
      if (!isRecordingRef.current) {
        cleanupAudioResources();
      }
      // Clear breathing timer if active
      if (breathingTimerRef.current) {
        clearInterval(breathingTimerRef.current);
      }
    };
  }, []);

  // Prevent tab switching during recording or processing
  const canSwitchTab = !isRecording && !isProcessing && !isSpeaking

  // Handle tab changes and reset audio state when switching to record tab
  const handleTabChange = (newTab: string) => {
    if (canSwitchTab) {
      setActiveTab(newTab);
      // Reset audio ready state when switching to record tab
      if (newTab === "record") {
        setIsAudioReady(false);
      }
    }
  };


  // === MICROPHONE & AUDIO RESOURCE MANAGEMENT ===
  // Lightweight helper to release mic stream (used in hot path during stop)
  const releaseMicrophone = () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track, i) => {
          try {
            track.stop();
            debug(`Stopped track ${i} (${track.kind})`);
          } catch (e) {
            console.warn(`Error stopping track ${i}:`, e);
          }
        });
        streamRef.current = null;
      }
    } catch (e) {
      console.error("Critical error in releaseMicrophone:", e);
      // In development, throw to catch issues early
      if (process.env.NODE_ENV === 'development') throw e;
    }
  };

  // Full resource cleanup (mic + audio context + chunks + recognition)
  // Used on unmount, visibility hide (when idle), and after processing
  const cleanupAudioResources = () => {
    releaseMicrophone();

    // Close audio context if it exists
    if (audioContextRef.current) {
      try {
        if (audioContextRef.current.state !== "closed") {
          audioContextRef.current.close().catch(console.warn);
        }
      } catch (e) {
        console.warn("Error closing audio context:", e);
      }
      audioContextRef.current = null;
    }

    // Clear audio chunks to free memory
    audioChunksRef.current = [];

    // Stop recognition and clear handlers defensively
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
      } catch (e) {
        console.warn("Error stopping recognition:", e);
      } finally {
        recognitionRef.current = null;
      }
    }
  };

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
      // Release any existing stream before acquiring a new one to avoid parallel streams
      if (streamRef.current) {
        releaseMicrophone();
      }

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

  const requestMicrophoneAccess = async () => {
    console.log("requestMicrophoneAccess called, current hasPermission:", hasPermission);
    setIsRequestingMic(true);
    setMicrophoneError(null);

    try {
      await initializeMicrophone();
    } catch (error) {
      console.error("Microphone request failed:", error);
      setMicrophoneError("Microphone access was unavailable. Please check your browser permissions and try again.");
    } finally {
      setIsRequestingMic(false);
    }
  };



  const startRecording = async (mode: "new" | "follow-up" = "new") => {
  if (mode === "new") {
  followUpParentRef.current = null;
  recordingThreadContextRef.current = null;
  setActiveThreadId(null);
  } else {
  const selectedParent = followUpParentRef.current;
  const parentExists = selectedParent?.parentSessionId
    ? sessions.some((session) => session.id === selectedParent.parentSessionId)
    : false;
  if (!selectedParent?.threadId || !selectedParent.parentSessionId || !parentExists) {
    toast({
      title: "Choose a reflection first",
      description: "Select the reflection this follow-up responds to before recording.",
      variant: "destructive",
    });
    return;
  }
  recordingThreadContextRef.current = selectedParent;
  }
  if (isSpeaking) return;
  
    // Re-acquire stream if it was released (e.g., after previous stop or cleanup)
    if (!streamRef.current) {
      try {
        await initializeMicrophone();
      } catch (e) {
        console.error("Failed to re-initialize microphone:", e);
      }
      if (!streamRef.current) {
        toast({
          title: "Microphone unavailable",
          description: "Couldn't access the microphone. Please grant permission and try again.",
          variant: "destructive",
        });
        return;
      }
    }

    if (!globalSettings) {
      toast({
        title: "Settings not loaded",
        description: "Please wait for settings to load before recording.",
        variant: "destructive",
      });
      return
    }

    // Reset light UI state for smooth transition
    setIsAudioReady(false);
    setIsSpeaking(false);
    setProcessingError(null);
    setProcessingStage("");
    setProgress(0);

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
      pendingRecognitionRef.current = "";

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
    if (!isRecordingRef.current) {
      // Not actively recording — still ensure resources are not lingering
      releaseMicrophone();
      return;
    }

    try {
      mediaRecorderRef.current?.stop();
      mediaRecorderRef.current = null;
    } catch (e) {
      console.warn("Error stopping MediaRecorder:", e);
    }

    try {
      recognitionRef.current?.stop();
    } catch (e) {
      console.warn("Error stopping recognition:", e);
    }

    playChime("stop");
    isRecordingRef.current = false;
    setIsRecording(false);
    setIsProcessing(true); // Set processing state immediately to prevent UI flash
    setLiveTranscript("");

    // Release mic ASAP so iOS clears system "in-call/mic-in-use" state
    // Note: processAudio will be called by MediaRecorder's onstop handler
    releaseMicrophone();
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
      ; (window as any).lastRecognitionTranscript = ""

    recognitionRef.current.onresult = (event: any) => {
      setSpeechRecognitionError(null);
      if (!isRecordingRef.current) return;

      // Confirmed phrases are added once. Everything not confirmed yet is kept
      // aside: the browser only confirms a phrase at a pause, so the words just
      // before "I'm complete" are usually still unconfirmed when recording stops.
      let interimTranscript = "";
      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          if (i >= event.resultIndex) fullRecognitionTranscriptRef.current += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }
      pendingRecognitionRef.current = interimTranscript;

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
      } else if (event.error === "aborted") {
        // The browser ended this listening session itself (for example when
        // recording stops, or another tab takes the microphone). Not a fault:
        // listening restarts on its own while a recording is still running.
        console.log("Speech recognition aborted (ignored)");
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
      // The browser restarts recognition now and then. Keep any words it had
      // heard but not confirmed, or they vanish with the old session.
      if (pendingRecognitionRef.current.trim()) {
        fullRecognitionTranscriptRef.current += pendingRecognitionRef.current.trim() + " ";
        pendingRecognitionRef.current = "";
      }
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

  // Measures pauses, level, brightness and pitch in the recording. Loudness is judged relative to this
  // recording's own level, so a quiet microphone does not read as silence.
  const analyzeVoice = async (audioBlob: Blob): Promise<{ durationSeconds: number; pauseRatio: number; longestPauseSeconds: number; levelDb: number; brightnessHz: number; pitchHz?: number; pitchVariationSemitones?: number } | null> => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const decodedAudio = await audioContext.decodeAudioData(await audioBlob.arrayBuffer());
      await audioContext.close();
      const channelData = decodedAudio.getChannelData(0);
      const frameSeconds = 0.05;
      const frameSize = Math.max(1, Math.round(decodedAudio.sampleRate * frameSeconds));
      const levels: number[] = [];
      for (let start = 0; start + frameSize <= channelData.length; start += frameSize) {
        let sum = 0;
        for (let i = start; i < start + frameSize; i++) sum += channelData[i] * channelData[i];
        levels.push(Math.sqrt(sum / frameSize));
      }
      if (levels.length < 20) return null;
      const sorted = [...levels].sort((x, y) => x - y);
      const loud = sorted[Math.floor(sorted.length * 0.95)];
      if (loud < 0.002) return null; // effectively silent recording
      const threshold = loud * 0.12;
      const first = levels.findIndex((level) => level >= threshold);
      let last = levels.length - 1;
      while (last > first && levels[last] < threshold) last--;
      // Count only pauses inside the speech, of half a second or more;
      // shorter gaps are ordinary breaks between words.
      const minPauseFrames = Math.round(0.5 / frameSeconds);
      let pauseFrames = 0;
      let longest = 0;
      let run = 0;
      for (let i = first; i <= last + 1; i++) {
        if (i <= last && levels[i] < threshold) {
          run++;
        } else {
          if (run >= minPauseFrames) {
            pauseFrames += run;
            longest = Math.max(longest, run);
          }
          run = 0;
        }
      }
      const spokenFrames = last - first + 1;

      // Level and brightness, over the frames that contain speech.
      let energy = 0;
      let crossings = 0;
      let speechSamples = 0;
      for (let frame = first; frame <= last; frame++) {
        if (levels[frame] < threshold) continue;
        const start = frame * frameSize;
        for (let i = start; i < start + frameSize; i++) {
          energy += channelData[i] * channelData[i];
          if (i > start && (channelData[i] >= 0) !== (channelData[i - 1] >= 0)) crossings++;
        }
        speechSamples += frameSize;
      }
      const levelDb = 20 * Math.log10(Math.sqrt(energy / speechSamples));
      const brightnessHz = crossings / (speechSamples / decodedAudio.sampleRate);

      // Pitch: for each speech frame, find the delay at which the waveform best
      // matches itself (autocorrelation). Done on a reduced-rate copy to stay fast.
      const step = Math.max(1, Math.round(decodedAudio.sampleRate / 8000));
      const rate = decodedAudio.sampleRate / step;
      const reduced = new Float32Array(Math.floor(channelData.length / step));
      for (let i = 0; i < reduced.length; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) sum += channelData[i * step + j];
        reduced[i] = sum / step;
      }
      const span = Math.round(rate * 0.04);
      const minLag = Math.floor(rate / 400); // highest pitch considered: 400 Hz
      const maxLag = Math.ceil(rate / 70);   // lowest pitch considered: 70 Hz
      const pitches: number[] = [];
      // At most ~1500 frames, spread evenly, so long recordings stay quick.
      const stride = Math.max(2, Math.ceil(spokenFrames / 1500));
      for (let frame = first; frame <= last; frame += stride) {
        if (levels[frame] < threshold) continue;
        const start = Math.floor((frame * frameSize) / step);
        if (start + span + maxLag >= reduced.length) break;
        let power = 0;
        for (let i = 0; i < span; i++) power += reduced[start + i] * reduced[start + i];
        if (power === 0) continue;
        let bestLag = 0;
        let best = 0;
        for (let lag = minLag; lag <= maxLag; lag++) {
          let match = 0;
          let lagPower = 0;
          for (let i = 0; i < span; i++) {
            match += reduced[start + i] * reduced[start + i + lag];
            lagPower += reduced[start + i + lag] * reduced[start + i + lag];
          }
          const score = lagPower > 0 ? match / Math.sqrt(power * lagPower) : 0;
          // Prefer the shortest delay among near-equal matches, which avoids
          // reading the pitch an octave too low.
          if (score > best * 1.05) {
            best = score;
            bestLag = lag;
          }
        }
        // Whispered or noisy frames match themselves poorly; skip them.
        if (best >= 0.6 && bestLag > 0) pitches.push(rate / bestLag);
      }
      let pitch: { pitchHz: number; pitchVariationSemitones: number } | null = null;
      if (pitches.length >= 10) {
        pitches.sort((x, y) => x - y);
        const at = (fraction: number) => pitches[Math.min(pitches.length - 1, Math.floor(pitches.length * fraction))];
        // Spread between the 10th and 90th percentile, so stray misreadings don't count.
        pitch = {
          pitchHz: Math.round(at(0.5)),
          pitchVariationSemitones: Math.round(12 * Math.log2(at(0.9) / at(0.1)) * 10) / 10,
        };
      }

      return {
        durationSeconds: spokenFrames * frameSeconds,
        pauseRatio: pauseFrames / spokenFrames,
        longestPauseSeconds: longest * frameSeconds,
        levelDb: Math.round(levelDb * 10) / 10,
        brightnessHz: Math.round(brightnessHz),
        ...(pitch || {}),
      };
    } catch (error) {
      console.error("Voice analysis failed:", error);
      return null;
    }
  };

  // Pace is words in the transcript divided by time. Returns null when the
  // result is not believable (very short recording or a broken transcript).
  const wordsPerMinuteFor = (text: string, seconds: number): number | null => {
    if (!text || !seconds || seconds < 5) return null;
    const wpm = Math.round(calculateWordCount(text) / (seconds / 60));
    return wpm >= 20 && wpm <= 320 ? wpm : null;
  };

  const paceLabel = (wpm: number) =>
    wpm < 110 ? "Unhurried" : wpm < 150 ? "Conversational" : wpm < 180 ? "Brisk" : "Fast";

  // Labels for the voice measurements. The cut-offs are starting points chosen
  // from typical speech, not calibrated on this app's recordings.
  const toneLabel = (brightnessHz: number) =>
    brightnessHz < 1500 ? "Warm" : brightnessHz < 3000 ? "Balanced" : "Bright";
  const pitchLabel = (semitones: number) =>
    semitones < 4 ? "Steady" : semitones < 8 ? "Varied" : "Expressive";
  const volumeLabel = (levelDb: number) =>
    levelDb < -32 ? "Gentle" : levelDb < -20 ? "Moderate" : "Strong";

  const sessionWordsPerMinute = (session: SessionData): number | null =>
    session.vocalCharacteristics?.wordsPerMinute
      ?? wordsPerMinuteFor(session.transcript, session.recordingDuration || 0);

  const processAudio = async () => {
    // setIsProcessing(true) is now set in stopRecording to prevent UI flash
    setProgress(0)

    try {
      setProcessingStage("Transcribing your audio...")

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
        const triggerPattern = new RegExp(`(?:^|\\s)${trigger.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}[.!?,\\s]*$`, "i");
        if (triggerPattern.test(transcript)) {
          transcript = transcript.replace(triggerPattern, "").replace(/[,;:\s]+$/, "").trim();
          break;
        }
      }
      console.log("Transcript (trigger removed):", transcript);
      if (!transcript || transcript.trim() === "") {
        throw new Error(transcriptionError || "No transcript was produced. Your recording was not summarized or saved. Please try again.");
      }

      setProcessingStage("Generating your summary...")

      // Process only essential analysis in parallel for immediate user experience
      // Move non-essential analysis (emotions, vocal characteristics) to background
      const startTime = Date.now();
      const [pauses, summary] = await Promise.all([
        analyzeVoice(audioBlob),
        generateSummary(transcript)
      ]);
      // Prefer the measured span of speech; fall back to the recording timer.
      const wordsPerMinute = wordsPerMinuteFor(transcript, pauses?.durationSeconds || currentRecordingTimeRef.current);
      const vocalCharacteristics: VocalCharacteristics = {
        ...(wordsPerMinute ? { wordsPerMinute, pace: paceLabel(wordsPerMinute) } : {}),
        ...(pauses ? {
          pauseRatio: pauses.pauseRatio,
          longestPauseSeconds: pauses.longestPauseSeconds,
          levelDb: pauses.levelDb,
          volume: volumeLabel(pauses.levelDb),
          brightnessHz: pauses.brightnessHz,
          tone: toneLabel(pauses.brightnessHz),
        } : {}),
        ...(pauses?.pitchHz && typeof pauses.pitchVariationSemitones === "number" ? {
          pitchHz: pauses.pitchHz,
          pitchVariationSemitones: pauses.pitchVariationSemitones,
          pitch: pitchLabel(pauses.pitchVariationSemitones),
        } : {}),
      };
      const processingTime = Date.now() - startTime;
      console.log(`Essential processing completed in ${processingTime}ms`);

      // Start emotion analysis in background - not needed for immediate user experience
      const emotionPromise = analyzeEmotions(transcript, audioBlob).catch((err) => {
        console.error("Emotion analysis failed:", err);
        return []; // Return empty array instead of undefined
      });

      console.log("Vocal characteristics:", vocalCharacteristics);

      const trimmedSummary = summary.trim();

      // Start TTS generation in parallel while we process the results
      // This reduces perceived wait time by starting audio generation early
      let ttsPromise: Promise<void> | null = null;
  if (globalSettings?.tts_service === 'elevenlabs' && (selectedElevenLabsVoice || userVoiceCloneId || globalSettings?.elevenlabs_voice_id)) {
  // Start TTS generation immediately after we have the summary, using either
  // the selected generated voice or the configured voice.
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
      if (processingStartedRef.current) {
        localStorage.setItem(PROCESSING_MS_KEY, String(Date.now() - processingStartedRef.current));
      }

      // Use ONLY the red bubble timer - store the duration directly
      const recordingDuration = currentRecordingTimeRef.current;

      console.log("Red bubble timer shows:", recordingDuration, "seconds");

      const newSession: SessionData = {
        id: crypto.randomUUID(),
        timestamp: new Date(), // Just use current time
        transcript,
        summary,
        emotions: [], // Will be populated when background analysis completes
        vocalCharacteristics,
        audioBlob,
        transcription: transcriptionInfoRef.current || undefined,
        // Store the actual duration from the red bubble timer
        recordingDuration: recordingDuration,
        threadId: recordingThreadContextRef.current?.threadId || crypto.randomUUID(),
        parentSessionId: recordingThreadContextRef.current?.parentSessionId,
      }
      followUpParentRef.current = null
      recordingThreadContextRef.current = null
      setActiveThreadId(newSession.threadId || null)

      setSessions((prev) => [newSession, ...prev])
      setCurrentSession(newSession)
      setAnalyzingEmotionsId(newSession.id)

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



      // Save now, without waiting for emotion analysis: the words and summary
      // are what matter, and a slow or failed analysis must not cost the save.
      if (userId) {
        const reflectionData = {
          id: newSession.id,
          userId,
          created_at: newSession.timestamp.toISOString(),
          transcript,
          summary,
          emotions: [] as EmotionAnalysis[],
          vocal: vocalCharacteristics,
          device_info: {
            ...getDeviceInfo(),
            thread_id: newSession.threadId,
            parent_session_id: newSession.parentSessionId,
            ...(newSession.transcription ? { transcription: newSession.transcription } : {}),
          },
          browser_info: getBrowserInfo(),
          location_info: null, // Could add geolocation if needed
          tts_service_used: actualTTSService,
          summary_service_used: globalSettings?.summary_service || 'unknown',
          recording_duration: recordingDuration, // Store the actual duration from red bubble timer
        };
        (async () => {
          try {
            const saved = await persistReflection(reflectionData);
            if (!saved) {
              toast({
                title: "Not saved yet",
                description: "Your reflection is kept on this device and will be saved when the connection returns.",
                variant: "destructive",
              });
            }

            const emotions = await emotionPromise;
            setAnalyzingEmotionsId((current) => current === newSession.id ? null : current);
            if (emotions && emotions.length > 0) {
              setCurrentSession(prev => prev && prev.id === newSession.id ? { ...prev, emotions } : prev);
              setSessions(prev => prev.map(session =>
                session.id === newSession.id ? { ...session, emotions } : session
              ));
              // Same id, so this adds the emotions to the saved reflection (or to
              // the queued copy when the first save has not gone through).
              await persistReflection({ ...reflectionData, emotions });
            }
          } catch (err) {
            console.error("Failed to complete background processing:", err);
          }
        })();
      }
  } catch (error) {
  const message = error instanceof Error ? error.message : "The reflection could not be processed.";
  console.error("Processing error:", error)
  setProcessingError(message);
  setProcessingStage("Processing failed")
  setProgress(0)
  toast({
  title: "Your reflection was not processed",
  description: message,
  variant: "destructive",
  });
  } finally {
      setIsProcessing(false)

      // Re-acquire mic stream for next recording session
      // This is a background operation and won't prompt the user
      if (!streamRef.current && hasPermission) {
        initializeMicrophone().catch(err => {
          console.warn("Failed to re-acquire mic after processing:", err);
        });
      }
    }
  }

  // Sends the recording to the server for transcription. Never throws: a
  // problem is reported so the caller can fall back to the browser transcript.
  const serverTranscript = async (audioBlob: Blob): Promise<{ transcript: string; ms: number; problem?: string }> => {
    const started = Date.now();
    const done = (transcript: string, problem?: string) => ({ transcript, ms: Date.now() - started, problem });
    if (audioBlob.size > SERVER_TRANSCRIPT_MAX_BYTES) return done("", "too_large");
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording");
      formData.append("mimeType", mediaRecorderRef.current?.mimeType || audioBlob.type);
      const response = await fetch(API_ENDPOINTS.TRANSCRIBE_AUDIO, {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(Math.min(
          SERVER_TRANSCRIPT_MAX_WAIT_MS,
          SERVER_TRANSCRIPT_BASE_WAIT_MS + currentRecordingTimeRef.current * SERVER_TRANSCRIPT_WAIT_PER_SECOND_MS,
        )),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return done("", `http_${response.status}`);
      return done(typeof data.transcript === "string" ? data.transcript.trim() : "");
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      return done("", name === "TimeoutError" || name === "AbortError" ? "timeout" : "network");
    }
  };

  const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
    const browserTranscript = `${fullRecognitionTranscriptRef.current} ${pendingRecognitionRef.current}`
      .replace(/\s+/g, " ").trim() ||
      ((window as any).lastRecognitionTranscript || "").trim();

    // The server transcribes the recording itself. The browser's live speech
    // recognition is the fallback whenever the server fails, is slow, or returns
    // much less than the browser heard (it can invent a few words from silence).
    const browserWords = calculateWordCount(browserTranscript);
    const server = await serverTranscript(audioBlob);
    const serverWords = calculateWordCount(server.transcript);
    const useServer = serverWords > 0 && serverWords >= browserWords * 0.6;
    transcriptionInfoRef.current = {
      source: useServer ? "server" : browserTranscript ? "browser" : "backup",
      server_ms: server.ms,
      server_words: serverWords,
      browser_words: browserWords,
      ...(server.problem ? { server_problem: server.problem } : {}),
      // The transcript that was not used, kept for comparison.
      ...(useServer
        ? (browserTranscript ? { other_transcript: browserTranscript } : {})
        : (server.transcript ? { other_transcript: server.transcript } : {})),
    };
    if (useServer) {
      setTranscriptionError(null);
      return server.transcript;
    }
    if (browserTranscript) {
      setTranscriptionError(null);
      return browserTranscript;
    }

    console.warn("Browser speech recognition returned no transcript; trying backup STT");
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");
    formData.append("service", "google");

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), UI_CONSTANTS.API_TIMEOUT_MS);
      const response = await fetch(API_ENDPOINTS.TRANSCRIBE, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await response.json().catch(() => ({}));
      console.log("Backup STT response status:", response.status);

      if (response.ok && typeof data.transcript === "string" && data.transcript.trim()) {
        setTranscriptionError(null);
        return data.transcript.trim();
      }

      const reason = data.error || data.details || `Backup STT failed (${response.status})`;
      throw new Error(reason);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Backup STT request failed";
      const message = `Browser speech recognition returned no transcript, and backup transcription failed: ${reason}`;
      console.error(message, error);
      setTranscriptionError(message);
      throw new Error(message);
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
          service: globalSettings?.summary_service || "gemini",
        }),
      })
      console.log('Summary API response status:', response.status);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || `Summary API failed (${response.status})`);
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
        throw new Error("Gemini returned an unusable summary");
      }

      return summary;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "The summary service failed";
      // A provider outage must never discard a successfully transcribed reflection.
      // Preserve the user's words as a readable synthesis and allow the normal save/TTS path to continue.
      const fallback = `I said, “${transcript.trim()}”`;
      console.error("Summary generation failed; using transcript fallback:", reason);
      setProcessingStage("Summary service unavailable — preserving your words...");
      return fallback;
    }
  }

  // The voice-emotion service (Valence) takes WAV, mono, 4.5 to 15 seconds per
  // file. The recording is decoded in the browser, mixed to mono at 44.1 kHz
  // and cut into up to three clips spread across it (start, middle, end), so a
  // long reflection is judged on more than its opening. Returns no clips when
  // the recording cannot be decoded.
  const VALENCE_SAMPLE_RATE = 44100;
  // The service ignores the first half second, so its 4.5-second minimum needs 5.
  const VALENCE_MIN_SECONDS = 5.2;
  const VALENCE_CLIP_SECONDS = 14;

  const clipsForValence = async (audioBlob: Blob): Promise<Blob[]> => {
    let audioContext: AudioContext | null = null;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      // The browser picks its own rate here: forcing one fails on iOS Safari.
      audioContext = new AudioContextClass();
      const decoded = await audioContext!.decodeAudioData(await audioBlob.arrayBuffer());
      if (!decoded.length) return [];

      // One channel at the target rate: this both mixes down and resamples.
      const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * VALENCE_SAMPLE_RATE), VALENCE_SAMPLE_RATE);
      const source = offline.createBufferSource();
      source.buffer = decoded;
      source.connect(offline.destination);
      source.start();
      const samples = (await offline.startRendering()).getChannelData(0);

      const minSamples = Math.ceil(VALENCE_MIN_SECONDS * VALENCE_SAMPLE_RATE);
      const clipSamples = VALENCE_CLIP_SECONDS * VALENCE_SAMPLE_RATE;
      if (samples.length <= clipSamples) {
        // Short recordings are padded with silence up to the minimum length.
        const clip = new Float32Array(Math.max(samples.length, minSamples));
        clip.set(samples);
        return [monoWav(clip, VALENCE_SAMPLE_RATE)];
      }
      const count = samples.length < clipSamples * 2 ? 2 : 3;
      const lastStart = samples.length - clipSamples;
      return Array.from({ length: count }, (_, index) => {
        const start = Math.round((lastStart * index) / (count - 1));
        return monoWav(samples.subarray(start, start + clipSamples), VALENCE_SAMPLE_RATE);
      });
    } catch (error) {
      console.error("Could not prepare the recording for voice analysis:", error instanceof Error ? error.message : error);
      return [];
    } finally {
      if (audioContext && audioContext.state !== 'closed') {
        await audioContext.close();
      }
    }
  };

  // 16-bit mono WAV from raw samples.
  const monoWav = (samples: Float32Array, sampleRate: number): Blob => {
    const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
    const writeString = (offset: number, text: string) => {
      for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
    };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    }
    return new Blob([view.buffer], { type: 'audio/wav' });
  };

  // Voice emotions for one clip: every category with its probability.
  const valenceEmotionsFor = async (clip: Blob): Promise<Array<{ emotion: string; confidence: number }>> => {
    const audioBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(clip);
    });
    const response = await fetch(`${API_ENDPOINTS.EMOTIONS_VALENCE}?limit=7`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audioBlob: audioBase64 }),
    });
    if (!response.ok) throw new Error(`Voice analysis failed (${response.status})`);
    const data = await response.json();
    return Array.isArray(data.emotions) ? data.emotions : [];
  };

  const analyzeEmotions = async (text: string, audioBlob?: Blob): Promise<EmotionAnalysis[]> => {
    const combinedEmotions: EmotionAnalysis[] = [];

    try {
      // Call text emotions API (HuggingFace)
      const textResponse = await fetch(API_ENDPOINTS.EMOTIONS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (textResponse.ok) {
        const data = await textResponse.json();
        console.log("Text emotion analysis result:", data);
        const textEmotions = (data.emotions || []).map((e: any) => ({ ...e, sources: ['text'] }));
        console.log("Mapped text emotions:", textEmotions);
        combinedEmotions.push(...textEmotions);
      } else {
        console.warn("Text emotion analysis failed:", textResponse.status);
      }
    } catch (error) {
      console.error("Text emotion analysis error:", error);
    }

    // Call Valence audio emotions API (if audio provided)
    if (audioBlob) {
      try {
        const clips = await clipsForValence(audioBlob);
        const results = (await Promise.allSettled(clips.map(valenceEmotionsFor)))
          .filter((result): result is PromiseFulfilledResult<Array<{ emotion: string; confidence: number }>> =>
            result.status === "fulfilled" && result.value.length > 0)
          .map((result) => result.value);
        if (results.length > 0) {
          // Average each category over the clips that were analysed.
          const totals = new Map<string, number>();
          for (const emotions of results) {
            for (const { emotion, confidence } of emotions) {
              totals.set(emotion, (totals.get(emotion) || 0) + confidence / results.length);
            }
          }
          const audioEmotions = Array.from(totals, ([emotion, confidence]) => ({ emotion, confidence, sources: ['audio-valence'] }))
            .sort((x, y) => y.confidence - x.confidence)
            .slice(0, 3);
          combinedEmotions.push(...(audioEmotions as EmotionAnalysis[]));
        } else {
          console.warn("Voice emotion analysis returned nothing for this recording");
        }
      } catch (error) {
        console.error("Valence audio emotion analysis error:", error);
      }
    }

    return combinedEmotions;
  }

  // console.log("TTS service selected:", settings.voiceService);
  // Fetch ElevenLabs voices (API key is configured on backend)
  useEffect(() => {
    const fetchVoices = async () => {
      try {
        // Only the admin gets a voice list; everyone else uses the stock voice or their own clone.
        if (!isAdmin) {
          setElevenLabsVoices([]);
          return;
        }
        const res = await fetch(API_ENDPOINTS.VOICE_ELEVENLABS_VOICES, { headers: adminHeaders() });
        if (res.ok) {
          const data = await res.json();
          setElevenLabsVoices((data.voices || []).map((v: any) => ({ id: v.voice_id, name: v.name, category: v.category })));

        }
      } catch (e) {
        console.warn("Failed to fetch ElevenLabs voices", e);
      }
    };
    fetchVoices();
  }, [globalSettings?.elevenlabs_voice_id, isAdmin]);

  // Which voice reads the summary: the choice saved in this browser if there
  // is one ("" means the default voice was chosen on purpose), otherwise the
  // person's own clone. The choice now carries over to new reflections.
  useEffect(() => {
    if (!userId) return;
    const saved = localStorage.getItem(`em-elevenlabs-voice-${userId}`);
    const ownClone = hasVoiceClone && userVoiceCloneId ? userVoiceCloneId : "";
    const voice = saved !== null ? saved : ownClone;
    // A summary already read aloud in another voice (for example the default
    // voice, before signing in brought the clone along) must be made again.
    if (appliedVoiceRef.current !== null && appliedVoiceRef.current !== voice) discardGeneratedAudio();
    appliedVoiceRef.current = voice;
    setSelectedElevenLabsVoice(voice);
  }, [userId, userVoiceCloneId, hasVoiceClone]);

  // Audio already generated for a summary is kept for replay. Drop it when the
  // voice changes, or Listen would replay the previous voice.
  const discardGeneratedAudio = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsAudioReady(false);
  };

  const chooseVoice = (voiceId: string) => {
    discardGeneratedAudio();
    setSelectedElevenLabsVoice(voiceId);
    if (userId) localStorage.setItem(`em-elevenlabs-voice-${userId}`, voiceId);
  };

  const handleDeleteVoiceClone = async () => {
    try {
      if (userVoiceCloneId) {
        // Delete voice clone from ElevenLabs
        await fetch(API_ENDPOINTS.VOICE_CLONE_DELETE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
          body: JSON.stringify({ voiceId: userVoiceCloneId, userId }),
        });

        // Clear local state
  setUserVoiceCloneId(null);
  setHasVoiceClone(false);
  setSelectedElevenLabsVoice("");
  localStorage.removeItem(`em-elevenlabs-voice-${userId}`);
  discardGeneratedAudio();
  setHasRequestedVoiceClone(false);
        setVoiceCloneError(null); // Clear any error messages
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
      setVoiceCloneError("Voice cloning needs the recording itself, and recordings are not kept once the page is reloaded. Record a new reflection, then choose Clone Voice.");
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
        console.log('Current voice clone state:', { hasVoiceClone, userVoiceCloneId });

        const response = await fetch(API_ENDPOINTS.VOICE_CLONE_IMPROVE, {
          method: 'POST',
          headers: await authHeaders(),
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Voice clone improved successfully:', data);

          if (typeof data.voiceId !== 'string' || !data.voiceId) {
            throw new Error('Voice clone replacement returned no voice ID');
          }

          // Update the voice clone ID only after ElevenLabs confirms the replacement.
          setUserVoiceCloneId(data.voiceId);
          setHasVoiceClone(true);
          setSelectedElevenLabsVoice(data.voiceId);
          localStorage.setItem(`em-elevenlabs-voice-${userId}`, data.voiceId);
          discardGeneratedAudio();
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
        console.log('Creating NEW voice clone for audio:', { size: audioBlob.size, type: audioBlob.type });
        console.log('Current voice clone state:', { hasVoiceClone, userVoiceCloneId });

        const response = await fetch(API_ENDPOINTS.VOICE_CLONE, {
          method: 'POST',
          headers: await authHeaders(),
          body: formData,
        });

        console.log('Voice clone creation response:', response.status);


        if (response.ok) {
          const data = await response.json();
          console.log('Voice clone created successfully:', data);

          if (typeof data.voiceId !== 'string' || !data.voiceId) {
            throw new Error('Voice clone creation returned no voice ID');
          }

  setUserVoiceCloneId(data.voiceId);
  setHasVoiceClone(true);
  setSelectedElevenLabsVoice(data.voiceId);
          localStorage.setItem(`em-elevenlabs-voice-${userId}`, data.voiceId);
          discardGeneratedAudio();
  localStorage.setItem(`${DEFAULT_VALUES.USER_VOICE_CLONE_PREFIX}${userId}`, data.voiceId);

  toast({
  title: "Voice clone created!",
            description: "Your voice clone is ready! Click 'Listen' to hear your reflection in your own voice.",
          });
        } else {
          const errorData = await response.json().catch(() => ({}));

          if (errorData.code === 'voice_limit_reached') throw new Error('VOICE_SLOTS_FULL');
          if (errorData.code === 'voice_add_edit_limit_reached') throw new Error('API_LIMIT_REACHED');

          throw new Error(errorData.detail?.message || errorData.error || 'Failed to create voice clone');
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Please try again or use the default voice.";

      // Set error state for UI display instead of invasive toast
      if (errorMessage === 'VOICE_SLOTS_FULL') {
        setVoiceCloneError('Voice cloning is full at the moment, so a new clone cannot be made. Your reflection still plays in the default voice.');
      } else if (errorMessage === 'API_LIMIT_REACHED') {
        setVoiceCloneError('Voice clone limit reached. Try again next month or use the default voice.');
  } else {
  setVoiceCloneError(`Unable to create voice clone: ${errorMessage}. Your existing clone remains unchanged; you can still use it or the default voice.`);
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

  // The selected voice, as long as this person may use it: their own clone, or
  // any voice for the admin. Anything else falls back to the default voice.
  const ownCloneId = hasVoiceClone && userVoiceCloneId ? userVoiceCloneId : null;
  const activeCustomVoiceId = selectedElevenLabsVoice && (isAdmin || selectedElevenLabsVoice === ownCloneId)
    ? selectedElevenLabsVoice
    : null;
  console.log('Voice selection:', { activeCustomVoiceId, hasVoiceClone, userVoiceCloneId, selectedElevenLabsVoice });
  if (activeCustomVoiceId) {
  try {
  const payload = { text: summary, voiceId: activeCustomVoiceId, userId };
        const response = await fetch(API_ENDPOINTS.VOICE_ELEVENLABS, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...adminHeaders(), ...(await authHeaders()) },
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

          if (audioBlob.size === 0 || !audioBlob.type.includes('audio')) {
            throw new Error('ElevenLabs returned an empty audio response');
          } else {
            setActualTTSService("elevenlabs");
            console.log('Voice clone TTS successful, playing audio - actualTTSService set to elevenlabs');
            await playAudioBlob(audioBlob);
            return;
          }
        } else {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`Voice clone TTS failed: ${response.status} - ${errorText}`);
        }
      } catch (err) {
        console.error('[v0] Voice clone TTS failed:', err);
        toast({ title: 'Voice clone playback failed', description: 'The cloned voice could not be synthesized. Check the voice in ElevenLabs and try replacing it.', variant: 'destructive' });
        setIsSpeaking(false);
        return;
      }
    }

    // Fallback to default ElevenLabs voice if configured
    if (globalSettings?.tts_service === 'elevenlabs') {
      try {
        const payload = { text: summary, voiceId: activeCustomVoiceId || globalSettings?.elevenlabs_voice_id || DEFAULT_VALUES.ELEVENLABS_VOICE_ID, userId };
        const response = await fetch(API_ENDPOINTS.VOICE_ELEVENLABS, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...adminHeaders(), ...(await authHeaders()) },
          body: JSON.stringify(payload),
        });
        console.log('ElevenLabs API response status:', response.status);
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          console.warn('ElevenLabs TTS failed:', response.status, errorText);
          throw new Error(`ElevenLabs TTS failed: ${response.status} - ${errorText}`);
        }
        const audioBlob = await response.blob();
        setActualTTSService("elevenlabs");
        console.log('ElevenLabs TTS successful - actualTTSService set to elevenlabs');
        await playAudioBlob(audioBlob);
        return;
      } catch (err) {
        console.error('[v0] ElevenLabs TTS failed:', err);
        toast({ title: 'ElevenLabs playback failed', description: 'No browser voice was used. Check ElevenLabs configuration and try again.', variant: 'destructive' });
        setIsSpeaking(false);
        return;
      }
    }
    // Browser TTS is only used when the user explicitly selected it.

    // Fallback: Browser TTS only when explicitly selected.
    if (ttsService !== 'elevenlabs' && "speechSynthesis" in window) {
      setActualTTSService("browser");
      console.log('Falling back to browser TTS - actualTTSService set to browser');
      const utterance = new SpeechSynthesisUtterance(summary);

      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      // Use a more natural voice if available
      const voices = speechSynthesis.getVoices();
      const preferredVoice = voices.find(voice =>
        voice.name.includes('River') ||
        voice.name.includes('Samantha') ||
        voice.name.includes('Alex') ||
        voice.name.includes('Google')
      );

      if (preferredVoice) {
        utterance.voice = preferredVoice;
        console.log('Using preferred voice:', preferredVoice.name);
      }

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
                      <stop offset="0%" stopColor="#8e2de2" />
                      <stop offset="100%" stopColor="#f2994a" />
                    </linearGradient>
                  </defs>
                  <rect width="100" height="100" rx="20" fill="url(#grad)" />
                  <rect y="50" width="100" height="1.5" fill="#fff" opacity="0.2" />
                  <path d="M30 20 H70 A5 5 0 0 1 75 25 V45 A5 5 0 0 1 70 50 H50 L45 60 V50 H30 A5 5 0 0 1 25 45 V25 A5 5 0 0 1 30 20 Z" fill="#fff" />
                  <path d="M30 80 H70 A5 5 0 0 0 75 75 V55 A5 5 0 0 0 70 50 H50 L45 40 V50 H30 A5 5 0 0 0 25 55 V75 A5 5 0 0 0 30 80 Z" fill="#fff" opacity="0.3" />
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
              A distraction-free space for self-reflection, where talking out your thoughts can help release any grip they may have on you
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-8 pb-12">
            <div className="space-y-6">
              <p className="text-gray-700 leading-relaxed max-w-md mx-auto">
                To create your personal, anonymized space for reflection, we need consent to access your microphone.
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
              {isRequestingMic ? "Requesting Microphone..." : "Talk it Out"}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const journeySessions = (() => {
    const reflectionSessions = sessions.filter((session) => session.transcript);
    const byParent = new Map<string, SessionData[]>();
    const validIds = new Set(reflectionSessions.map((session) => session.id));
    for (const session of reflectionSessions) {
      const parent = session.parentSessionId
        ? reflectionSessions.find((candidate) => candidate.id === session.parentSessionId)
        : undefined;
      if (
        parent &&
        session.threadId === parent.threadId
      ) {
        const children = byParent.get(parent.id) || [];
        children.push(session);
        byParent.set(parent.id, children);
      }
    }
    const ordered: SessionData[] = [];
    const appendThread = (root: SessionData) => {
      ordered.push(root);
      const descendants = byParent.get(root.id) || [];
      descendants.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      descendants.forEach(appendThread);
    };
    reflectionSessions
      .filter((session) => !session.parentSessionId || !validIds.has(session.parentSessionId))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .forEach(appendThread);
    return ordered;
  })();

  // Place this BEFORE your return (
  const visibleTabs =
  1 +
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
          account={accountsAvailable ? {
            email: accountEmail,
            onSignIn: () => setAccountForm("signin"),
            onCreate: () => setAccountForm("signup"),
            onSignOut: handleSignOut,
          } : undefined}
        />

        <Dialog open={accountForm !== null} onOpenChange={(open) => { if (!open) setAccountForm(null); }}>
          <DialogContent className="max-w-2xl border-0 bg-transparent p-0 shadow-none">
            <DialogTitle className="sr-only">{accountForm === "signup" ? "Create an account" : "Sign in"}</DialogTitle>
            {accountForm && (
              <AccountPanel
                key={accountForm}
                initialMode={accountForm}
                onSignUp={signUp}
                onSignIn={signIn}
                onDone={(mode) => {
                  setAccountForm(null);
                  toast(mode === "signup"
                    ? { title: "Account created", description: "You can now sign in on another device to see these reflections." }
                    : { title: "Signed in", description: "Your reflections have been loaded." });
                }}
                onDismiss={() => setAccountForm(null)}
              />
            )}
          </DialogContent>
        </Dialog>

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
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-8">
            {/* Tab Navigation */}
            <div className="flex justify-center">
              {visibleTabs > 1 && (
                <TabsList className="bg-white/80 backdrop-blur-xl border border-white/30 shadow-xl rounded-2xl p-2">
                  {
                    (
                      1 // Always show "record"
                      + (currentSession ? 3 : 0) // summary, analysis, transcript
                      + (sessions.filter(s => s.transcript).length > 0 ? 1 : 0) // history
                      + 1 // Always show "about"
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
                        <TabsTrigger
                          value="about"
                          disabled={!canSwitchTab && activeTab !== "about"}
                          className={cn(
                            "flex items-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white rounded-xl px-6 py-3 transition-all duration-300",
                            !canSwitchTab && activeTab !== "about" && "opacity-50 cursor-not-allowed",
                          )}
                        >
                          <Info className="w-4 h-4" />
                          <span>About</span>
                        </TabsTrigger>
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

            {/* Unsaved reflections: visible on every tab until the server confirms them */}
            {userId && pendingReflections.some((item) => !savingIds.includes(item.id)) && (
              <div className="mx-auto flex max-w-2xl flex-col items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between" role="status">
                <p className="text-sm leading-relaxed text-amber-900">
                  <strong>
                    {pendingReflections.length === 1 ? "1 reflection is not saved yet." : `${pendingReflections.length} reflections are not saved yet.`}
                  </strong>{" "}
                  {pendingReflections.length === 1 ? "It is" : "They are"} kept on this device only. Avoid clearing your browser data until {pendingReflections.length === 1 ? "it is" : "they are"} saved.
                </p>
                <Button
                  variant="outline"
                  className="shrink-0 rounded-xl border-amber-400 bg-white text-amber-900 hover:bg-amber-100"
                  onClick={async () => {
                    const remaining = await retryPendingReflections(userId);
                    toast(remaining === 0
                      ? { title: "Saved", description: "Your reflections are now saved." }
                      : { title: "Still not saved", description: "The save did not go through. Your reflections are still kept on this device.", variant: "destructive" as const });
                  }}
                >
                  Save now
                </Button>
              </div>
            )}

            {/* Recording Tab */}
            <TabsContent value="record" className="space-y-8">
              <Card className="bg-white/80 backdrop-blur-xl border-0 shadow-2xl rounded-3xl overflow-hidden">
                <CardContent className="p-16">
                  <div className="flex flex-col items-center space-y-12">
                    {/* Recording Button */}
                    <div className="relative">
                      <Button
                        onClick={isRecording ? stopRecording : () => startRecording()}
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
                          ? "Take your time. Breathe deeply. Voice whatever feels right. When you're ready to finish, simply say 'I'm complete' or tap the button."
                          : isProcessing
                            ? "I'm using AI to transcribe and hear what you've voiced, creating an objective synthesis."
                            : isSpeaking
                              ? "Listen to your personalized reflection. Recording is paused while I'm speaking."
                              : isAudioReady
                                ? "Click the Play button to hear your personalized reflection."
                                : "This is your safe space. Click the microphone when you're ready to voice your thoughts, feelings, anything you want help remembering or whatever is on your mind."}
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
                        {processingSecondsLeft !== null && progress < 100 && (
                          <p className="text-center text-sm text-gray-500" aria-live="polite">
                            {processingSecondsLeft > 1
                              ? `About ${processingSecondsLeft} seconds left`
                              : "Almost there, taking a little longer than usual..."}
                          </p>
                        )}
                      </div>
                    )}

  {processingError && !isProcessing && (
  <div className="w-full max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-6 text-left" role="alert">
    <h3 className="font-semibold text-red-900">Your reflection was not processed</h3>
    <p className="mt-2 text-sm leading-relaxed text-red-800">{processingError}</p>
    <p className="mt-3 text-sm text-red-700">Your recording was not summarized or saved. Please try recording again. If this happens again, share this message when reporting the issue.</p>
  </div>
  )}

  {/* A suggestion to speak to, set by the admin. Stays visible while recording. */}
  {!isProcessing && !processingError && <JournalPrompt compact={isRecording} />}

  {/* Gentle guidance */}
  {!isRecording && !isProcessing && !processingError && (
  <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-8 max-w-2xl">
                        <div className="flex items-start space-x-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-8 h-8">
                              <defs>
                                <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
                                  <stop offset="0%" stopColor="#8e2de2" />
                                  <stop offset="100%" stopColor="#f2994a" />
                                </linearGradient>
                              </defs>
                              <rect width="100" height="100" rx="20" fill="url(#grad2)" />
                              <rect y="50" width="100" height="1.5" fill="#fff" opacity="0.2" />
                              <path d="M30 20 H70 A5 5 0 0 1 75 25 V45 A5 5 0 0 1 70 50 H50 L45 60 V50 H30 A5 5 0 0 1 25 45 V25 A5 5 0 0 1 30 20 Z" fill="#fff" />
                              <path d="M30 80 H70 A5 5 0 0 0 75 75 V55 A5 5 0 0 0 70 50 H50 L45 40 V50 H30 A5 5 0 0 0 25 55 V75 A5 5 0 0 0 30 80 Z" fill="#fff" opacity="0.3" />
                            </svg>
                          </div>
                          <div className="space-y-3">
                            <h3 className="font-semibold text-gray-800">A gentle reminder</h3>
                            <p className="text-gray-600 leading-relaxed">
                              There's no right or wrong way to use this space. You might voice your dreams, process a
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
              {/* Returning users on a new device: a quiet way in. Never required. */}
              {accountsAvailable && !accountEmail && !isRecording && !isProcessing && (
                <p className="text-center text-sm text-gray-500">
                  Been here before on another device?{" "}
                  <button type="button" className="text-purple-700 underline decoration-dotted hover:text-purple-900" onClick={() => setAccountForm("signin")}>
                    Sign in to see your reflections
                  </button>
                </p>
              )}
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
                        {userId && (
                          <p
                            className={cn(
                              "mt-2 text-sm font-medium",
                              pendingReflections.some((item) => item.id === currentSession.id)
                                ? "text-amber-700"
                                : "text-emerald-700",
                            )}
                            role="status"
                          >
                            {!pendingReflections.some((item) => item.id === currentSession.id)
                              ? <>✓ Saved to your{" "}
                                  <button type="button" className="underline hover:text-emerald-900" onClick={() => setActiveTab("history")}>
                                    reflections
                                  </button>
                                </>
                              : savingIds.includes(currentSession.id)
                                ? "Saving…"
                                : "Not saved yet. Kept on this device."}
                          </p>
                        )}
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
                          disabled={isProcessing || isRecording || !currentSession?.summary}
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
                              : "Clone your voice to hear reflections in your own voice. Your recording is sent to ElevenLabs, which keeps the voice clone until you delete it with Delete Clone."
                            }
                          </TooltipContent>
                        </Tooltip>

                        {/* Voice Clone Status Display */}
  {(elevenLabsVoices.length > 0 || (hasVoiceClone && userVoiceCloneId)) && (
  <div className={`mt-2 p-2 rounded-lg text-sm ${hasVoiceClone && userVoiceCloneId ? "bg-green-50 border border-green-200 text-green-800" : "bg-blue-50 border border-blue-200 text-blue-800"}`}>
  <div className="flex flex-col gap-2">
  <div className="flex items-center justify-between gap-3">
  <span>{hasVoiceClone && userVoiceCloneId ? (selectedElevenLabsVoice && selectedElevenLabsVoice !== userVoiceCloneId ? "Another voice selected" : "Your voice clone is active") : "Choose a voice for synthesis"}</span>
  {!hasVoiceClone && <span className="text-xs text-blue-600">No clone required</span>}
  </div>
  <label className="sr-only" htmlFor="elevenlabs-voice-select">Choose an ElevenLabs custom voice</label>
  <select
  id="elevenlabs-voice-select"
  value={selectedElevenLabsVoice || ""}
  onChange={(event) => chooseVoice(event.target.value)}
  className="w-full rounded-md border border-current/20 bg-white px-2 py-1.5 text-sm"
  aria-label="Choose an ElevenLabs custom voice"
  >
  <option value="">Default voice</option>
  {hasVoiceClone && userVoiceCloneId && <option value={userVoiceCloneId}>My voice clone</option>}
  {elevenLabsVoices.map((voice) => (
    <option key={voice.id} value={voice.id}>{voice.name}</option>
  ))}
  </select>
  </div>
  </div>
  )}
                        {/* Voice Clone Error Display - only show when there's an actual error */}
                        {voiceCloneError && !hasVoiceClone && (
                          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                            {voiceCloneError}
                          </div>
                        )}

                        {/* Delete Clone Button - only show when voice clone exists */}
                        {hasVoiceClone && userVoiceCloneId && selectedElevenLabsVoice && (
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
                      <div className="mt-8 flex flex-col items-center gap-3 border-t border-purple-100 pt-6">
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Record a follow-up reflection"
                          title="Record a follow-up reflection"
                          disabled={isRecording || isProcessing || isSpeaking || !currentSession.summary}
                          onClick={async () => {
                            setActiveThreadId(currentSession.threadId || currentSession.id);
                            followUpParentRef.current = {
                              threadId: currentSession.threadId || currentSession.id,
                              parentSessionId: currentSession.id,
                            };
  setActiveTab("record");
  await startRecording("follow-up");
  }}
                          className="size-12 rounded-full border-purple-200 bg-purple-50 text-purple-600 shadow-sm hover:bg-purple-100"
                        >
                          <Mic data-icon="inline-start" />
                        </Button>
                        <span className="text-sm font-medium text-purple-700">Reflect on this synthesis</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {/* Earlier reflections in this thread, shown in full with nothing to click */}
                {(() => {
                  const threadId = currentSession.threadId || currentSession.id;
                  const earlier = sessions
                    .filter((session) => (session.threadId || session.id) === threadId
                      && session.id !== currentSession.id
                      && session.timestamp.getTime() < currentSession.timestamp.getTime())
                    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
                  if (earlier.length === 0) return null;
                  return (
                    <Card className="border-purple-100 bg-white/60 shadow-lg rounded-2xl">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base text-purple-800">Earlier in this thread</CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-4 pt-0">
                        {earlier.map((session) => (
                          <div key={session.id} className="border-l-2 border-purple-200 pl-4">
                            <p className="text-xs font-medium text-gray-500">
                              {session.timestamp.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </p>
                            <p className="mt-1 leading-relaxed text-gray-700">{session.summary}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  );
                })()}
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
                  {/* 1. Text-Based Emotion Analysis */}
                  <Card className="bg-white/80 backdrop-blur-xl border-0 shadow-2xl rounded-3xl overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 p-8">
                      <CardTitle className="text-2xl text-gray-800 flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg flex items-center justify-center">
                          <FileText className="w-4 h-4 text-white" />
                        </div>
                        <span>Text-Based Emotion Analysis</span>
                      </CardTitle>
                      <CardDescription className="text-gray-600 text-lg">
                        {/* [CHANGE: 2025-12-14] Updated label for clarity on overlapping emotions */}
                        The emotions your words express most strongly, up to five. Each is scored on its own, so they can overlap.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-8">
                      {(() => {
                        const textEmotions = (currentSession.emotions || []).filter(e => e.sources?.includes('text'));
                        console.log("UI Rendering - Text Emotions:", textEmotions);
                        console.log("UI Rendering - All Emotions:", currentSession.emotions);
                        return textEmotions.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {textEmotions.map((emotion, index) => (
                              <div
                                key={index}
                                className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-6 border border-blue-100 hover:shadow-lg transition-all duration-300"
                              >
                                <div className="flex items-center justify-between mb-4">
                                  <h3 className="font-semibold text-gray-800 text-lg">{emotion.emotion}</h3>
                                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                                    {(emotion.confidence * 100).toFixed(0)}%
                                  </Badge>
                                </div>
                                <div className="w-full bg-white/60 rounded-full h-3 overflow-hidden">
                                  <div
                                    className="bg-gradient-to-r from-blue-400 to-indigo-500 h-3 rounded-full transition-all duration-1000 ease-out"
                                    style={{ width: `${emotion.confidence * 100}%` }}
                                  ></div>
                                </div>
                              </div>
                            ))}
                          </div>

                        ) : (
                          <div className="flex items-center justify-center py-4 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                            <p className="text-gray-500 text-sm">
                              {analyzingEmotionsId === currentSession.id
                                ? "Analysing your words…"
                                : "The emotion analysis did not complete for this reflection. Your reflection itself is not affected."}
                            </p>
                          </div>
                        )
                      })()}
                    </CardContent>
                  </Card>

                  {/* 2. Audio-Based Emotion Analysis (Valence) */}
                  <Card className="bg-white/80 backdrop-blur-xl border-0 shadow-2xl rounded-3xl overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50 p-8">
                      <CardTitle className="text-2xl text-gray-800 flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg flex items-center justify-center">
                          <Waves className="w-4 h-4 text-white" />
                        </div>
                        <span>Audio-Based Emotion Analysis</span>
                      </CardTitle>
                      <CardDescription className="text-gray-600 text-lg">
                        {/* [CHANGE: 2025-12-14] Updated label for clarity on probability distribution (adds to 100%) */}
                        <p className="text-gray-600 mb-4">
                          Top 3 predicted emotions from voice tone. (Showing highest probabilities from 7 total categories summing to 100%)
                        </p>                </CardDescription>
                    </CardHeader>
                    <CardContent className="p-8">
                      {(() => {
                        const audioEmotions = (currentSession.emotions || []).filter(e => e.sources?.includes('audio-valence'));
                        return audioEmotions.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {audioEmotions.slice(0, 3).map((emotion, index) => (
                              <div
                                key={index}
                                className="bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 rounded-2xl p-6 border border-orange-100 hover:shadow-lg transition-all duration-300"
                              >
                                <div className="flex items-center justify-between mb-4">
                                  <h3 className="font-semibold text-gray-800 text-lg">{emotion.emotion}</h3>
                                  <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                                    {(emotion.confidence * 100).toFixed(0)}%
                                  </Badge>
                                </div>
                                <div className="w-full bg-white/60 rounded-full h-3 overflow-hidden">
                                  <div
                                    className="bg-gradient-to-r from-orange-400 to-red-500 h-3 rounded-full transition-all duration-1000 ease-out"
                                    style={{ width: `${emotion.confidence * 100}%` }}
                                  ></div>
                                </div>
                              </div>
                            ))}
                          </div>

                        ) : (
                          <div className="flex items-center justify-center py-4 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                            <p className="text-gray-500 text-sm">
                              {analyzingEmotionsId === currentSession.id
                                ? "Analysing your voice…"
                                : "The voice analysis did not complete for this reflection."}
                            </p>
                          </div>
                        )
                      })()}
                    </CardContent>
                  </Card>

                  {/* 3. Voice Characteristics (DSP) */}
                  <Card className="bg-white/80 backdrop-blur-xl border-0 shadow-2xl rounded-3xl overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 p-8">
                      <CardTitle className="text-2xl text-gray-800 flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-lg flex items-center justify-center">
                          <Waves className="w-4 h-4 text-white" />
                        </div>
                        <span>Voice Patterns</span>
                      </CardTitle>
                      <CardDescription className="text-gray-600 text-lg">
                        Measured from this recording and its transcript. Pace and pauses are direct measurements; tone, pitch and volume are estimates.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-8">
                      {(() => {
                        const wpm = sessionWordsPerMinute(currentSession);
                        const vocal = currentSession.vocalCharacteristics || {};
                        const others = sessions
                          .filter((session) => session.id !== currentSession.id)
                          .map(sessionWordsPerMinute)
                          .filter((value): value is number => value !== null);
                        const usual = others.length >= 3
                          ? Math.round(others.reduce((sum, value) => sum + value, 0) / others.length)
                          : null;
                        const comparison = wpm && usual
                          ? Math.abs(wpm - usual) / usual <= 0.1
                            ? `About your usual pace (${usual} words per minute across ${others.length} other reflections).`
                            : `${wpm > usual ? "Faster" : "Slower"} than your usual ${usual} words per minute across ${others.length} other reflections.`
                          : null;
                        const hasPauses = typeof vocal.pauseRatio === "number";
                        const estimates = [
                          typeof vocal.brightnessHz === "number" && {
                            name: "Tone",
                            label: vocal.tone,
                            detail: "Brightness of the sound while you speak",
                            help: "Estimated from how often the sound wave crosses zero while you speak. More crossings means a brighter, crisper sound; fewer means a warmer one. The microphone affects this.",
                          },
                          typeof vocal.pitchHz === "number" && {
                            name: "Pitch",
                            label: vocal.pitch,
                            detail: `Around ${vocal.pitchHz} Hz, moving across about ${vocal.pitchVariationSemitones} semitones`,
                            help: "Your typical voice pitch in this recording, and how far it moved. A small range reads as steady, a wide range as expressive. Background noise can throw this off.",
                          },
                          typeof vocal.levelDb === "number" && {
                            name: "Volume",
                            label: vocal.volume,
                            detail: "Average level while speaking",
                            help: "Average loudness of the recording while you speak. It depends on your microphone and how close you are to it, so compare it with your own other reflections rather than with anyone else's.",
                          },
                        ].filter(Boolean) as Array<{ name: string; label?: string; detail: string; help: string }>;
                        if (!wpm && !hasPauses) {
                          return (
                            <div className="flex items-center justify-center py-4 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                              <p className="text-gray-500 text-sm">This recording was too short to measure pace.</p>
                            </div>
                          );
                        }
                        return (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {wpm && (
                              <div className="p-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100">
                                <div className="flex items-center justify-between">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-gray-700 font-medium underline decoration-dotted cursor-help">Pace</span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Words in your transcript divided by the time you spent speaking. If the transcript missed words, this reads lower than your real pace.
                                    </TooltipContent>
                                  </Tooltip>
                                  <Badge className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">{paceLabel(wpm)}</Badge>
                                </div>
                                <div className="mt-3 text-3xl font-semibold text-gray-800">
                                  {wpm} <span className="text-base font-normal text-gray-600">words per minute</span>
                                </div>
                                {comparison && <p className="mt-2 text-sm text-gray-600">{comparison}</p>}
                              </div>
                            )}
                            {hasPauses && (
                              <div className="p-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-gray-700 font-medium underline decoration-dotted cursor-help">Pauses</span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Quiet stretches of half a second or longer between your first and last words. Background noise can hide pauses.
                                  </TooltipContent>
                                </Tooltip>
                                <div className="mt-3 text-3xl font-semibold text-gray-800">
                                  {Math.round((vocal.pauseRatio || 0) * 100)}% <span className="text-base font-normal text-gray-600">of the time in pauses</span>
                                </div>
                                {(vocal.longestPauseSeconds || 0) > 0 && (
                                  <p className="mt-2 text-sm text-gray-600">Longest pause: {(vocal.longestPauseSeconds || 0).toFixed(1)} seconds.</p>
                                )}
                              </div>
                            )}
                            {estimates.length > 0 && (
                              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
                                {estimates.map((item) => (
                                  <div key={item.name} className="p-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100">
                                    <div className="flex items-center justify-between">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="text-gray-700 font-medium underline decoration-dotted cursor-help">{item.name}</span>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">{item.help}</TooltipContent>
                                      </Tooltip>
                                      <Badge className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">{item.label}</Badge>
                                    </div>
                                    <p className="mt-3 text-sm text-gray-600">{item.detail} (estimate).</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}
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
            {journeySessions.length > 0 && (
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
                      Your reflections
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-8">
  <div className="space-y-6">
                      {journeySessions.map((session) => (
                        <div
                          key={session.id}
                          className={cn(
                            "relative",
                            session.parentSessionId && "ml-8 pl-6",
                          )}
                        >
                          {session.parentSessionId && journeySessions.some((parent) => parent.id === session.parentSessionId && parent.threadId === session.threadId) && (
                            <div
                              className="pointer-events-none absolute -left-4 -top-6 h-[calc(100%+1.5rem)] w-4 border-l-2 border-b-2 border-purple-400 rounded-bl-xl"
                              aria-hidden="true"
                            />
                          )}
                          <div
                          className={cn(
                            "p-6 rounded-2xl cursor-pointer transition-all duration-300 border-2 relative",
                            session.parentSessionId && "border-l-4 border-l-purple-300",
                            currentSession?.id === session.id
                              ? "bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 shadow-lg"
                              : "bg-white/60 border-gray-200 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 hover:border-purple-200 hover:shadow-lg",
                          )}
                          onClick={() => setCurrentSession(session)}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-3">
                                <span className="inline-flex items-center rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                                  {session.parentSessionId ? "Follow-up reflection" : "Original reflection"}
                                </span>
                                {pendingReflections.some((item) => item.id === session.id) && (
                                  <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                                    {savingIds.includes(session.id) ? "Saving…" : "Not saved yet"}
                                  </span>
                                )}
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
                              {isAdmin && session.transcription && (
                                <details className="text-xs text-gray-400 mt-1" onClick={(e) => e.stopPropagation()}>
                                  <summary className="cursor-pointer">
                                    Admin: transcript from {session.transcription.source === "server" ? "the server" : session.transcription.source === "browser" ? "the browser" : "backup speech-to-text"}
                                    {" · "}server {(session.transcription.server_ms / 1000).toFixed(1)}s, {session.transcription.server_words} words
                                    {session.transcription.server_problem ? ` (${session.transcription.server_problem})` : ""}
                                    {" · "}browser {session.transcription.browser_words} words
                                  </summary>
                                  {session.transcription.other_transcript && (
                                    <p className="mt-1">
                                      <strong>{session.transcription.source === "server" ? "Browser heard:" : "Server heard:"}</strong> {session.transcription.other_transcript}
                                    </p>
                                  )}
                                </details>
                              )}
                              <div className="text-gray-700 mt-1">
                                <strong>Summary:</strong> {session.summary}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 ml-6">
                              {(session.emotions || []).slice(0, 3).map((emotion, emotionIndex) => (
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
                        </div>
                      ))}
                    </div>
                    {/* Optional account: a quiet line under the reflections, never a prompt */}
                    {accountsAvailable && (
                      <div className="mt-8 rounded-2xl border border-purple-100 bg-purple-50/50 px-5 py-4 text-sm text-gray-700">
                        {accountEmail ? (
                          <p>
                            Signed in as {accountEmail}.{" "}
                            <button
                              type="button"
                              className="font-semibold text-purple-700 underline hover:text-purple-900"
                              onClick={handleSignOut}
                            >
                              Sign out
                            </button>
                            {hasVoiceClone && <span className="mt-1 block text-gray-600">Your voice clone is saved with this account.</span>}
                          </p>
                        ) : (
                          <p>
                            These reflections are kept in this browser.{" "}
                            <button type="button" className="font-semibold text-purple-700 underline hover:text-purple-900" onClick={() => setAccountForm("signup")}>
                              Create an account
                            </button>{" "}
                            if you want to keep them across devices.
                          </p>
                        )}
                      </div>
                    )}
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
                    <PromptManager adminHeaders={adminHeaders} />

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

            {/* About Tab */}
            <TabsContent value="about" className="space-y-8">
              <Card className="bg-white/80 backdrop-blur-xl border-0 shadow-2xl rounded-3xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50 p-8">
                  <CardTitle className="text-3xl text-gray-800 flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Info className="w-5 h-5 text-white" />
                    </div>
                    <span>About</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                  {/* Main About Content */}
                  <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed">
                    <p className="mb-6">
                      I'm obsessed with voice. Helping my daughter find hers pushed me to model trusting my own. By speaking before self-censoring kicks in, I can hear what's true for me and gain confidence in organizing my thoughts in real time.
                    </p>

                    <p className="mb-8">
                      We live in a flood of news, feeds, and opinions. I'm not trying to shut the world out; I'm choosing moments to tune in. Emotional Mirror gives me a protected space to be 100% present with myself, so I can declutter what's already inside; truths, gifts, and realities, and be present in the world with more intention and calm.
                    </p>
                  </div>

                  {/* What it is */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">What it is</h3>
                    <p className="text-gray-700 leading-relaxed">
                      A private, hands-free voice journal that actively listens and reflects my words back without judgment, so scattered threads become clearer and self-trust grows.
                    </p>
                  </div>

                  {/* How I use it */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">How I use it</h3>
                    <ul className="space-y-3 text-gray-700">
                      <li className="flex items-start space-x-3">
                        <span className="text-green-500 mt-1">•</span>
                        <span>Quick debriefs after classes, podcasts, or meetings</span>
                      </li>
                      <li className="flex items-start space-x-3">
                        <span className="text-green-500 mt-1">•</span>
                        <span>Rehearsals for presentations, interviews, or hard conversations</span>
                      </li>
                      <li className="flex items-start space-x-3">
                        <span className="text-green-500 mt-1">•</span>
                        <span>Checking tone/sentiment over time so intent matches impact</span>
                      </li>
                      <li className="flex items-start space-x-3">
                        <span className="text-green-500 mt-1">•</span>
                        <span>Offloading rumination to be more present with people I love</span>
                      </li>
                    </ul>
                  </div>

                  {/* What it isn't */}
                  <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-2xl p-6">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">What it isn't</h3>
                    <p className="text-gray-700 leading-relaxed">
                      Therapy, coaching, or a guru. No prescriptions. Just space to hear myself.
                    </p>
                  </div>

                  {/* Privacy & control */}
                  <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-2xl p-6">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Privacy & control</h3>
                    <p className="text-gray-700 leading-relaxed">
                      No audio is stored. Reflections are disassociated from names and kept anonymous. I can export everything to CSV in one click. Voice clones require explicit consent and are instantly deletable.
                    </p>
                  </div>

                  {/* Contact */}
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6 text-center">
                    <p className="text-gray-700 leading-relaxed">
                      Share any comments, feedback or hopes via voice or text to{" "}
                      <a
                        href="mailto:hit.neil.up@gmail.com"
                        className="text-purple-600 hover:text-purple-800 font-medium underline"
                      >
                        hit.neil.up@gmail.com
                      </a>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div >
      </div >
    </TooltipProvider >
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

  const handleListModels = async () => {
    setTestLoading((prev) => ({ ...prev, "gemini-models": true }));
    setTestResults((prev) => ({ ...prev, "gemini-models": "" }));
    try {
      const res = await fetch("/api/gemini/models", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setTestResults((prev) => ({ ...prev, "gemini-models": JSON.stringify(data, null, 2) }));
      } else {
        const errorText = await res.text();
        setTestResults((prev) => ({ ...prev, "gemini-models": `Error: ${res.status} - ${errorText}` }));
      }
    } catch (e: any) {
      setTestResults((prev) => ({ ...prev, "gemini-models": `Error: ${e.message}` }));
    } finally {
      setTestLoading((prev) => ({ ...prev, "gemini-models": false }));
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
              <div className="space-y-2">
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 w-full"
                  onClick={() => handleTest(service)}
                  disabled={testLoading[service.key]}
                >
                  {testLoading[service.key] ? "Testing..." : "Test API"}
                </button>
                {service.key === "gemini" && (
                  <button
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 w-full"
                    onClick={handleListModels}
                    disabled={testLoading["gemini-models"]}
                  >
                    {testLoading["gemini-models"] ? "Loading..." : "List Models"}
                  </button>
                )}
              </div>
              {testResults[service.key] && (
                <div className="mt-2 text-xs text-gray-700 break-all">
                  {testResults[service.key]}
                </div>
              )}
              {service.key === "gemini" && testResults["gemini-models"] && (
                <div className="mt-2 text-xs text-gray-700 break-all">
                  <strong>Available Models:</strong>
                  <pre className="whitespace-pre-wrap">{testResults["gemini-models"]}</pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

