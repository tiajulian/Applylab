import { CandidateProfile } from '../types/profile';
import { BaseAdaptor, FillStepResult } from './adaptors/baseAdaptor';
import { SeekAdaptor } from './adaptors/seekAdaptor';
import { LinkedinAdaptor } from './adaptors/linkedinAdaptor';
import { WorkdayAdaptor } from './adaptors/workdayAdaptor';
import { PageupAdaptor } from './adaptors/pageupAdaptor';
import { LivehireAdaptor } from './adaptors/livehireAdaptor';
import { FieldDispatcher } from './fieldDispatcher';
import { FileInjector } from './fileInjector';
import { formatAustralianPhone, resolveWorkRightsAnswer, AU_REGEX_DICTIONARY } from '../utils/australianTaxonomy';
import { DomUtils } from '../utils/domUtils';

export class FormEngine {
  private adaptors: BaseAdaptor[] = [
    new SeekAdaptor(),
    new LinkedinAdaptor(),
    new WorkdayAdaptor(),
    new PageupAdaptor(),
    new LivehireAdaptor()
  ];

  getActiveAdaptor(): BaseAdaptor | null {
    return this.adaptors.find(a => a.isMatched()) || null;
  }

  countFillableFields(): number {
    const inputs = DomUtils.queryAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input:not([type="hidden"]), select, textarea');
    return inputs.filter(el => !el.disabled && el.offsetParent !== null).length;
  }

  async autofill(profile: CandidateProfile): Promise<FillStepResult> {
    const adaptor = this.getActiveAdaptor();
    if (adaptor) {
      console.log(`[ApplyLab] Using portal adaptor: ${adaptor.name}`);
      return await adaptor.autofillCurrentStep(profile);
    }

    // Generic Fallback Autofill for unlisted Australian job portals
    console.log('[ApplyLab] Using generic ATS fallback autofill');
    let filledCount = 0;
    const errors: string[] = [];

    const elements = DomUtils.queryAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea');
    for (const el of elements) {
      if (el.disabled || el.offsetParent === null) continue;
      const label = DomUtils.getFieldLabelText(el);

      if (el instanceof HTMLInputElement) {
        if (AU_REGEX_DICTIONARY.firstName.test(label)) {
          FieldDispatcher.setInputValue(el, profile.personal.firstName);
          filledCount++;
        } else if (AU_REGEX_DICTIONARY.lastName.test(label)) {
          FieldDispatcher.setInputValue(el, profile.personal.lastName);
          filledCount++;
        } else if (AU_REGEX_DICTIONARY.email.test(label)) {
          FieldDispatcher.setInputValue(el, profile.personal.email);
          filledCount++;
        } else if (AU_REGEX_DICTIONARY.phone.test(label)) {
          FieldDispatcher.setInputValue(el, formatAustralianPhone(profile.personal.phone, 'national'));
          filledCount++;
        } else if (AU_REGEX_DICTIONARY.suburb.test(label)) {
          FieldDispatcher.setInputValue(el, profile.personal.suburb);
          filledCount++;
        } else if (AU_REGEX_DICTIONARY.postcode.test(label)) {
          FieldDispatcher.setInputValue(el, profile.personal.postcode);
          filledCount++;
        } else if (AU_REGEX_DICTIONARY.linkedinUrl.test(label)) {
          FieldDispatcher.setInputValue(el, profile.personal.linkedinUrl);
          filledCount++;
        }
      } else if (el instanceof HTMLSelectElement) {
        if (AU_REGEX_DICTIONARY.citizenship.test(label)) {
          const answer = resolveWorkRightsAnswer(profile, label);
          FieldDispatcher.setSelectOption(el, answer);
          filledCount++;
        } else if (AU_REGEX_DICTIONARY.state.test(label)) {
          FieldDispatcher.setSelectOption(el, profile.personal.state);
          filledCount++;
        } else if (AU_REGEX_DICTIONARY.noticePeriod.test(label)) {
          FieldDispatcher.setSelectOption(el, profile.preferences.noticePeriodDescription);
          filledCount++;
        }
      }
    }

    return { filledCount, errors };
  }

  async attachResumePdf(pdfBlob: Blob, fileName: string): Promise<boolean> {
    const fileInputs = DomUtils.queryAll<HTMLInputElement>('input[type="file"]');
    if (fileInputs.length > 0) {
      // Pick first resume/CV file input or first generic file input
      const cvInput = fileInputs.find(i => {
        const label = DomUtils.getFieldLabelText(i);
        return /resume|cv|attachment/i.test(label) || /resume|cv/i.test(i.name || i.id);
      }) || fileInputs[0];

      return FileInjector.injectFile(cvInput, pdfBlob, fileName);
    }

    // Try dropzone fallback
    const dropzone = DomUtils.query('[class*="dropzone"], [class*="upload-area"], [data-automation*="upload"]');
    if (dropzone) {
      FileInjector.simulateDrop(dropzone, pdfBlob, fileName);
      return true;
    }

    return false;
  }
}
