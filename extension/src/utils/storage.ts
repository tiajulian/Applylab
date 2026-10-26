import { CandidateProfile } from '../types/profile';

/** A job ad the user viewed, kept so its apply step can be logged with the real title. */
export interface RecentJobAd {
  key: string;
  jobTitle: string;
  companyName: string;
  location: string;
  seenAt: number;
}

export interface StorageData {
  authToken?: string;
  cachedProfile?: CandidateProfile;
  activeResumeId?: string;
  activeResumeName?: string;
  lastSyncTimestamp?: number;
  recentJobAds?: RecentJobAd[];
}

/**
 * chrome.storage.session: in memory only, and (unlike chrome.storage.local) not readable by
 * content scripts, which run on every job site. For the access token and the candidate's profile.
 */
export class SessionStore {
  static async get<K extends keyof StorageData>(key: K): Promise<StorageData[K] | undefined> {
    const result = await chrome.storage.session.get(key);
    return result[key] as StorageData[K] | undefined;
  }

  static async set<K extends keyof StorageData>(key: K, value: StorageData[K]): Promise<void> {
    await chrome.storage.session.set({ [key]: value });
  }

  static async remove(key: keyof StorageData): Promise<void> {
    await chrome.storage.session.remove(key);
  }
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
