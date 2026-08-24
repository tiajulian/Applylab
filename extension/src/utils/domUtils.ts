export class DomUtils {
  /**
   * Safely queries an element within document or shadow roots
   */
  static query<T extends HTMLElement = HTMLElement>(selector: string, context: ParentNode = document): T | null {
    return context.querySelector<T>(selector);
  }

  /**
   * Queries all elements matching selector
   */
  static queryAll<T extends HTMLElement = HTMLElement>(selector: string, context: ParentNode = document): T[] {
    return Array.from(context.querySelectorAll<T>(selector));
  }

  /**
   * Polls for an element until found or timeout is reached
   */
  static waitForElement<T extends HTMLElement = HTMLElement>(
    selector: string, 
    timeoutMs: number = 2000, 
    context: ParentNode = document
  ): Promise<T | null> {
    return new Promise((resolve) => {
      const existing = context.querySelector<T>(selector);
      if (existing) return resolve(existing);

      const observer = new MutationObserver(() => {
        const el = context.querySelector<T>(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeoutMs);
    });
  }

  /**
   * Derives associated field label text by inspecting label tags, aria-labels, placeholders, or parent text
   */
  static getFieldLabelText(element: HTMLElement): string {
    const labels: string[] = [];

    // 1. Explicit <label for="id">
    if (element.id) {
      const explicitLabel = document.querySelector(`label[for="${element.id}"]`);
      if (explicitLabel && explicitLabel.textContent) {
        labels.push(explicitLabel.textContent);
      }
    }

    // 2. Parent <label>
    const parentLabel = element.closest('label');
    if (parentLabel && parentLabel.textContent) {
      labels.push(parentLabel.textContent);
    }

    // 3. ARIA label attributes
    const ariaLabel = element.getAttribute('aria-label') || element.getAttribute('aria-labelledby');
    if (ariaLabel) {
      if (element.getAttribute('aria-labelledby')) {
        const labelledByEl = document.getElementById(element.getAttribute('aria-labelledby')!);
        if (labelledByEl?.textContent) labels.push(labelledByEl.textContent);
      } else {
        labels.push(ariaLabel);
      }
    }

    // 4. Placeholder attribute
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      if (element.placeholder) labels.push(element.placeholder);
      if (element.name) labels.push(element.name);
    }

    // 5. Ancestor container text (first legend or heading)
    const fieldset = element.closest('fieldset, [role="group"]');
    if (fieldset) {
      const legend = fieldset.querySelector('legend, [class*="title"], [class*="label"]');
      if (legend?.textContent) labels.push(legend.textContent);
    }

    return labels.join(' ').trim().toLowerCase();
  }

  /**
   * Fuzzy matches text against candidate options
   */
  static fuzzyMatch(candidate: string, target: string): boolean {
    const c = candidate.toLowerCase().trim();
    const t = target.toLowerCase().trim();
    return c.includes(t) || t.includes(c);
  }
}
