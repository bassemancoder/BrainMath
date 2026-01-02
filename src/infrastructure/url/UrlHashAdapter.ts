/**
 * UrlHashAdapter - Implementation of UrlPort using browser URL API
 */

import type { UrlPort, UrlParams } from '@application/ports/UrlPort';

const HASH_PARAM = 'h';

/**
 * Implementation of UrlPort using browser URL API
 */
export const urlHashAdapter: UrlPort = {
  getParams(): UrlParams {
    const params = new URLSearchParams(window.location.search);
    const hash = params.get(HASH_PARAM);
    
    return {
      hash: hash ? hash.toUpperCase() : null,
    };
  },
  
  setHash(hash: string): void {
    const url = new URL(window.location.href);
    url.searchParams.set(HASH_PARAM, hash.toUpperCase());
    
    // Update URL without reloading
    window.history.replaceState({}, '', url.toString());
  },
  
  clearHash(): void {
    const url = new URL(window.location.href);
    url.searchParams.delete(HASH_PARAM);
    
    // Update URL without reloading
    window.history.replaceState({}, '', url.toString());
  },
  
  getShareableUrl(hash: string): string {
    const url = new URL(window.location.href);
    url.searchParams.set(HASH_PARAM, hash.toUpperCase());
    return url.toString();
  },
};

/**
 * Default export for convenience
 */
export default urlHashAdapter;
