import JSZip from 'jszip';
import type { Email } from '../types';
import { mboxParser } from './mboxParser';

/**
 * Parser for Google Takeout email archives
 * Handles the specific ZIP structure from Google Takeout
 */
class GmailTakeoutParser {
  /**
   * Parse a Gmail Takeout ZIP file
   */
  async parseGmailTakeout(
    file: File,
    onProgress?: (progress: number, message: string) => void
  ): Promise<Omit<Email, 'id'>[]> {
    const emails: Omit<Email, 'id'>[] = [];

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

    let processedFiles = 0;

    for (const mboxPath of mboxFiles) {
      try {
        const zipEntry = zip.file(mboxPath);
        if (!zipEntry) continue;

        // Extract folder name from path
        const folderName = this.extractFolderName(mboxPath);

        onProgress?.(
          10 + (processedFiles / mboxFiles.length) * 80,
          `Processing ${folderName}...`
        );

        // Get file content
        const content = await zipEntry.async('string');
        
        // Create a File object from the content
        const mboxFile = new File([content], `${folderName}.mbox`, {
          type: 'application/mbox',
        });

        // Parse using MBOX parser
        const parsedEmails = await mboxParser.parseMBOXFile(mboxFile);

        // Set folder ID based on Gmail labels
        const mappedEmails = parsedEmails.map((email) => ({
          ...email,
          folderId: this.mapGmailFolderToId(folderName),
        }));

        emails.push(...mappedEmails);
        processedFiles++;
      } catch (error) {
        console.warn(`Failed to parse ${mboxPath}:`, error);
      }
    }

    onProgress?.(95, 'Processing complete, finalizing...');

    // Deduplicate emails by message ID or subject+date combo
    const uniqueEmails = this.deduplicateEmails(emails);

    onProgress?.(100, `Imported ${uniqueEmails.length} unique emails`);

    return uniqueEmails;
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

