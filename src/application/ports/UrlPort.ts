/**
 * UrlPort - Interface for URL handling
 * Allows dependency injection for testability
 */

export interface UrlParams {
  hash: string | null;
}

/**
 * Port interface for URL operations
 */
export interface UrlPort {
  /**
   * Gets the current URL parameters
   */
  getParams(): UrlParams;
  
  /**
   * Sets the hash in the URL
   */
  setHash(hash: string): void;
  
  /**
   * Clears the hash from the URL
   */
  clearHash(): void;
  
  /**
   * Gets a shareable URL for a hash
   */
  getShareableUrl(hash: string): string;
}
