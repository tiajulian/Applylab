import { CandidateProfile } from '../types/profile';
import { ExtensionResponse } from '../types/messages';
import { formatAustralianPhone, resolveWorkRightsAnswer } from '../utils/australianTaxonomy';

class SidePanelApp {
  private currentProfile: CandidateProfile | null = null;

  async init(): Promise<void> {
    this.setupCopyButtons();
    await this.loadProfile();
  }

  private async loadProfile(): Promise<void> {
    const authStatusEl = document.getElementById('auth-status');
    const profileDetailsEl = document.getElementById('profile-details');

    chrome.runtime.sendMessage({ type: 'GET_PROFILE' }, (response: ExtensionResponse<CandidateProfile>) => {
      if (response && response.success && response.data) {
        this.currentProfile = response.data;
        if (authStatusEl) {
          authStatusEl.textContent = 'Authenticated';
          authStatusEl.classList.add('authenticated');
        }
        if (profileDetailsEl) {
          profileDetailsEl.innerHTML = `
            <strong>${this.currentProfile.personal.firstName} ${this.currentProfile.personal.lastName}</strong><br>
            <span style="color: #94A3B8;">${this.currentProfile.personal.email}</span>
          `;
        }
        this.populateFields(this.currentProfile);
      } else {
        if (authStatusEl) {
          authStatusEl.textContent = 'Not Signed In';
        }
        if (profileDetailsEl) {
          profileDetailsEl.innerHTML = `<p style="color: #EF4444;">Please sign in to ApplyLab at applylab.io</p>`;
        }
      }
    });
  }

  private populateFields(profile: CandidateProfile): void {
    const setVal = (id: string, val: string) => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el) el.value = val || '';
    };

    setVal('cp-firstName', profile.personal.firstName);
    setVal('cp-lastName', profile.personal.lastName);
    setVal('cp-email', profile.personal.email);
    setVal('cp-phone', formatAustralianPhone(profile.personal.phone, 'national'));
    setVal('cp-workRights', resolveWorkRightsAnswer(profile, 'citizenship'));
    setVal('cp-notice', profile.preferences.noticePeriodDescription);
    setVal('cp-salary', `$${profile.preferences.expectedSalaryAnnualAUD.toLocaleString()}`);

    const resumeNameEl = document.getElementById('resume-name');
    if (resumeNameEl) {
      resumeNameEl.textContent = profile.activeResumeName || 'Tailored Resume.pdf';
    }

    const btnDownload = document.getElementById('btn-download-pdf');
    if (btnDownload) {
      btnDownload.onclick = () => {
        if (!profile.activeResumeId) return;
        chrome.runtime.sendMessage(
          { type: 'FETCH_RESUME_PDF', payload: { resumeId: profile.activeResumeId } },
          (res: ExtensionResponse<{ pdfArrayBuffer: number[]; fileName: string }>) => {
            if (res.success && res.data) {
              const blob = new Blob([new Uint8Array(res.data.pdfArrayBuffer)], { type: 'application/pdf' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = res.data.fileName || 'Resume.pdf';
              a.click();
              URL.revokeObjectURL(url);
            }
          }
        );
      };
    }
  }

  private setupCopyButtons(): void {
    const copyBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.btn-copy'));
    for (const btn of copyBtns) {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        if (!targetId) return;
        const input = document.getElementById(targetId) as HTMLInputElement | null;
        if (input && input.value) {
          navigator.clipboard.writeText(input.value);
          const orig = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = orig; }, 1500);
        }
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new SidePanelApp();
  app.init();
});
