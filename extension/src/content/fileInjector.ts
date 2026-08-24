export class FileInjector {
  /**
   * Attaches a PDF Blob directly into host page <input type="file"> via DataTransfer API
   */
  static injectFile(inputElement: HTMLInputElement, pdfBlob: Blob, fileName: string): boolean {
    try {
      const file = new File([pdfBlob], fileName, { 
        type: 'application/pdf',
        lastModified: Date.now() 
      });

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      inputElement.files = dataTransfer.files;

      // Dispatch change event pipeline for file upload handlers
      inputElement.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      inputElement.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      
      return true;
    } catch (err) {
      console.error('[ApplyLab] Failed to inject file via DataTransfer:', err);
      return false;
    }
  }

  /**
   * Fallback for dropzone drag-and-drop targets that don't expose a direct input element
   */
  static simulateDrop(dropzoneElement: HTMLElement, pdfBlob: Blob, fileName: string): void {
    const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);

    const dragEnter = new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer });
    const dragOver = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer });
    const drop = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer });

    dropzoneElement.dispatchEvent(dragEnter);
    dropzoneElement.dispatchEvent(dragOver);
    dropzoneElement.dispatchEvent(drop);
  }
}
