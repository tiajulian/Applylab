import { BaseAdaptor, FillStepResult } from './baseAdaptor';
import { CandidateProfile } from '../../types/profile';
import { FieldDispatcher } from '../fieldDispatcher';
import { formatAustralianPhone, resolveWorkRightsAnswer, AU_REGEX_DICTIONARY } from '../../utils/australianTaxonomy';
import { DomUtils } from '../../utils/domUtils';

export class SeekAdaptor implements BaseAdaptor {
  name = 'SEEK Quick Apply';

  isMatched(): boolean {
    return window.location.hostname.includes('seek.com.au') && 
      !!document.querySelector('[data-automation="quick-apply-form"], [data-automation="apply-form"], #app-root form, form');
  }

  async autofillCurrentStep(profile: CandidateProfile): Promise<FillStepResult> {
    let filledCount = 0;
    const errors: string[] = [];

    // 1. First & Last Name
    const firstNameInput = document.querySelector<HTMLInputElement>('input[name="firstName"], [data-automation="first-name-input"], #firstName');
    if (firstNameInput) {
      FieldDispatcher.setInputValue(firstNameInput, profile.personal.firstName);
      filledCount++;
    }

    const lastNameInput = document.querySelector<HTMLInputElement>('input[name="lastName"], [data-automation="last-name-input"], #lastName');
    if (lastNameInput) {
      FieldDispatcher.setInputValue(lastNameInput, profile.personal.lastName);
      filledCount++;
    }

    // 2. Email Address
    const emailInput = document.querySelector<HTMLInputElement>('input[name="email"], [data-automation="email-input"], #email');
    if (emailInput) {
      FieldDispatcher.setInputValue(emailInput, profile.personal.email);
      filledCount++;
    }

    // 3. Mobile Phone (SEEK standard format 04xx xxx xxx)
    const phoneInput = document.querySelector<HTMLInputElement>('input[name="phoneNumber"], [data-automation="phone-number-input"], input[type="tel"]');
    if (phoneInput) {
      FieldDispatcher.setInputValue(phoneInput, formatAustralianPhone(profile.personal.phone, 'national'));
      filledCount++;
    }

    // 4. Suburb / Location Autocomplete
    const locationInput = document.querySelector<HTMLInputElement>('input[name="location"], [data-automation="location-input"]');
    if (locationInput) {
      const locationQuery = `${profile.personal.suburb} ${profile.personal.state} ${profile.personal.postcode}`;
      await FieldDispatcher.setComboboxValue(locationInput, locationQuery, '[data-automation="location-dropdown"], [role="listbox"]');
      filledCount++;
    }

    // 5. Working Rights Dropdown / Radio
    const workRightsSelect = document.querySelector<HTMLSelectElement>('select[name="workingRights"], [data-automation="working-rights-dropdown"]');
    if (workRightsSelect) {
      const answer = resolveWorkRightsAnswer(profile, 'working rights');
      FieldDispatcher.setSelectOption(workRightsSelect, answer);
      filledCount++;
    }

    // 6. Generic field mapping fallback for SEEK screening questions
    const allInputs = DomUtils.queryAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea');
    for (const el of allInputs) {
      const label = DomUtils.getFieldLabelText(el);

      if (el.tagName === 'SELECT' && AU_REGEX_DICTIONARY.noticePeriod.test(label)) {
        FieldDispatcher.setSelectOption(el as HTMLSelectElement, profile.preferences.noticePeriodDescription);
        filledCount++;
      } else if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'text' && AU_REGEX_DICTIONARY.salaryExpectation.test(label)) {
        FieldDispatcher.setInputValue(el as HTMLInputElement, `$${profile.preferences.expectedSalaryAnnualAUD.toLocaleString()}`);
        filledCount++;
      }
    }

    return { filledCount, errors };
  }
}
