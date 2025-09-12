// hooks/useServiceStatus.ts
import { useState, useEffect } from "react";
import { API_ENDPOINTS } from "@/constants";

export const useServiceStatus = () => {
  const [serviceStatus, setServiceStatus] = useState({ 
    huggingface: false, 
    google: false 
  });

  useEffect(() => {
    fetch(API_ENDPOINTS.STATUS)
      .then(res => res.json())
      .then(setServiceStatus)
      .catch(() => setServiceStatus({ huggingface: false, google: false }));
  }, []);

  return {
    serviceStatus,
    setServiceStatus
  };
};
