// Extracted loading state components from app/page.tsx
// Generated during refactoring - do not edit manually

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

interface LoadingStatesProps {
  isPreparing: boolean;
  isLoadingSettings: boolean;
  hasSettingsError: boolean;
  globalSettingsError: string | null;
}

export const LoadingStates = ({ 
  isPreparing, 
  isLoadingSettings, 
  hasSettingsError, 
  globalSettingsError 
}: LoadingStatesProps) => {
  if (isPreparing) {
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
    );
  }

  if (isLoadingSettings) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-purple-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full mx-auto animate-pulse"></div>
            <div className="absolute inset-0 w-20 h-20 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full mx-auto animate-ping opacity-20"></div>
          </div>
          <p className="text-gray-600 font-medium">Loading your personalized settings...</p>
        </div>
      </div>
    );
  }

  if (hasSettingsError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-purple-50 to-indigo-100 flex items-center justify-center p-6">
        <Card className="w-full max-w-2xl shadow-2xl border-0 bg-white/90 backdrop-blur-xl">
          <CardHeader className="text-center pb-8 pt-12">
            <div className="relative mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-red-400 to-red-500 rounded-full mx-auto flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-gray-800 mb-4">
              Settings Unavailable
            </CardTitle>
            <CardDescription className="text-gray-600 text-lg">
              {globalSettingsError || "Unable to load your personalized settings. Please refresh the page or try again later."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center pb-12">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-indigo-600 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Refresh Page
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
};
