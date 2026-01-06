/**
 * Type definitions for the Parser Web Worker
 * These types define the message protocol between main thread and worker
 */

import type { Email, Contact, CalendarEvent } from '../types';

// ============================================================================
// Messages TO the worker (from main thread)
// ============================================================================

export type WorkerInputMessage = 
  | ParseFileMessage
  | CancelMessage;

export interface ParseFileMessage {
  type: 'PARSE_FILE';
  payload: {
    file: File;
    fileType: 'olm' | 'mbox' | 'gmail-takeout';
  };
}

export interface CancelMessage {
  type: 'CANCEL';
}

// ============================================================================
// Messages FROM the worker (to main thread)
// ============================================================================

export type WorkerOutputMessage =
  | ProgressMessage
  | EmailBatchMessage
  | ContactBatchMessage
  | CalendarEventBatchMessage
  | CompleteMessage
  | ErrorMessage;

export interface ProgressMessage {
  type: 'PROGRESS';
  payload: {
    stage: 'extracting' | 'parsing_emails' | 'parsing_contacts' | 'parsing_calendar' | 'detecting' | 'saving';
    progress: number;
    message: string;
  };
}

export interface EmailBatchMessage {
  type: 'EMAIL_BATCH';
  payload: {
    emails: Omit<Email, 'id'>[];
    batchNumber: number;
    isLast: boolean;
  };
}

export interface ContactBatchMessage {
  type: 'CONTACT_BATCH';
  payload: {
    contacts: Omit<Contact, 'id'>[];
    batchNumber: number;
    isLast: boolean;
  };
}

export interface CalendarEventBatchMessage {
  type: 'CALENDAR_BATCH';
  payload: {
    events: Omit<CalendarEvent, 'id'>[];
    batchNumber: number;
    isLast: boolean;
  };
}

export interface CompleteMessage {
  type: 'COMPLETE';
  payload: {
    totalEmails: number;
    totalContacts: number;
    totalCalendarEvents: number;
  };
}

export interface ErrorMessage {
  type: 'ERROR';
  payload: {
    message: string;
    stage?: string;
  };
}

// ============================================================================
// Helper type for the worker context
// ============================================================================

export interface WorkerParseContext {
  isCancelled: boolean;
  totalEmailsParsed: number;
  totalContactsParsed: number;
  totalCalendarEventsParsed: number;
}

