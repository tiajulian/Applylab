export class FloatingBar {
  private container: HTMLDivElement | null = null;
  private shadowRoot: ShadowRoot | null = null;

  init(onAutofill: () => void, onAttachResume: () => void, onLogKanban: () => void): void {
    if (this.container) return;

    this.container = document.createElement('div');
    this.container.id = 'applylab-copilot-root';
    this.container.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    this.shadowRoot = this.container.attachShadow({ mode: 'closed' });
    this.render(onAutofill, onAttachResume, onLogKanban);
    document.body.appendChild(this.container);
  }

  updateStatus(fieldCount: number, statusText: string = 'ready to fill'): void {
    if (!this.shadowRoot) return;
    const badge = this.shadowRoot.getElementById('applylab-status-badge');
    if (badge) {
      badge.textContent = `🟢 ${fieldCount} fields ${statusText}`;
    }
  }

  setLoading(isLoading: boolean, actionName: string = 'Autofilling...'): void {
    if (!this.shadowRoot) return;
    const btnAutofill = this.shadowRoot.getElementById('btn-autofill') as HTMLButtonElement | null;
    if (btnAutofill) {
      btnAutofill.disabled = isLoading;
      btnAutofill.textContent = isLoading ? `⏳ ${actionName}` : '⚡ Autofill';
    }
  }

  private render(onAutofill: () => void, onAttachResume: () => void, onLogKanban: () => void): void {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <style>
        .pill-container {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #1E293B;
          color: #F8FAFC;
          padding: 8px 14px;
          border-radius: 9999px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
          border: 1px solid #334155;
          user-select: none;
        }
        .brand-logo {
          font-weight: 700;
          color: #E86D3B;
          font-size: 13px;
          margin-right: 2px;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .badge {
          font-size: 12px;
          color: #94A3B8;
          padding-right: 8px;
          border-right: 1px solid #334155;
          white-space: nowrap;
        }
        .action-btn {
          background: #E86D3B;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 9999px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.1s ease;
          display: flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
        }
        .action-btn:hover { background: #D05B2A; }
        .action-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .secondary-btn {
          background: #334155;
          color: #F8FAFC;
          border: none;
          padding: 6px 10px;
          border-radius: 9999px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s ease;
          white-space: nowrap;
        }
        .secondary-btn:hover { background: #475569; }
      </style>

      <div class="pill-container">
        <span class="brand-logo">🦘 ApplyLab</span>
        <span id="applylab-status-badge" class="badge">🟢 Detecting fields...</span>
        <button id="btn-autofill" class="action-btn">⚡ Autofill</button>
        <button id="btn-attach" class="secondary-btn">📄 Attach PDF</button>
        <button id="btn-kanban" class="secondary-btn">📊 Log to Kanban</button>
      </div>
    `;

    this.shadowRoot.getElementById('btn-autofill')?.addEventListener('click', onAutofill);
    this.shadowRoot.getElementById('btn-attach')?.addEventListener('click', onAttachResume);
    this.shadowRoot.getElementById('btn-kanban')?.addEventListener('click', onLogKanban);
  }
}
