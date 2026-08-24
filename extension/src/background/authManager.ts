import { StorageService } from '../utils/storage';

export class AuthManager {
  static async getToken(): Promise<string | undefined> {
    return await StorageService.get('authToken');
  }

  static async setToken(token: string): Promise<void> {
    await StorageService.set('authToken', token);
  }

  static async clearToken(): Promise<void> {
    await StorageService.remove('authToken');
  }

  static async isAuthenticated(): Promise<boolean> {
    const token = await AuthManager.getToken();
    return !!token;
  }
}
