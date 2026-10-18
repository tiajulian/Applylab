import { FormEngine } from './formEngine';
import { FloatingBar } from './ui/floatingBar';
import { AiAssistant } from './aiAssistant';
import { JobScraper } from './jobScraper';
import { ExtensionMessage, ExtensionResponse } from '../types/messages';
import { CandidateProfile } from '../types/profile';
import { CreateApplicationPayload, NeedsDetails } from '../types/application';

class ContentScriptApp {
  private formEngine = new FormEngine();
  private floatingBar = new FloatingBar();
  private lastUrl = window.location.href;
  private isObserving = false;

  init(): void {
    console.log('[ApplyLab Co-Pilot] Content script bootloader initialized.');
    
    this.floatingBar.init(
      () => this.handleAutofill(),
      () => this.handleAttachPdf(),
      () => this.handleLogKanban()
    );

    this.updateFieldCount();
    this.setupSpaObservers();
    AiAssistant.attachInlineButtons();
  }

  private updateFieldCount(): void {
    const count = this.formEngine.countFillableFields();
    const adaptor = this.formEngine.getActiveAdaptor();
    const statusText = adaptor ? `[${adaptor.name}]` : 'ready to fill';
    this.floatingBar.updateStatus(count, statusText);
  }

  private setupSpaObservers(): void {
    if (this.isObserving) return;
    this.isObserving = true;

    // Debounced MutationObserver for DOM step transitions
    let timeoutId: NodeJS.Timeout | null = null;
    const observer = new MutationObserver(() => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        // Detect SPA URL changes
        if (window.location.href !== this.lastUrl) {
          this.lastUrl = window.location.href;
          console.log('[ApplyLab] SPA step transition detected:', this.lastUrl);
        }
        this.updateFieldCount();
        AiAssistant.attachInlineButtons();
      }, 300);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  private async fetchProfile(): Promise<CandidateProfile | null> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_PROFILE' }, (response: ExtensionResponse<CandidateProfile>) => {
        if (response && response.success && response.data) {
          resolve(response.data);
        } else {
          console.error('[ApplyLab] Failed to fetch candidate profile:', response?.error);
          resolve(null);
        }
      });
    });
  }

  private async handleAutofill(): Promise<void> {
    this.floatingBar.setLoading(true, 'Autofilling...');
    try {
      const profile = await this.fetchProfile();
      if (!profile) {
        alert('Please log in to ApplyLab at applylab.io to enable 1-Click Autofill.');
        this.floatingBar.setLoading(false);
        return;
      }

      const result = await this.formEngine.autofill(profile);
      this.floatingBar.updateStatus(result.filledCount, `fields filled!`);
    } catch (err) {
      console.error('[ApplyLab] Autofill execution error:', err);
    } finally {
      this.floatingBar.setLoading(false);
    }
  }

  private async handleAttachPdf(): Promise<void> {
    this.floatingBar.setLoading(true, 'Fetching PDF...');
    try {
      const profile = await this.fetchProfile();
      if (!profile || !profile.activeResumeId) {
        alert('No active resume selected in ApplyLab profile.');
        this.floatingBar.setLoading(false);
        return;
      }

      chrome.runtime.sendMessage(
        { type: 'FETCH_RESUME_PDF', payload: { resumeId: profile.activeResumeId } },
        async (response: ExtensionResponse<{ pdfArrayBuffer: number[]; fileName: string }>) => {
          if (response && response.success && response.data) {
            const blob = new Blob([new Uint8Array(response.data.pdfArrayBuffer)], { type: 'application/pdf' });
            const success = await this.formEngine.attachResumePdf(blob, response.data.fileName || 'Resume.pdf');
            if (success) {
              alert('✅ Resume PDF attached to file upload!');
            } else {
              alert('⚠️ File input element not found. Please drag and drop resume from side panel.');
            }
          } else {
            alert(`⚠️ Failed to download resume PDF: ${response?.error || 'Unknown error'}`);
          }
          this.floatingBar.setLoading(false);
        }
      );
    } catch (err) {
      console.error('[ApplyLab] PDF attachment error:', err);
      this.floatingBar.setLoading(false);
    }
  }

  private async handleLogKanban(): Promise<void> {
    this.floatingBar.setLoading(true, 'Logging job...');
    try {
      const job = JobScraper.extract();
      const payload: CreateApplicationPayload = {
        jobTitle: job.jobTitle,
        companyName: job.companyName,
        location: job.location,
        jobUrl: job.jobUrl,
        platform: job.platform,
        status: 'applied',
        pageTitle: document.title
      };

      let response = await this.sendLogKanban(payload);
      // The page had no real job title or company (an ATS apply step, say): ask rather than save junk.
      if (!response.success && response.data?.needsDetails) {
        const jobTitle = window.prompt('Job title for this application:', response.data.suggested.jobTitle)?.trim();
        const companyName = jobTitle
          ? window.prompt('Company for this application:', response.data.suggested.companyName)?.trim()
          : undefined;
        if (!jobTitle || !companyName) {
          this.floatingBar.setLoading(false);
          return;
        }
        response = await this.sendLogKanban({ ...payload, jobTitle, companyName, confirmed: true });
      }

      if (response.success) {
        alert('📊 Added to your ApplyLab Applications.');
      } else {
        alert(`⚠️ Failed to log application: ${response.error || 'Unknown error'}`);
      }
      this.floatingBar.setLoading(false);
    } catch (err) {
      console.error('[ApplyLab] Log Kanban error:', err);
      this.floatingBar.setLoading(false);
    }
  }

  private sendLogKanban(payload: CreateApplicationPayload): Promise<ExtensionResponse<NeedsDetails | undefined>> {
    const message: ExtensionMessage = { type: 'LOG_KANBAN', payload };
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response?: ExtensionResponse<NeedsDetails | undefined>) => {
        resolve(response ?? { success: false, error: 'No response from background worker' });
      });
    });
  }
}

// Boot content script
const app = new ContentScriptApp();
app.init();
