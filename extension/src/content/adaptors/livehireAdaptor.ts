import { BaseAdaptor, FillStepResult } from './baseAdaptor';
import { CandidateProfile } from '../../types/profile';
import { FieldDispatcher } from '../fieldDispatcher';
import { formatAustralianPhone, resolveWorkRightsAnswer, AU_REGEX_DICTIONARY } from '../../utils/australianTaxonomy';
import { DomUtils } from '../../utils/domUtils';

export class LivehireAdaptor implements BaseAdaptor {
  name = 'LiveHire AU';

  isMatched(): boolean {
    return window.location.hostname.includes('livehire.com') && 
      !!document.querySelector('.livehire-app, form, [class*="application"]');
  }

  async autofillCurrentStep(profile: CandidateProfile): Promise<FillStepResult> {
    let filledCount = 0;
    const errors: string[] = [];

    // 1. Personal Inputs
    const firstName = document.querySelector<HTMLInputElement>('input[name="firstName"], input[id*="firstName"]');
    if (firstName) {
      FieldDispatcher.setInputValue(firstName, profile.personal.firstName);
      filledCount++;
    }

    const lastName = document.querySelector<HTMLInputElement>('input[name="lastName"], input[id*="lastName"]');
    if (lastName) {
      FieldDispatcher.setInputValue(lastName, profile.personal.lastName);
      filledCount++;
    }

    const phone = document.querySelector<HTMLInputElement>('input[type="tel"], input[name*="phone"]');
    if (phone) {
      FieldDispatcher.setInputValue(phone, formatAustralianPhone(profile.personal.phone, 'national'));
      filledCount++;
    }

    // 2. Selects / Radio groups
    const selects = Array.from(document.querySelectorAll<HTMLSelectElement>('select'));
    for (const sel of selects) {
      const label = DomUtils.getFieldLabelText(sel);
      if (AU_REGEX_DICTIONARY.citizenship.test(label)) {
        const answer = resolveWorkRightsAnswer(profile, label);
        FieldDispatcher.setSelectOption(sel, answer);
        filledCount++;
      } else if (AU_REGEX_DICTIONARY.noticePeriod.test(label)) {
        FieldDispatcher.setSelectOption(sel, profile.preferences.noticePeriodDescription);
        filledCount++;
      }
    }

    return { filledCount, errors };
  }
}
