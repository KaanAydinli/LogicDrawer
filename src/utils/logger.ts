/**
 * Logger utility that only outputs to console if LOGICDRAWER_DEV environment variable is set to true.
 * Works in both browser (Vite) and Node.js environments.
 */
const getIsDev = (): boolean => {
  // Check for Vite environment
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env.LOGICDRAWER_DEV === "true";
  }
  // Check for Node.js environment
  if (typeof process !== "undefined" && process.env) {
    return process.env.LOGICDRAWER_DEV === "true";
  }
  return false;
};

const isDev = getIsDev();

export const Logger = {
  log: (...args: any[]) => {
    if (isDev) {
      console.log(...args);
    }
  },
  error: (...args: any[]) => {
    if (isDev) {
      console.error(...args);
    }
  },
  warn: (...args: any[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },
  info: (...args: any[]) => {
    if (isDev) {
      console.info(...args);
    }
  },
};

export default Logger;
