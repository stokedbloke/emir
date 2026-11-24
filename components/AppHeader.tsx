// Extracted header component from app/page.tsx
// Generated during refactoring - do not edit manually

import { Badge } from "@/components/ui/badge";
import { VocalMirrorLogo } from "@/components/VocalMirrorLogo";

interface AppHeaderProps {
  isRecording: boolean;
  isProcessing: boolean;
  sessionsCount: number;
  // Absent when accounts are not available; then no account controls are shown.
  account?: {
    email: string | null;
    onSignIn: () => void;
    onCreate: () => void;
    onSignOut: () => void;
  };
}

export const AppHeader = ({ 
  isRecording, 
  isProcessing, 
  sessionsCount,
  account,
}: AppHeaderProps) => {
  return (
    <div className="relative bg-white/60 backdrop-blur-xl border-b border-white/30 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <VocalMirrorLogo className="w-12 h-12 rounded-xl shadow-lg" />
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                VocalMirror
              </h1>
              <p className="text-sm text-gray-600">Release your inner monologue</p>
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
            {account && (account.email ? (
              <div className="flex items-center space-x-3 text-sm text-gray-600">
                <span className="hidden max-w-[14rem] truncate md:inline" title={account.email}>{account.email}</span>
                <button type="button" onClick={account.onSignOut} className="font-medium text-purple-700 underline hover:text-purple-900">
                  Sign out
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3 text-sm">
                <button type="button" onClick={account.onCreate} className="hidden font-medium text-purple-700 underline hover:text-purple-900 sm:inline">
                  Create account
                </button>
                <button
                  type="button"
                  onClick={account.onSignIn}
                  className="rounded-xl border border-purple-200 bg-white/80 px-4 py-2 font-semibold text-purple-700 shadow-sm hover:bg-purple-50"
                >
                  Sign in
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
