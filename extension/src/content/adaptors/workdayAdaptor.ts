import { BaseAdaptor, FillStepResult } from './baseAdaptor';
import { CandidateProfile } from '../../types/profile';
import { FieldDispatcher } from '../fieldDispatcher';
import { formatAustralianPhone, resolveWorkRightsAnswer, AU_REGEX_DICTIONARY } from '../../utils/australianTaxonomy';
import { DomUtils } from '../../utils/domUtils';

export class WorkdayAdaptor implements BaseAdaptor {
  name = 'Workday Candidate Portal';

  isMatched(): boolean {
    return (window.location.hostname.includes('myworkdayjobs.com') || window.location.hostname.includes('workday.com')) &&
      !!document.querySelector('[data-automation-id="workdayApplication"], [data-automation-id="legalNameSection"], form');
  }

  async autofillCurrentStep(profile: CandidateProfile): Promise<FillStepResult> {
    let filledCount = 0;
    const errors: string[] = [];

    // 1. Legal Name Section
    const firstNameInput = document.querySelector<HTMLInputElement>('[data-automation-id="legalNameSection_firstName"], input[data-automation-id*="firstName"]');
    if (firstNameInput) {
      FieldDispatcher.setInputValue(firstNameInput, profile.personal.firstName);
      filledCount++;
    }

    const lastNameInput = document.querySelector<HTMLInputElement>('[data-automation-id="legalNameSection_lastName"], input[data-automation-id*="lastName"]');
    if (lastNameInput) {
      FieldDispatcher.setInputValue(lastNameInput, profile.personal.lastName);
      filledCount++;
    }

    // 2. Address & Suburb/State
    const streetInput = document.querySelector<HTMLInputElement>('[data-automation-id="addressSection_addressLine1"]');
    if (streetInput) {
      FieldDispatcher.setInputValue(streetInput, profile.personal.streetAddress);
      filledCount++;
    }

    const suburbInput = document.querySelector<HTMLInputElement>('[data-automation-id="addressSection_city"]');
    if (suburbInput) {
      FieldDispatcher.setInputValue(suburbInput, profile.personal.suburb);
      filledCount++;
    }

    const postcodeInput = document.querySelector<HTMLInputElement>('[data-automation-id="addressSection_postalCode"]');
    if (postcodeInput) {
      FieldDispatcher.setInputValue(postcodeInput, profile.personal.postcode);
      filledCount++;
    }

    // Workday State / Region Combobox
    const stateCombobox = document.querySelector<HTMLElement>('[data-automation-id="addressSection_countryRegion"], [data-automation-id="state"]');
    if (stateCombobox) {
      await FieldDispatcher.setComboboxValue(stateCombobox, profile.personal.state, '[role="listbox"]');
      filledCount++;
    }

    // 3. Phone Number & Device Type
    const phoneInput = document.querySelector<HTMLInputElement>('[data-automation-id="phone-number"]');
    if (phoneInput) {
      FieldDispatcher.setInputValue(phoneInput, formatAustralianPhone(profile.personal.phone, 'compact'));
      filledCount++;
    }

    // 4. Custom Comboboxes (Citizenship, How did you hear, etc.)
    const comboboxes = Array.from(document.querySelectorAll<HTMLElement>('[role="combobox"], [data-automation-id*="dropdown"]'));
    for (const combo of comboboxes) {
      const label = DomUtils.getFieldLabelText(combo);
      if (AU_REGEX_DICTIONARY.citizenship.test(label)) {
        const answer = resolveWorkRightsAnswer(profile, label);
        await FieldDispatcher.setComboboxValue(combo, answer, '[role="listbox"]');
        filledCount++;
      } else if (/how did you hear/i.test(label) || /source/i.test(label)) {
        await FieldDispatcher.setComboboxValue(combo, 'LinkedIn', '[role="listbox"]');
        filledCount++;
      }
    }

    return { filledCount, errors };
  }
}
