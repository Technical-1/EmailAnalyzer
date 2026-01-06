import JSZip from 'jszip';
import type { Email } from '../types';
import { mboxParser, type EmailBatchCallback } from './mboxParser';

/**
 * Parser for Google Takeout email archives
 * Handles the specific ZIP structure from Google Takeout
 * 
 * Optimized for large files:
 * - Sequential MBOX processing to reduce memory pressure
 * - Explicit cleanup between files to allow garbage collection
 * - Streaming batch processing for each MBOX file
 */
class GmailTakeoutParser {
  /**
   * Parse a Gmail Takeout ZIP file with streaming support
   * Processes MBOX files sequentially and calls onBatch for each batch of emails
   */
  async parseGmailTakeoutStreaming(
    file: File,
    onProgress?: (progress: number, message: string) => void,
    onBatch?: EmailBatchCallback
  ): Promise<number> {
    let totalEmailsParsed = 0;
    let globalBatchNumber = 0;
    const seenEmailKeys = new Set<string>();

    onProgress?.(0, 'Opening Gmail Takeout archive...');

    const zip = await JSZip.loadAsync(file);
    
    // Find all MBOX files in the archive
    const mboxFiles: string[] = [];
    
    zip.forEach((path, zipEntry) => {
      if (
        !zipEntry.dir &&
        (path.endsWith('.mbox') || path.includes('Takeout/Mail/'))
      ) {
        mboxFiles.push(path);
      }
    });

    onProgress?.(10, `Found ${mboxFiles.length} mail folders`);

    if (mboxFiles.length === 0) {
      throw new Error(
        'No email archives found in this Takeout file. Make sure you selected Mail data during export.'
      );
    }

    // Process MBOX files SEQUENTIALLY (not in parallel) to reduce memory pressure
    for (let fileIndex = 0; fileIndex < mboxFiles.length; fileIndex++) {
      const mboxPath = mboxFiles[fileIndex];
      
      try {
        const zipEntry = zip.file(mboxPath);
        if (!zipEntry) continue;

        // Extract folder name from path
        const folderName = this.extractFolderName(mboxPath);

        onProgress?.(
          10 + ((fileIndex + 0.5) / mboxFiles.length) * 80,
          `Processing ${folderName} (${fileIndex + 1}/${mboxFiles.length})...`
        );

        // Get file content - this is the memory-intensive part
        let content = await zipEntry.async('string');
        
        // Create a File object from the content
        const mboxFile = new File([content], `${folderName}.mbox`, {
          type: 'application/mbox',
        });

        // Clear the content string to free memory before parsing
        // @ts-expect-error - intentionally reassigning to help GC
        content = null;

        // Parse using streaming MBOX parser with deduplication
        const folderMappedBatchCallback: EmailBatchCallback = async (emails, batchNumber) => {
          // Deduplicate and add folder ID
          const uniqueEmails: Omit<Email, 'id'>[] = [];
          
          for (const email of emails) {
            const key = email.threadId || 
              `${email.subject}|${email.sender}|${email.date.getTime()}`;
            
            if (!seenEmailKeys.has(key)) {
              seenEmailKeys.add(key);
              uniqueEmails.push({
                ...email,
                folderId: this.mapGmailFolderToId(folderName),
              });
            }
          }

          if (uniqueEmails.length > 0 && onBatch) {
            await onBatch(uniqueEmails, globalBatchNumber);
            globalBatchNumber++;
          }
          
          totalEmailsParsed += uniqueEmails.length;
        };

        // Use streaming parser
        await mboxParser.parseMBOXFileStreaming(
          mboxFile,
          (progress, message) => {
            // Combine progress from individual file with overall progress
            const baseProgress = 10 + (fileIndex / mboxFiles.length) * 80;
            const fileContribution = (80 / mboxFiles.length) * (progress / 100);
            onProgress?.(
              Math.round(baseProgress + fileContribution),
              `${folderName}: ${message}`
            );
          },
          folderMappedBatchCallback
        );

        // Update progress after each file
        onProgress?.(
          10 + ((fileIndex + 1) / mboxFiles.length) * 80,
          `Completed ${folderName} (${fileIndex + 1}/${mboxFiles.length})`
        );

        // Yield to allow garbage collection between files
        await new Promise(resolve => setTimeout(resolve, 10));

      } catch (error) {
        console.warn(`Failed to parse ${mboxPath}:`, error);
      }
    }

    onProgress?.(100, `Imported ${totalEmailsParsed} unique emails`);

    return totalEmailsParsed;
  }

