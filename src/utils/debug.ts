/**
 * Debug logging utility
 * Logs are only shown when localStorage.getItem('debug') === 'true'
 * Enable in browser console: localStorage.setItem('debug', 'true')
 * Disable: localStorage.removeItem('debug')
 */

const isDebugEnabled = (): boolean => {
  try {
    return typeof window !== 'undefined' && localStorage.getItem('debug') === 'true';
  } catch {
    return false;
  }
};

export const debug = {
  log: (...args: unknown[]): void => {
    if (isDebugEnabled()) {
      console.log(...args);
    }
  },
  
  warn: (...args: unknown[]): void => {
    if (isDebugEnabled()) {
      console.warn(...args);
    }
  },
  
  error: (...args: unknown[]): void => {
    // Always show errors
    console.error(...args);
  },
  
  /** Force log even when debug is disabled (for important info) */
  info: (...args: unknown[]): void => {
    console.log(...args);
  },
};

export default debug;
