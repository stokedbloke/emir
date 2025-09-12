// Extracted text utility functions from app/page.tsx
// Generated during refactoring - do not edit manually

export const calculateWordCount = (text: string): number => {
  if (!text) return 0;
  return text.trim().split(/\s+/).length;
};

export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};
