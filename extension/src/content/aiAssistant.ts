import { FieldDispatcher } from './fieldDispatcher';
import { JobScraper } from './jobScraper';
import { ExtensionMessage, ExtensionResponse } from '../types/messages';

export class AiAssistant {
  private static processedTextareas = new WeakSet<HTMLTextAreaElement>();

  static attachInlineButtons(): void {
    const textareas = Array.from(document.querySelectorAll<HTMLTextAreaElement>('textarea'));
    
    for (const textarea of textareas) {
      if (this.processedTextareas.has(textarea)) continue;
      
      // Skip very small search inputs or short textareas
      if (textarea.rows === 1 && textarea.offsetHeight < 40) continue;

      this.processedTextareas.add(textarea);
      this.renderSuggestButton(textarea);
    }
  }

  private static renderSuggestButton(textarea: HTMLTextAreaElement): void {
    const parent = textarea.parentElement;
    if (!parent) return;

    // Ensure parent container has positioning
    if (getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'applylab-ai-suggest-btn';
    btn.innerHTML = '🪄 ApplyLab AI Suggest';
    btn.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-top: 6px;
      padding: 4px 10px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11px;
      font-weight: 600;
      color: #FFFFFF;
      background: linear-gradient(135deg, #E86D3B 0%, #D05B2A 100%);
      border: none;
      border-radius: 6px;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
      transition: opacity 0.2s, transform 0.1s;
      z-index: 10;
    `;

    btn.addEventListener('mouseenter', () => { btn.style.opacity = '0.9'; });
    btn.addEventListener('mouseleave', () => { btn.style.opacity = '1.0'; });
    
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '✨ Generating answer...';

      try {
        const questionText = this.deriveQuestionText(textarea);
        const job = JobScraper.extract();

        const message: ExtensionMessage = {
          type: 'GENERATE_AI_ANSWER',
          payload: {
            question: questionText,
            jobTitle: job.jobTitle,
            jobDescriptionSnippet: `${job.jobTitle} at ${job.companyName} in ${job.location}`,
            format: 'STAR_METHOD',
            wordLimit: 150
          }
        };

        const response: ExtensionResponse<{ suggestedAnswer: string }> = await new Promise((resolve) => {
          chrome.runtime.sendMessage(message, (res) => {
            resolve(res || { success: false, error: 'No response from background worker' });
          });
        });

        if (response.success && response.data?.suggestedAnswer) {
          FieldDispatcher.setInputValue(textarea, response.data.suggestedAnswer);
          btn.innerHTML = '✅ Answer Inserted!';
          setTimeout(() => { btn.innerHTML = originalText; btn.disabled = false; }, 3000);
        } else {
          btn.innerHTML = `⚠️ ${response.error || 'Generation failed'}`;
          setTimeout(() => { btn.innerHTML = originalText; btn.disabled = false; }, 3000);
        }
      } catch (err) {
        console.error('[ApplyLab] AI Answer Generation Error:', err);
        btn.innerHTML = '⚠️ Error generating';
        setTimeout(() => { btn.innerHTML = originalText; btn.disabled = false; }, 3000);
      }
    });

    parent.appendChild(btn);
  }

  private static deriveQuestionText(textarea: HTMLTextAreaElement): string {
    const parent = textarea.closest('div, fieldset, label, [class*="field"], [class*="group"]');
    if (parent) {
      const label = parent.querySelector('label, legend, [class*="label"], [class*="title"], h2, h3, h4');
      if (label && label.textContent) {
        return label.textContent.trim();
      }
    }
    return textarea.placeholder || textarea.name || 'Job application screening question';
  }
}
