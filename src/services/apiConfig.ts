// API configuration that works across different environments

// Determine the base API URL based on the current host
export const getApiBaseUrl = (): string => {
    // Extract hostname from current URL (without port)
    // Extract hostname from current URL
    const hostname = window.location.hostname;
    const port = 3000; // Backend port
    
    // Her zaman mevcut hostname'i kullan, sadece port değiştir
    return `http://${hostname}:${port}`;
  };
  
  // Use this for all API calls
  export const apiBaseUrl = getApiBaseUrl();
  
  console.log(`Using API base URL: ${apiBaseUrl}`);