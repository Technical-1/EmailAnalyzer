import JSZip from 'jszip';
import type { Email, Contact, CalendarEvent, OLMProcessingResult, OLMProcessingProgress, Account } from '../types';
import {
  insertEmail,
  insertAccount,
  insertPurchase,
  findDuplicatePurchase,
  insertContact,
  insertCalendarEvent,
  getAccountByServiceName,
  getContactByEmail,
  updateContactEmailCount,
} from '../db/database';
import { accountDetector } from './accountDetector';
import { purchaseDetector } from './purchaseDetector';
import { cleanEmailAddress } from '../utils/emailUtils';

export type ProgressCallback = (progress: OLMProcessingProgress) => void;

class OLMParser {
  async parseOLMFile(file: File, onProgress?: ProgressCallback): Promise<OLMProcessingResult> {
    const result: OLMProcessingResult = {
      emails: 0,
      contacts: 0,
      calendarEvents: 0,
      accounts: 0,
      purchases: 0,
    };

    try {
      // Stage 1: Extract ZIP
      onProgress?.({
        stage: 'extracting',
        progress: 0,
        message: 'Extracting OLM archive...',
      });

      const zip = await JSZip.loadAsync(file);
      
      onProgress?.({
        stage: 'extracting',
        progress: 100,
        message: 'Archive extracted successfully',
      });

      // Get all files in the archive
      const files = Object.keys(zip.files);
      
      // Find email files - they are individual message_XXXXX.xml files in com.microsoft.__Messages folders
      const emailFiles = files.filter(f => 
        f.includes('com.microsoft.__Messages/') && 
        f.match(/message_\d+\.xml$/) && 
        !zip.files[f].dir
      );
      
      // Find contact files - Contacts.xml in Address Book or other locations
      const contactFiles = files.filter(f => 
        (f.includes('Address Book/Contacts.xml') || 
         (f.includes('/Contacts/') && f.endsWith('.xml'))) && 
        !zip.files[f].dir
      );
      
      // Find calendar files - Calendar.xml files (each contains multiple appointments)
      const calendarFiles = files.filter(f => 
        f.includes('/Calendar/') && 
        f.endsWith('Calendar.xml') && 
        !zip.files[f].dir
      );

      console.log(`Found ${emailFiles.length} email files, ${contactFiles.length} contact files, ${calendarFiles.length} calendar files`);

      // Stage 2: Parse emails
      if (emailFiles.length > 0) {
        onProgress?.({
          stage: 'parsing_emails',
          progress: 0,
          message: `Parsing ${emailFiles.length} emails...`,
        });

        for (let i = 0; i < emailFiles.length; i++) {
          try {
            const content = await zip.files[emailFiles[i]].async('string');
            const email = this.parseEmailXML(content);
            if (email) {
              const emailId = await insertEmail(email);
              result.emails++;
              
              // Run detection on this email
              const emailWithId = { ...email, id: emailId };
              await this.runDetection(emailWithId, result);
              
              // Track contacts
              await this.trackContact(email);
            }
          } catch (err) {
            console.warn(`Failed to parse email ${emailFiles[i]}:`, err);
          }

          if (i % 100 === 0 || i === emailFiles.length - 1) {
            onProgress?.({
              stage: 'parsing_emails',
              progress: Math.round((i + 1) / emailFiles.length * 100),
              message: `Parsed ${i + 1} of ${emailFiles.length} emails`,
            });
          }
        }
      }

      // Stage 3: Parse contacts (each file may contain multiple contacts)
      if (contactFiles.length > 0) {
        onProgress?.({
          stage: 'parsing_contacts',
          progress: 0,
          message: `Parsing contacts...`,
        });

        for (let i = 0; i < contactFiles.length; i++) {
          try {
            const content = await zip.files[contactFiles[i]].async('string');
            const contacts = this.parseContactsXML(content);
            for (const contact of contacts) {
              await insertContact(contact);
              result.contacts++;
            }
          } catch (err) {
            console.warn(`Failed to parse contacts ${contactFiles[i]}:`, err);
          }

          onProgress?.({
            stage: 'parsing_contacts',
            progress: Math.round((i + 1) / contactFiles.length * 100),
            message: `Parsed ${result.contacts} contacts`,
          });
        }
      }

      // Stage 4: Parse calendar events (each Calendar.xml contains multiple appointments)
      if (calendarFiles.length > 0) {
        onProgress?.({
          stage: 'parsing_calendar',
          progress: 0,
          message: `Parsing calendar files...`,
        });

        for (let i = 0; i < calendarFiles.length; i++) {
          try {
            const content = await zip.files[calendarFiles[i]].async('string');
            const events = this.parseCalendarXML(content);
            for (const event of events) {
              await insertCalendarEvent(event);
              result.calendarEvents++;
            }
          } catch (err) {
            console.warn(`Failed to parse calendar ${calendarFiles[i]}:`, err);
          }

          onProgress?.({
            stage: 'parsing_calendar',
            progress: Math.round((i + 1) / calendarFiles.length * 100),
            message: `Parsed ${result.calendarEvents} calendar events`,
          });
        }
      }

      onProgress?.({
        stage: 'saving',
        progress: 100,
        message: 'Processing complete!',
      });

      return result;
    } catch (error) {
      console.error('Error parsing OLM file:', error);
      throw new Error(`Failed to parse OLM file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseEmailXML(xmlContent: string): Omit<Email, 'id'> | null {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlContent, 'text/xml');
      
      // Check for parsing errors
      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        console.warn('XML parsing error:', parserError.textContent);
        return null;
      }

      // Find the email element (could be directly or inside emails wrapper)
      const emailElement = doc.querySelector('email') || doc.documentElement;

      const getTextContent = (selectors: string[]): string => {
        for (const selector of selectors) {
          const element = emailElement.querySelector(selector);
          if (element?.textContent) {
            return element.textContent.trim();
          }
        }
        return '';
      };

      const subject = getTextContent(['OPFMessageCopySubject', 'subject', 'Subject']);
      const body = getTextContent(['OPFMessageCopyBody', 'body', 'Body', 'content', 'Content']);
      const htmlBody = getTextContent(['OPFMessageCopyHTMLBody', 'htmlBody', 'HtmlBody']);
      const preview = getTextContent(['OPFMessageCopyPreview']);
      
      // Parse sender from OPFMessageCopyFromAddresses
      const fromAddresses = emailElement.querySelector('OPFMessageCopyFromAddresses');
      let sender = '';
      let senderName = '';
      if (fromAddresses) {
        const emailAddr = fromAddresses.querySelector('emailAddress');
        if (emailAddr) {
          sender = emailAddr.getAttribute('OPFContactEmailAddressAddress') || '';
          senderName = emailAddr.getAttribute('OPFContactEmailAddressName') || '';
        }
      }
      if (!sender) {
        sender = getTextContent(['from', 'From', 'sender', 'Sender']);
      }
      
      // Parse date
      const dateStr = getTextContent(['OPFMessageCopySentTime', 'OPFMessageCopyReceivedTime', 'sentTime', 'SentTime', 'date', 'Date']);
      const date = dateStr ? new Date(dateStr) : new Date();
      
      // Parse recipients from OPFMessageCopyToAddresses
      const recipients: string[] = [];
      const toAddresses = emailElement.querySelector('OPFMessageCopyToAddresses');
      if (toAddresses) {
        const emailAddrs = toAddresses.querySelectorAll('emailAddress');
        emailAddrs.forEach(addr => {
          const email = addr.getAttribute('OPFContactEmailAddressAddress');
          if (email) {
            recipients.push(email);
          }
        });
      }
      if (recipients.length === 0) {
        const recipientsStr = getTextContent(['to', 'To', 'recipients']);
        if (recipientsStr) {
          recipients.push(...recipientsStr.split(/[,;]/).map(r => r.trim()).filter(Boolean));
        }
      }

      // Parse isRead status
      const isReadStr = getTextContent(['OPFMessageGetIsRead']);
      const isRead = isReadStr === '1' || isReadStr.toLowerCase() === 'true';

      // If we couldn't find a subject, this might not be a valid email
      if (!subject && !body && !preview) {
        return null;
      }

      return {
        subject: subject || '(No Subject)',
        sender: cleanEmailAddress(sender),
        senderName: senderName || undefined,
        recipients,
        date: isNaN(date.getTime()) ? new Date() : date,
        body: body || preview || '',
        htmlBody: htmlBody || undefined,
        attachments: [],
        size: xmlContent.length,
        isRead,
        isStarred: false,
        folderId: 'inbox',
        emailType: 'regular',
      };
    } catch (error) {
      console.warn('Failed to parse email XML:', error);
      return null;
    }
  }

  private parseContactsXML(xmlContent: string): Omit<Contact, 'id'>[] {
    const contacts: Omit<Contact, 'id'>[] = [];
    
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlContent, 'text/xml');
      
      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        console.warn('Contact XML parsing error:', parserError.textContent);
        return contacts;
      }

      // Get all contact elements
      const contactElements = doc.querySelectorAll('contact');
      
      contactElements.forEach(contactElement => {
        const getTextContent = (selectors: string[]): string => {
          for (const selector of selectors) {
            const element = contactElement.querySelector(selector);
            if (element?.textContent) {
              return element.textContent.trim();
            }
          }
          return '';
        };

        const displayName = getTextContent(['OPFContactCopyDisplayName', 'displayName', 'name', 'Name']);
        const firstName = getTextContent(['OPFContactCopyFirstName', 'firstName']);
        const lastName = getTextContent(['OPFContactCopyLastName', 'lastName']);
        const phone = getTextContent(['OPFContactCopyPhoneNumbers', 'phone', 'Phone']);
        
        // Get email from email address list
        let email = '';
        const emailList = contactElement.querySelector('OPFContactCopyEmailAddressList, OPFContactCopyDefaultEmailAddress');
        if (emailList) {
          const emailAddr = emailList.querySelector('contactEmailAddress');
          if (emailAddr) {
            email = emailAddr.getAttribute('OPFContactEmailAddressAddress') || '';
          }
        }
        if (!email) {
          email = getTextContent(['email', 'Email', 'emailAddress']);
        }

        const name = displayName || `${firstName} ${lastName}`.trim() || email.split('@')[0] || 'Unknown';

        if (email || name !== 'Unknown') {
          contacts.push({
            name,
            email: cleanEmailAddress(email),
            phone: phone || undefined,
            emailCount: 0,
            lastEmailDate: new Date(),
          });
        }
      });

      // If no contact elements found, try parsing as a single contact
      if (contactElements.length === 0) {
        const name = doc.querySelector('OPFContactCopyDisplayName, displayName, name')?.textContent?.trim();
        const emailList = doc.querySelector('OPFContactCopyEmailAddressList, OPFContactCopyDefaultEmailAddress');
        let email = '';
        if (emailList) {
          const emailAddr = emailList.querySelector('contactEmailAddress');
          if (emailAddr) {
            email = emailAddr.getAttribute('OPFContactEmailAddressAddress') || '';
          }
        }
        
        if (email || name) {
          contacts.push({
            name: name || email?.split('@')[0] || 'Unknown',
            email: cleanEmailAddress(email),
            phone: undefined,
            emailCount: 0,
            lastEmailDate: new Date(),
          });
        }
      }
    } catch (error) {
      console.warn('Failed to parse contacts XML:', error);
    }
    
    return contacts;
  }

  private parseCalendarXML(xmlContent: string): Omit<CalendarEvent, 'id'>[] {
    const events: Omit<CalendarEvent, 'id'>[] = [];
    
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlContent, 'text/xml');
      
      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        console.warn('Calendar XML parsing error:', parserError.textContent);
        return events;
      }

      // Get all appointment elements
      const appointmentElements = doc.querySelectorAll('appointment');
      
      appointmentElements.forEach(appointmentElement => {
        const getTextContent = (selectors: string[]): string => {
          for (const selector of selectors) {
            const element = appointmentElement.querySelector(selector);
            if (element?.textContent) {
              return element.textContent.trim();
            }
          }
          return '';
        };

        // OLM uses OPFCalendarEventCopySummary for the title
        const title = getTextContent([
          'OPFCalendarEventCopySummary', 
          'OPFCalendarEventCopySubject', 
          'summary', 
          'subject', 
          'Subject', 
          'title', 
          'Title'
        ]);
        const startDateStr = getTextContent(['OPFCalendarEventCopyStartTime', 'startTime', 'StartTime', 'start']);
        const endDateStr = getTextContent(['OPFCalendarEventCopyEndTime', 'endTime', 'EndTime', 'end']);
        const location = getTextContent(['OPFCalendarEventCopyLocation', 'location', 'Location']);
        const description = getTextContent(['OPFCalendarEventCopyBody', 'OPFCalendarEventCopyNotes', 'body', 'Body', 'description']);
        const organizer = getTextContent(['OPFCalendarEventCopyOrganizer', 'organizer', 'Organizer']);
        const isAllDayStr = getTextContent(['OPFCalendarEventGetIsAllDayEvent', 'OPFCalendarEventCopyIsAllDay', 'isAllDay', 'AllDay']);

        if (!title) {
          return; // Skip appointments without a title
        }

        const startDate = startDateStr ? new Date(startDateStr) : new Date();
        const endDate = endDateStr ? new Date(endDateStr) : new Date(startDate.getTime() + 3600000);

        events.push({
          title,
          startDate: isNaN(startDate.getTime()) ? new Date() : startDate,
          endDate: isNaN(endDate.getTime()) ? new Date() : endDate,
          location: location || undefined,
          attendees: organizer ? [organizer] : [],
          description: description || undefined,
          isAllDay: isAllDayStr === '1' || isAllDayStr?.toLowerCase() === 'true',
          reminder: false,
          isRead: false, // Mark as unread on import
        });
      });

    } catch (error) {
      console.warn('Failed to parse calendar XML:', error);
    }
    
    return events;
  }

  private async runDetection(email: Email, result: OLMProcessingResult): Promise<void> {
    // Detect account signups
    const accountResult = accountDetector.detectAccountSignup(email);
    if (accountResult.type === 'account' && accountResult.data?.serviceName) {
      const existingAccount = await getAccountByServiceName(accountResult.data.serviceName);
      if (!existingAccount) {
        const accountData = accountDetector.createAccountFromEmail(
          email,
          accountResult.data.serviceName,
          accountResult.data.serviceType as Account['serviceType']
        );
        await insertAccount(accountData);
        result.accounts++;
      }
    }

    // Detect purchases
    const purchaseResult = purchaseDetector.detectPurchase(email);
    if (purchaseResult.type === 'purchase' && purchaseResult.data?.amount) {
      const merchant = purchaseResult.data.merchant || 'Unknown';
      const amount = purchaseResult.data.amount;
      const orderNumber = purchaseResult.data.orderNumber;
      
      // Check for duplicates before inserting
      const existingPurchase = await findDuplicatePurchase(
        merchant,
        amount,
        email.date,
        orderNumber
      );
      
      if (!existingPurchase) {
        const purchaseData = purchaseDetector.createPurchaseFromEmail(
          email,
          merchant,
          amount,
          orderNumber
        );
        await insertPurchase(purchaseData);
        result.purchases++;
      }
    }
  }

  private async trackContact(email: Omit<Email, 'id'>): Promise<void> {
    const senderEmail = email.sender;
    if (!senderEmail || senderEmail === 'unknown@example.com') return;

    const existingContact = await getContactByEmail(senderEmail);
    if (existingContact) {
      // Update existing contact's email count
      await updateContactEmailCount(
        senderEmail,
        existingContact.emailCount + 1,
        email.date
      );
    } else {
      // Create new contact from email sender
      const senderName = email.senderName || senderEmail.split('@')[0] || 'Unknown';
      await insertContact({
        name: senderName,
        email: senderEmail,
        phone: undefined,
        emailCount: 1,
        lastEmailDate: email.date,
      });
    }
  }
}

export const olmParser = new OLMParser();
