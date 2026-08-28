import { AuthManager } from './authManager';
import { CandidateProfile } from '../types/profile';
import { GenerateAiAnswerPayload, ExtensionResponse } from '../types/messages';
import { CreateApplicationPayload } from '../types/application';

export class ApiGateway {
  // Support both production deployment and local dev server
  private static getBaseUrl(): string {
    return 'https://applylab.io';
  }

  private static async getHeaders(): Promise<HeadersInit> {
    const token = await AuthManager.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  static async fetchProfile(): Promise<ExtensionResponse<CandidateProfile>> {
    try {
      const baseUrl = ApiGateway.getBaseUrl();
      const headers = await ApiGateway.getHeaders();
      const response = await fetch(`${baseUrl}/api/user/autofill-profile`, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, error: 'Unauthorized. Please sign in to ApplyLab.' };
        }
        return { success: false, error: `Failed to fetch profile: ${response.statusText}` };
      }

      const data = await response.json();
      return { success: true, data: data.profile || data };
    } catch (err) {
      console.error('[ApiGateway] fetchProfile error:', err);
      return { success: false, error: 'Network error connecting to ApplyLab servers.' };
    }
  }

  static async generateAiAnswer(payload: GenerateAiAnswerPayload): Promise<ExtensionResponse<{ suggestedAnswer: string }>> {
    try {
      const baseUrl = ApiGateway.getBaseUrl();
      const headers = await ApiGateway.getHeaders();
      const response = await fetch(`${baseUrl}/api/copilot/generate-answer`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        credentials: 'include'
      });

      if (!response.ok) {
        return { success: false, error: `AI generation failed: ${response.statusText}` };
      }

      const data = await response.json();
      return { success: true, data: { suggestedAnswer: data.suggestedAnswer } };
    } catch (err) {
      console.error('[ApiGateway] generateAiAnswer error:', err);
      return { success: false, error: 'Failed to generate AI screening answer.' };
    }
  }

  static async fetchResumePdf(resumeId: string): Promise<ExtensionResponse<{ pdfArrayBuffer: number[]; fileName: string }>> {
    try {
      const baseUrl = ApiGateway.getBaseUrl();
      const headers = await ApiGateway.getHeaders();
      const response = await fetch(`${baseUrl}/api/resumes/${resumeId}/pdf-blob`, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      if (!response.ok) {
        return { success: false, error: `PDF download failed: ${response.statusText}` };
      }

      const buffer = await response.arrayBuffer();
      const bytes = Array.from(new Uint8Array(buffer));
      const contentDisposition = response.headers.get('Content-Disposition') || '';
      const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
      const fileName = fileNameMatch ? fileNameMatch[1] : 'Resume.pdf';

      return { success: true, data: { pdfArrayBuffer: bytes, fileName } };
    } catch (err) {
      console.error('[ApiGateway] fetchResumePdf error:', err);
      return { success: false, error: 'Failed to download resume PDF.' };
    }
  }

  static async logKanban(payload: CreateApplicationPayload): Promise<ExtensionResponse> {
    try {
      const baseUrl = ApiGateway.getBaseUrl();
      const headers = await ApiGateway.getHeaders();
      const response = await fetch(`${baseUrl}/api/applications`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          company_name: payload.companyName,
          job_title: payload.jobTitle,
          job_url: payload.jobUrl,
          status: payload.status || 'applied',
          notes: `Logged via ApplyLab Co-Pilot on ${payload.platform}`
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        return { success: false, error: `Kanban log failed: ${response.statusText}` };
      }

      return { success: true };
    } catch (err) {
      console.error('[ApiGateway] logKanban error:', err);
      return { success: false, error: 'Failed to log application to Kanban.' };
    }
  }
}
