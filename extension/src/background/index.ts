import { AuthManager } from './authManager';
import { ApiGateway } from './apiGateway';
import { ExtensionMessage, ExtensionResponse } from '../types/messages';
import { StorageService } from '../utils/storage';

// Enable sidePanel behavior on action click
if (typeof chrome !== 'undefined' && chrome.sidePanel) {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error('[Background] setPanelBehavior error:', error));
}

// Background Message Router
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case 'GET_PROFILE': {
          // Check local storage cache first
          const cachedProfile = await StorageService.get('cachedProfile');
          if (cachedProfile) {
            sendResponse({ success: true, data: cachedProfile });
            // Refresh in background
            ApiGateway.fetchProfile().then((res) => {
              if (res.success && res.data) {
                StorageService.set('cachedProfile', res.data);
              }
            });
            return;
          }

          const res = await ApiGateway.fetchProfile();
          if (res.success && res.data) {
            await StorageService.set('cachedProfile', res.data);
          }
          sendResponse(res);
          break;
        }

        case 'GENERATE_AI_ANSWER': {
          const res = await ApiGateway.generateAiAnswer(message.payload as any);
          sendResponse(res);
          break;
        }

        case 'FETCH_RESUME_PDF': {
          const res = await ApiGateway.fetchResumePdf((message.payload as any)?.resumeId);
          sendResponse(res);
          break;
        }

        case 'LOG_KANBAN': {
          const res = await ApiGateway.logKanban(message.payload as any);
          sendResponse(res);
          break;
        }

        case 'SET_AUTH_TOKEN': {
          const token = (message.payload as any)?.token;
          if (token) {
            await AuthManager.setToken(token);
            // Refresh profile cache
            const res = await ApiGateway.fetchProfile();
            if (res.success && res.data) {
              await StorageService.set('cachedProfile', res.data);
            }
          }
          sendResponse({ success: true });
          break;
        }

        case 'GET_AUTH_STATUS': {
          const isAuth = await AuthManager.isAuthenticated();
          sendResponse({ success: true, data: { isAuthenticated: isAuth } });
          break;
        }

        default:
          sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
          break;
      }
    } catch (err: any) {
      console.error('[Background] Error handling message:', err);
      sendResponse({ success: false, error: err?.message || 'Internal background worker error' });
    }
  })();

  return true; // Keep channel open for async response
});

// Listener for web app postMessage via externally_connectable
chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  if (message.type === 'APPLYLAB_SET_AUTH_TOKEN' && message.token) {
    AuthManager.setToken(message.token).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});
