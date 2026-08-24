import { BaseAdaptor, FillStepResult } from './baseAdaptor';
import { CandidateProfile } from '../../types/profile';
import { FieldDispatcher } from '../fieldDispatcher';
import { formatAustralianPhone, AU_REGEX_DICTIONARY } from '../../utils/australianTaxonomy';
import { DomUtils } from '../../utils/domUtils';

export class LinkedinAdaptor implements BaseAdaptor {
  name = 'LinkedIn Easy Apply';

  isMatched(): boolean {
    return window.location.hostname.includes('linkedin.com') && 
      !!document.querySelector('.jobs-easy-apply-modal, [data-test-modal-id="easy-apply-modal"]');
  }

  async autofillCurrentStep(profile: CandidateProfile): Promise<FillStepResult> {
    let filledCount = 0;
    const errors: string[] = [];

    const modal = document.querySelector('.jobs-easy-apply-modal, [data-test-modal-id="easy-apply-modal"]');
    if (!modal) return { filledCount: 0, errors: ['Modal not found'] };

    // 1. Phone number
    const phoneInput = modal.querySelector<HTMLInputElement>('input[id*="phoneNumber"], input[name*="phoneNumber"]');
    if (phoneInput) {
      FieldDispatcher.setInputValue(phoneInput, formatAustralianPhone(profile.personal.phone, 'national'));
      filledCount++;
    }

    // 2. Email dropdown / input
    const emailSelect = modal.querySelector<HTMLSelectElement>('select[id*="email"]');
    if (emailSelect) {
      FieldDispatcher.setSelectOption(emailSelect, profile.personal.email);
      filledCount++;
    }

    // 3. Work rights radio / select buttons
    const fieldsets = Array.from(modal.querySelectorAll('fieldset'));
    for (const fs of fieldsets) {
      const legend = fs.querySelector('legend')?.textContent || '';
      if (AU_REGEX_DICTIONARY.citizenship.test(legend)) {
        const targetRadio = Array.from(fs.querySelectorAll<HTMLInputElement>('input[type="radio"]')).find(r => {
          const val = (r.value || r.nextElementSibling?.textContent || '').toLowerCase();
          return profile.workRights.hasUnrestrictedWorkRights ? val.includes('yes') : val.includes('no');
        });
        if (targetRadio) {
          FieldDispatcher.setRadioOrCheckbox(targetRadio, true);
          filledCount++;
        }
      } else if (AU_REGEX_DICTIONARY.sponsorship.test(legend)) {
        const targetRadio = Array.from(fs.querySelectorAll<HTMLInputElement>('input[type="radio"]')).find(r => {
          const val = (r.value || r.nextElementSibling?.textContent || '').toLowerCase();
          return profile.workRights.requiresSponsorshipNowOrFuture ? val.includes('yes') : val.includes('no');
        });
        if (targetRadio) {
          FieldDispatcher.setRadioOrCheckbox(targetRadio, true);
          filledCount++;
        }
      } else if (AU_REGEX_DICTIONARY.driversLicence.test(legend)) {
        const targetRadio = Array.from(fs.querySelectorAll<HTMLInputElement>('input[type="radio"]')).find(r => {
          const val = (r.value || r.nextElementSibling?.textContent || '').toLowerCase();
          return profile.preferences.hasAustralianDriversLicence ? val.includes('yes') : val.includes('no');
        });
        if (targetRadio) {
          FieldDispatcher.setRadioOrCheckbox(targetRadio, true);
          filledCount++;
        }
      }
    }

    // 4. Text inputs for years of experience or salary
    const inputs = Array.from(modal.querySelectorAll<HTMLInputElement>('input[type="text"], input[type="number"]'));
    for (const input of inputs) {
      const label = DomUtils.getFieldLabelText(input);
      if (/years of experience/i.test(label) || /how many years/i.test(label)) {
        FieldDispatcher.setInputValue(input, String(profile.experienceSummary.yearsOfExperience));
        filledCount++;
      } else if (AU_REGEX_DICTIONARY.noticePeriod.test(label)) {
        FieldDispatcher.setInputValue(input, profile.preferences.noticePeriodDescription);
        filledCount++;
      }
    }

    return { filledCount, errors };
  }
}
