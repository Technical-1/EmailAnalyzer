import type { Attachment } from '../types';

/**
 * Service for handling email attachments
 */
class AttachmentService {
  /**
   * Get MIME type category for display
   */
  getAttachmentType(mimeType: string): 'image' | 'pdf' | 'document' | 'audio' | 'video' | 'other' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.includes('document') || mimeType.includes('word') || mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'document';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('video/')) return 'video';
    return 'other';
  }

  /**
   * Check if attachment can be previewed
   */
  canPreview(attachment: Attachment): boolean {
    const type = this.getAttachmentType(attachment.mimeType);
    return type === 'image' || type === 'pdf';
  }

  /**
   * Get file extension from filename
   */
  getExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
  }

  /**
   * Format file size for display
   */
  formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Create a data URL from base64 data
   */
  createDataUrl(data: string, mimeType: string): string {
    return `data:${mimeType};base64,${data}`;
  }

  /**
   * Create a blob from base64 data
   */
  createBlob(data: string, mimeType: string): Blob {
    const byteCharacters = atob(data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  /**
   * Download an attachment
   */
  downloadAttachment(attachment: Attachment): void {
    if (!attachment.data) {
      console.error('No attachment data available');
      return;
    }

    const blob = this.createBlob(attachment.data, attachment.mimeType);
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  /**
   * Get icon name for attachment type
   */
  getIconName(mimeType: string): string {
    const type = this.getAttachmentType(mimeType);
    switch (type) {
      case 'image': return 'image';
      case 'pdf': return 'file-text';
      case 'document': return 'file-text';
      case 'audio': return 'music';
      case 'video': return 'video';
      default: return 'file';
    }
  }

  /**
   * Get preview URL for an image attachment
   */
  getImagePreviewUrl(attachment: Attachment): string | null {
    if (!attachment.data) return null;
    if (!attachment.mimeType.startsWith('image/')) return null;
    return this.createDataUrl(attachment.data, attachment.mimeType);
  }

  /**
   * Get supported image types
   */
  getSupportedImageTypes(): string[] {
    return ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  }

  /**
   * Check if MIME type is a supported image
   */
  isSupportedImage(mimeType: string): boolean {
    return this.getSupportedImageTypes().includes(mimeType);
  }

  /**
   * Download a file with given data
   */
  download(filename: string, mimeType: string, data: string): void {
    const blob = this.createBlob(data, mimeType);
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  /**
   * Download multiple attachments as a ZIP file
   */
  async downloadMultiple(attachments: { filename: string; mimeType: string; data?: string }[]): Promise<void> {
    // Dynamic import of JSZip to avoid issues if not all attachments have data
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    for (const att of attachments) {
      if (att.data) {
        const blob = this.createBlob(att.data, att.mimeType);
        zip.file(att.filename, blob);
      }
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `attachments-${Date.now()}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }
}

export const attachmentService = new AttachmentService();

