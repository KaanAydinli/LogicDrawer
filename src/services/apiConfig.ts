export const getApiBaseUrl = (): string => {
  // Üretimde veya tam yolda test ederken
  if (window.location.hostname !== 'localhost' || window.location.port === '3000') {
    return '';  // Boş string = aynı sunucu
  }
  
  // Geliştirme ortamında
  return `http://${window.location.hostname}:3000`;
};
  
  // Use this for all API calls
  export const apiBaseUrl = getApiBaseUrl();
  
  console.log(`Using API base URL: ${apiBaseUrl}`);