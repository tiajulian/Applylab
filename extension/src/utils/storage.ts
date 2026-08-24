import { CandidateProfile } from '../types/profile';

export interface StorageData {
  authToken?: string;
  cachedProfile?: CandidateProfile;
  activeResumeId?: string;
  activeResumeName?: string;
  lastSyncTimestamp?: number;
}

export class StorageService {
  static async get<K extends keyof StorageData>(key: K): Promise<StorageData[K] | undefined> {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return undefined;
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key]);
      });
    });
  }

  static async set<K extends keyof StorageData>(key: K, value: StorageData[K]): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => {
        resolve();
      });
    });
  }

  static async remove(key: keyof StorageData): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
    return new Promise((resolve) => {
      chrome.storage.local.remove([key], () => {
        resolve();
      });
    });
  }

  static async clear(): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
    return new Promise((resolve) => {
      chrome.storage.local.clear(() => {
        resolve();
      });
    });
  }
}
