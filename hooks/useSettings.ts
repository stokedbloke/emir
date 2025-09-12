// Settings management hook extracted from app/page.tsx
// Generated during refactoring - do not edit manually

import { useState, useEffect } from 'react';
import { GlobalSettings } from '@/types';
import { API_ENDPOINTS } from '@/constants';

export const useSettings = () => {
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>({
    summary_service: 'gemini',
    tts_service: 'elevenlabs',
    elevenlabs_voice_id: 'SAz9YHcvj6GT2YYXdXww',
    google_lang: undefined,
    google_gender: undefined,
    hume_voice: undefined
  });
  const [globalSettingsLoading, setGlobalSettingsLoading] = useState(false);
  const [globalSettingsError, setGlobalSettingsError] = useState<string | null>(null);

  // Load global settings on mount
  useEffect(() => {
    setGlobalSettingsLoading(true);
    setGlobalSettingsError(null);
    
    // Add timeout to prevent hanging
    const timeoutId = setTimeout(() => {
      console.log('Settings fetch timeout, using defaults');
      setGlobalSettings({
        summary_service: 'gemini',
        tts_service: 'elevenlabs',
        elevenlabs_voice_id: 'SAz9YHcvj6GT2YYXdXww',
        google_lang: undefined,
        google_gender: undefined,
        hume_voice: undefined
      });
      setGlobalSettingsLoading(false);
    }, 5000); // 5 second timeout
    
    fetch(API_ENDPOINTS.GLOBAL_SETTINGS)
      .then(res => {
        clearTimeout(timeoutId);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
      })
      .then(data => {
        if (data.error) {
          throw new Error(data.error);
        }
        setGlobalSettings(data.settings as GlobalSettings);
        setGlobalSettingsLoading(false);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        console.error('Failed to load global settings:', error);
        setGlobalSettingsError(error.message);
        setGlobalSettingsLoading(false);
        // Set default settings if fetch fails
        setGlobalSettings({
          summary_service: 'gemini',
          tts_service: 'elevenlabs',
          elevenlabs_voice_id: 'SAz9YHcvj6GT2YYXdXww',
          google_lang: undefined,
          google_gender: undefined,
          hume_voice: undefined
        });
      });
  }, []);

  // Handle global settings updates
  const handleGlobalSettingsChange = (updates: Record<string, any>) => {
    fetch(API_ENDPOINTS.GLOBAL_SETTINGS, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        // Reload settings to get the updated values
        fetch(API_ENDPOINTS.GLOBAL_SETTINGS)
          .then(res => res.json())
          .then(data => setGlobalSettings(data.settings as GlobalSettings));
      } else {
        alert(data.error || "Failed to update settings");
      }
    })
    .catch(error => {
      console.error('Failed to update settings:', error);
      alert("Failed to update settings");
    });
  };

  return {
    globalSettings,
    globalSettingsLoading,
    globalSettingsError,
    handleGlobalSettingsChange,
    setGlobalSettings
  };
};
