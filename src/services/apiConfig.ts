export const getApiBaseUrl = (): string => {
  if (window.location.hostname !== "localhost" || window.location.port === "3000") {
    return "";
  }

  return `http://${window.location.hostname}:3000`;
};

export const apiBaseUrl = getApiBaseUrl();

console.log(`Using API base URL: ${apiBaseUrl}`);
