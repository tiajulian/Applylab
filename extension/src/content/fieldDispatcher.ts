import { DomUtils } from '../utils/domUtils';

export class FieldDispatcher {
  /**
   * Sets value on React / Vue / Angular controlled text inputs and triggers change pipelines
   */
  static setInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
    element.focus();
    
    // Prototype setter trick to bypass React 16/17/18 synthetic property overrides
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    
    if (nativeSetter) {
      nativeSetter.call(element, value);
    } else {
      element.value = value;
    }

    element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
  }

  /**
   * Selects standard native <select> options by value or fuzzy text
   */
  static setSelectOption(element: HTMLSelectElement, targetText: string): boolean {
    element.focus();
    const options = Array.from(element.options);
    const match = options.find(opt => 
      opt.text.toLowerCase().includes(targetText.toLowerCase()) || 
      opt.value.toLowerCase().includes(targetText.toLowerCase())
    );

    if (match) {
      element.value = match.value;
      element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      element.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
      return true;
    }
    return false;
  }

  /**
   * Interacts with Workday / LinkedIn / PageUp custom ARIA comboboxes and virtual listboxes
   */
  static async setComboboxValue(
    triggerElement: HTMLElement, 
    queryText: string, 
    popupContainerSelector: string = '[role="listbox"], [role="menu"], ul.dropdown-menu, div[class*="select-options"]'
  ): Promise<boolean> {
    triggerElement.focus();
    triggerElement.click();

    // If the trigger has an internal input, type into it
    const searchInput = triggerElement.tagName === 'INPUT' 
      ? (triggerElement as HTMLInputElement) 
      : triggerElement.querySelector<HTMLInputElement>('input');

    if (searchInput) {
      FieldDispatcher.setInputValue(searchInput, queryText);
    }

    // Wait up to 2 seconds for the listbox popup to render
    const popup = await DomUtils.waitForElement(popupContainerSelector, 2000);
    if (!popup) return false;

    // Find matching option item
    const options = Array.from(popup.querySelectorAll<HTMLElement>('[role="option"], li, button, div[class*="option"]'));
    const matchedOption = options.find(opt => 
      (opt.textContent || '').trim().toLowerCase().includes(queryText.toLowerCase())
    );

    if (matchedOption) {
      matchedOption.scrollIntoView({ block: 'nearest' });
      matchedOption.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      matchedOption.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      matchedOption.click();
      return true;
    }

    return false;
  }

  /**
   * Sets radio / checkbox states including ARIA custom buttons
   */
  static setRadioOrCheckbox(element: HTMLElement, shouldBeChecked: boolean = true): void {
    element.focus();
    if (element instanceof HTMLInputElement && (element.type === 'radio' || element.type === 'checkbox')) {
      if (element.checked !== shouldBeChecked) {
        element.checked = shouldBeChecked;
        element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      }
    } else {
      // ARIA custom radio/checkbox
      element.click();
      element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    }
  }
}
