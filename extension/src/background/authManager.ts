import { SessionStore, StorageService } from '../utils/storage';

// The access token lives in session storage (see SessionStore). The web app re-sends a fresh one
// whenever it's open (components/extension/ExtensionAuthBridge.tsx).
export class AuthManager {
  static async getToken(): Promise<string | undefined> {
    return SessionStore.get('authToken');
  }

  static async setToken(token: string): Promise<void> {
    await SessionStore.set('authToken', token);
  }

  static async clearToken(): Promise<void> {
    await SessionStore.remove('authToken');
  }

  static async isAuthenticated(): Promise<boolean> {
    const token = await AuthManager.getToken();
    return !!token;
  }

  /** Older versions kept the token and profile in chrome.storage.local; remove any copy left there. */
  static async removeLegacyCopies(): Promise<void> {
    await Promise.all([StorageService.remove('authToken'), StorageService.remove('cachedProfile')]);
  }
}
