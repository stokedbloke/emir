// Extracted device utility functions from app/page.tsx
// Generated during refactoring - do not edit manually

export const getDeviceInfo = () => {
  if (typeof window === 'undefined') return null;
  
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    screenWidth: screen.width,
    screenHeight: screen.height,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timestamp: new Date().toISOString(),
  };
};

export const getBrowserInfo = () => {
  if (typeof window === 'undefined') return null;
  
  const userAgent = navigator.userAgent;
  let browser = 'Unknown';
  let version = 'Unknown';
  
  if (userAgent.includes('Chrome')) {
    browser = 'Chrome';
    version = userAgent.match(/Chrome\/(\d+)/)?.[1] || 'Unknown';
  } else if (userAgent.includes('Firefox')) {
    browser = 'Firefox';
    version = userAgent.match(/Firefox\/(\d+)/)?.[1] || 'Unknown';
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browser = 'Safari';
    version = userAgent.match(/Version\/(\d+)/)?.[1] || 'Unknown';
  } else if (userAgent.includes('Edge')) {
    browser = 'Edge';
    version = userAgent.match(/Edge\/(\d+)/)?.[1] || 'Unknown';
  }
  
  return {
    browser,
    version,
    userAgent: userAgent,
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent),
    isTablet: /iPad|Android(?=.*\bMobile\b)(?=.*\bSafari\b)/i.test(userAgent),
  };
};
