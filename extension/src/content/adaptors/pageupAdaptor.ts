import { BaseAdaptor, FillStepResult } from './baseAdaptor';
import { CandidateProfile } from '../../types/profile';
import { FieldDispatcher } from '../fieldDispatcher';
import { formatAustralianPhone, resolveWorkRightsAnswer, AU_REGEX_DICTIONARY } from '../../utils/australianTaxonomy';
import { DomUtils } from '../../utils/domUtils';

export class PageupAdaptor implements BaseAdaptor {
  name = 'PageUp Enterprise AU';

  isMatched(): boolean {
    return window.location.hostname.includes('pageuppeople.com') && 
      !!document.querySelector('#job-application-form, form[action*="pageup"], form');
  }

  async autofillCurrentStep(profile: CandidateProfile): Promise<FillStepResult> {
    let filledCount = 0;
    const errors: string[] = [];

    // 1. Personal Details
    const firstName = document.querySelector<HTMLInputElement>('input[id*="FirstName"], input[name*="FirstName"]');
    if (firstName) {
      FieldDispatcher.setInputValue(firstName, profile.personal.firstName);
      filledCount++;
    }

    const lastName = document.querySelector<HTMLInputElement>('input[id*="LastName"], input[name*="LastName"]');
    if (lastName) {
      FieldDispatcher.setInputValue(lastName, profile.personal.lastName);
      filledCount++;
    }

    const email = document.querySelector<HTMLInputElement>('input[id*="Email"], input[name*="Email"]');
    if (email) {
      FieldDispatcher.setInputValue(email, profile.personal.email);
      filledCount++;
    }

    const phone = document.querySelector<HTMLInputElement>('input[id*="Mobile"], input[id*="Phone"], input[name*="Phone"]');
    if (phone) {
      FieldDispatcher.setInputValue(phone, formatAustralianPhone(profile.personal.phone, 'national'));
      filledCount++;
    }

    // 2. Suburb / Postcode
    const suburb = document.querySelector<HTMLInputElement>('input[id*="City"], input[id*="Suburb"]');
    if (suburb) {
      FieldDispatcher.setInputValue(suburb, profile.personal.suburb);
      filledCount++;
    }

    const stateSelect = document.querySelector<HTMLSelectElement>('select[id*="State"]');
    if (stateSelect) {
      FieldDispatcher.setSelectOption(stateSelect, profile.personal.state);
      filledCount++;
    }

    const postcode = document.querySelector<HTMLInputElement>('input[id*="Postcode"]');
    if (postcode) {
      FieldDispatcher.setInputValue(postcode, profile.personal.postcode);
      filledCount++;
    }

    // 3. Work Rights Select / Radio
    const selects = Array.from(document.querySelectorAll<HTMLSelectElement>('select'));
    for (const sel of selects) {
      const label = DomUtils.getFieldLabelText(sel);
      if (AU_REGEX_DICTIONARY.citizenship.test(label)) {
        const answer = resolveWorkRightsAnswer(profile, label);
        FieldDispatcher.setSelectOption(sel, answer);
        filledCount++;
      }
    }

    return { filledCount, errors };
  }
}