  /**
   * Parse a Gmail Takeout ZIP file (legacy method for backwards compatibility)
   * For large files, prefer parseGmailTakeoutStreaming
   */
  async parseGmailTakeout(
    file: File,
    onProgress?: (progress: number, message: string) => void
  ): Promise<Omit<Email, 'id'>[]> {
    const emails: Omit<Email, 'id'>[] = [];

    await this.parseGmailTakeoutStreaming(
      file,
      onProgress,
      async (batch) => {
        emails.push(...batch);
      }
    );

    return emails;
  }

  /**
   * Extract folder name from file path
   */
  private extractFolderName(path: string): string {
    // Gmail Takeout structure: Takeout/Mail/Label Name.mbox
    const parts = path.split('/');
    const fileName = parts[parts.length - 1];
    return fileName.replace('.mbox', '').replace(/_/g, ' ');
  }

  /**
   * Map Gmail folder names to standard folder IDs
   */
  private mapGmailFolderToId(folderName: string): string {
    const lowerName = folderName.toLowerCase();

    // Standard Gmail folders
    if (lowerName.includes('inbox')) return 'inbox';
    if (lowerName.includes('sent')) return 'sent';
    if (lowerName.includes('draft')) return 'drafts';
    if (lowerName.includes('trash') || lowerName.includes('deleted'))
      return 'trash';
    if (lowerName.includes('spam') || lowerName.includes('junk')) return 'spam';
    if (lowerName.includes('archive') || lowerName === 'all mail')
      return 'archive';
    if (lowerName.includes('starred') || lowerName.includes('important'))
      return 'starred';

    // Custom labels become custom folders
    return `gmail-${folderName.toLowerCase().replace(/\s+/g, '-')}`;
  }

  /**
   * Deduplicate emails based on message ID or subject+sender+date
   * @deprecated Use streaming parser with inline deduplication instead
   */
  private deduplicateEmails(emails: Omit<Email, 'id'>[]): Omit<Email, 'id'>[] {
    const seen = new Map<string, Omit<Email, 'id'>>();

    for (const email of emails) {
      // Create unique key
      const key =
        email.threadId ||
        `${email.subject}|${email.sender}|${email.date.getTime()}`;

      if (!seen.has(key)) {
        seen.set(key, email);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Check if a file is a Gmail Takeout archive
   */
  isGmailTakeout(file: File): boolean {
    return (
      file.type === 'application/zip' ||
      file.name.endsWith('.zip') ||
      file.name.toLowerCase().includes('takeout')
    );
  }

  /**
   * Validate Gmail Takeout structure
   */
  async validateTakeout(file: File): Promise<{
    valid: boolean;
    message: string;
    folderCount?: number;
  }> {
    try {
      const zip = await JSZip.loadAsync(file);
      let mboxCount = 0;

      zip.forEach((path) => {
        if (path.endsWith('.mbox') || path.includes('Takeout/Mail/')) {
          mboxCount++;
        }
      });

      if (mboxCount === 0) {
        return {
          valid: false,
          message:
            'No email data found. Make sure you exported Mail data from Google Takeout.',
        };
      }

      return {
        valid: true,
        message: `Found ${mboxCount} mail folders ready to import`,
        folderCount: mboxCount,
      };
    } catch (error) {
      return {
        valid: false,
        message: 'Could not read the archive. Make sure it is a valid ZIP file.',
      };
    }
  }
}

export const gmailTakeoutParser = new GmailTakeoutParser();
