// API configuration that works across different environments

// Determine the base API URL based on the current host
export const getApiBaseUrl = (): string => {
    // Extract hostname from current URL (without port)
    const hostname = window.location.hostname;
    
    // For development: use port 3000 for backend with current hostname
    if (import.meta.env.DEV) {
      return `http://${hostname}:3000`;
    }
    
    // For production: assume backend is on same host (adjust if needed)
    return window.location.origin;
  };
  
  // Use this for all API calls
  export const apiBaseUrl = getApiBaseUrl();
  
  console.log(`Using API base URL: ${apiBaseUrl}`);