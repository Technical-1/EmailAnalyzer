/// <reference lib="webworker" />

import JSZip from 'jszip';
import type { Email, Contact, CalendarEvent, OLMProcessingProgress } from '../types';
import { cleanEmailAddress, stripHtml, extractDomain } from '../utils/emailUtils';

export interface WorkerMessage {
  type: 'parse';
  file: File;
}

export interface WorkerResponse {
  type: 'progress' | 'result' | 'error';
  progress?: OLMProcessingProgress;
  result?: ParsedOLMData;
  error?: string;
}

export interface ParsedOLMData {
  emails: Omit<Email, 'id'>[];
  contacts: Omit<Contact, 'id'>[];
  calendarEvents: Omit<CalendarEvent, 'id'>[];
}

const ctx: Worker = self as unknown as Worker;

ctx.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, file } = event.data;

  if (type === 'parse') {
    try {
      await parseOLMFile(file);
    } catch (error) {
      ctx.postMessage({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error parsing OLM file',
      } as WorkerResponse);
    }
  }
};

async function parseOLMFile(file: File): Promise<void> {
  const result: ParsedOLMData = {
    emails: [],
    contacts: [],
    calendarEvents: [],
  };

  // Stage 1: Extract ZIP
  postProgress('extracting', 0, 'Extracting OLM archive...');

  const zip = await JSZip.loadAsync(file);

  postProgress('extracting', 100, 'Archive extracted successfully');

  // Get all files in the archive
  const files = Object.keys(zip.files);

  // Find email files
  const emailFiles = files.filter(
    (f) =>
      f.includes('com.microsoft.__Messages/') &&
      f.match(/message_\d+\.xml$/) &&
      !zip.files[f].dir
  );

  // Find contact files
  const contactFiles = files.filter(
    (f) =>
      (f.includes('Address Book/Contacts.xml') ||
        (f.includes('/Contacts/') && f.endsWith('.xml'))) &&
      !zip.files[f].dir
  );

  // Find calendar files
  const calendarFiles = files.filter(
    (f) =>
      f.includes('/Calendar/') && f.endsWith('Calendar.xml') && !zip.files[f].dir
  );

  // Stage 2: Parse emails
  if (emailFiles.length > 0) {
    postProgress('parsing_emails', 0, `Parsing ${emailFiles.length} emails...`);

    for (let i = 0; i < emailFiles.length; i++) {
      try {
        const content = await zip.files[emailFiles[i]].async('string');
        const email = parseEmailXML(content);
        if (email) {
          result.emails.push(email);
        }
      } catch (err) {
        console.warn(`Failed to parse email ${emailFiles[i]}:`, err);
      }

      if (i % 100 === 0 || i === emailFiles.length - 1) {
        postProgress(
          'parsing_emails',
          Math.round(((i + 1) / emailFiles.length) * 100),
          `Parsed ${i + 1} of ${emailFiles.length} emails`
        );
      }
    }
  }

  // Stage 3: Parse contacts
  if (contactFiles.length > 0) {
    postProgress('parsing_contacts', 0, 'Parsing contacts...');

    for (let i = 0; i < contactFiles.length; i++) {
      try {
        const content = await zip.files[contactFiles[i]].async('string');
        const contacts = parseContactsXML(content);
        result.contacts.push(...contacts);
      } catch (err) {
        console.warn(`Failed to parse contacts ${contactFiles[i]}:`, err);
      }

      postProgress(
        'parsing_contacts',
        Math.round(((i + 1) / contactFiles.length) * 100),
        `Parsed ${result.contacts.length} contacts`
      );
    }
  }

  // Stage 4: Parse calendar events
  if (calendarFiles.length > 0) {
    postProgress('parsing_calendar', 0, 'Parsing calendar files...');

    for (let i = 0; i < calendarFiles.length; i++) {
      try {
        const content = await zip.files[calendarFiles[i]].async('string');
        const events = parseCalendarXML(content);
        result.calendarEvents.push(...events);
      } catch (err) {
        console.warn(`Failed to parse calendar ${calendarFiles[i]}:`, err);
      }

      postProgress(
        'parsing_calendar',
        Math.round(((i + 1) / calendarFiles.length) * 100),
        `Parsed ${result.calendarEvents.length} calendar events`
      );
    }
  }

  postProgress('saving', 100, 'Processing complete!');

  // Send the final result
  ctx.postMessage({
    type: 'result',
    result,
  } as WorkerResponse);
}

function postProgress(
  stage: OLMProcessingProgress['stage'],
  progress: number,
  message: string
): void {
  ctx.postMessage({
    type: 'progress',
    progress: { stage, progress, message },
  } as WorkerResponse);
}

