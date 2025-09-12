// Extracted header component from app/page.tsx
// Generated during refactoring - do not edit manually

import { Badge } from "@/components/ui/badge";
import { Heart, Sparkles } from "lucide-react";

interface AppHeaderProps {
  isRecording: boolean;
  isProcessing: boolean;
  sessionsCount: number;
  serviceStatus: {
    google: boolean;
    huggingface: boolean;
  };
}

export const AppHeader = ({ 
  isRecording, 
  isProcessing, 
  sessionsCount, 
  serviceStatus 
}: AppHeaderProps) => {
  return (
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
            {sessionsCount > 0 && (
              <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
                {sessionsCount} reflection{sessionsCount !== 1 ? "s" : ""}
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
  );
};