function parseEmailXML(xmlContent: string): Omit<Email, 'id'> | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');

    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      return null;
    }

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
    const body = getTextContent([
      'OPFMessageCopyBody',
      'body',
      'Body',
      'content',
      'Content',
    ]);
    const htmlBody = getTextContent(['OPFMessageCopyHTMLBody', 'htmlBody', 'HtmlBody']);
    const preview = getTextContent(['OPFMessageCopyPreview']);

    // Parse sender
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
    const dateStr = getTextContent([
      'OPFMessageCopySentTime',
      'OPFMessageCopyReceivedTime',
      'sentTime',
      'SentTime',
      'date',
      'Date',
    ]);
    const date = dateStr ? new Date(dateStr) : new Date();

    // Parse recipients
    const recipients: string[] = [];
    const toAddresses = emailElement.querySelector('OPFMessageCopyToAddresses');
    if (toAddresses) {
      const emailAddrs = toAddresses.querySelectorAll('emailAddress');
      emailAddrs.forEach((addr) => {
        const email = addr.getAttribute('OPFContactEmailAddressAddress');
        if (email) {
          recipients.push(email);
        }
      });
    }
    if (recipients.length === 0) {
      const recipientsStr = getTextContent(['to', 'To', 'recipients']);
      if (recipientsStr) {
        recipients.push(
          ...recipientsStr
            .split(/[,;]/)
            .map((r) => r.trim())
            .filter(Boolean)
        );
      }
    }

    // Parse isRead status
    const isReadStr = getTextContent(['OPFMessageGetIsRead']);
    const isRead = isReadStr === '1' || isReadStr.toLowerCase() === 'true';

    // Parse thread ID if available
    const threadId = getTextContent([
      'OPFMessageCopyThreadTopic',
      'threadId',
      'Thread-Topic',
      'References',
    ]);

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
      threadId: threadId || undefined,
      emailType: 'regular',
    };
  } catch (error) {
    console.warn('Failed to parse email XML:', error);
    return null;
  }
}

function parseContactsXML(xmlContent: string): Omit<Contact, 'id'>[] {
  const contacts: Omit<Contact, 'id'>[] = [];

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');

    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      return contacts;
    }

    const contactElements = doc.querySelectorAll('contact');

    contactElements.forEach((contactElement) => {
      const getTextContent = (selectors: string[]): string => {
        for (const selector of selectors) {
          const element = contactElement.querySelector(selector);
          if (element?.textContent) {
            return element.textContent.trim();
          }
        }
        return '';
      };

      const displayName = getTextContent([
        'OPFContactCopyDisplayName',
        'displayName',
        'name',
        'Name',
      ]);
      const firstName = getTextContent(['OPFContactCopyFirstName', 'firstName']);
      const lastName = getTextContent(['OPFContactCopyLastName', 'lastName']);
      const phone = getTextContent(['OPFContactCopyPhoneNumbers', 'phone', 'Phone']);

      let email = '';
      const emailList = contactElement.querySelector(
        'OPFContactCopyEmailAddressList, OPFContactCopyDefaultEmailAddress'
      );
      if (emailList) {
        const emailAddr = emailList.querySelector('contactEmailAddress');
        if (emailAddr) {
          email = emailAddr.getAttribute('OPFContactEmailAddressAddress') || '';
        }
      }
      if (!email) {
        email = getTextContent(['email', 'Email', 'emailAddress']);
      }

      const name =
        displayName || `${firstName} ${lastName}`.trim() || email.split('@')[0] || 'Unknown';

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
      const name = doc
        .querySelector('OPFContactCopyDisplayName, displayName, name')
        ?.textContent?.trim();
      const emailList = doc.querySelector(
        'OPFContactCopyEmailAddressList, OPFContactCopyDefaultEmailAddress'
      );
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

function parseCalendarXML(xmlContent: string): Omit<CalendarEvent, 'id'>[] {
  const events: Omit<CalendarEvent, 'id'>[] = [];

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');

    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      return events;
    }

    const appointmentElements = doc.querySelectorAll('appointment');

    appointmentElements.forEach((appointmentElement) => {
      const getTextContent = (selectors: string[]): string => {
        for (const selector of selectors) {
          const element = appointmentElement.querySelector(selector);
          if (element?.textContent) {
            return element.textContent.trim();
          }
        }
        return '';
      };

      const title = getTextContent([
        'OPFCalendarEventCopySummary',
        'OPFCalendarEventCopySubject',
        'summary',
        'subject',
        'Subject',
        'title',
        'Title',
      ]);
      const startDateStr = getTextContent([
        'OPFCalendarEventCopyStartTime',
        'startTime',
        'StartTime',
        'start',
      ]);
      const endDateStr = getTextContent([
        'OPFCalendarEventCopyEndTime',
        'endTime',
        'EndTime',
        'end',
      ]);
      const location = getTextContent([
        'OPFCalendarEventCopyLocation',
        'location',
        'Location',
      ]);
      const description = getTextContent([
        'OPFCalendarEventCopyBody',
        'OPFCalendarEventCopyNotes',
        'body',
        'Body',
        'description',
      ]);
      const organizer = getTextContent([
        'OPFCalendarEventCopyOrganizer',
        'organizer',
        'Organizer',
      ]);
      const isAllDayStr = getTextContent([
        'OPFCalendarEventGetIsAllDayEvent',
        'OPFCalendarEventCopyIsAllDay',
        'isAllDay',
        'AllDay',
      ]);

      if (!title) {
        return;
      }

      const startDate = startDateStr ? new Date(startDateStr) : new Date();
      const endDate = endDateStr
        ? new Date(endDateStr)
        : new Date(startDate.getTime() + 3600000);

      events.push({
        title,
        startDate: isNaN(startDate.getTime()) ? new Date() : startDate,
        endDate: isNaN(endDate.getTime()) ? new Date() : endDate,
        location: location || undefined,
        attendees: organizer ? [organizer] : [],
        description: description || undefined,
        isAllDay: isAllDayStr === '1' || isAllDayStr?.toLowerCase() === 'true',
        reminder: false,
        isRead: false,
      });
    });
  } catch (error) {
    console.warn('Failed to parse calendar XML:', error);
  }

  return events;
}

export {};

