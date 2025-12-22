// Email types
export interface Email {
  id?: number;
  subject: string;
  sender: string;
  senderName?: string;
  recipients: string[];
  date: Date;
  body: string;
  htmlBody?: string;
  attachments: Attachment[];
  size: number;
  isRead: boolean;
  isStarred: boolean;
  folderId: string;
  threadId?: string;
  originalOlmId?: string;
  emailType: 'account_signup' | 'purchase' | 'regular';
  detectedAccount?: string;
  purchaseAmount?: number;
  purchaseMerchant?: string;
}

export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  data?: string; // base64 encoded
}

// Account types
export interface Account {
  id?: number;
  serviceName: string;
  signupEmailId?: number;
  signupDate: Date;
  serviceType: 'streaming' | 'ecommerce' | 'social' | 'banking' | 'communication' | 'development' | 'other';
  domain: string;
  lastActivityDate?: Date;
  emailCount: number;
}

// Purchase types
export interface Purchase {
  id?: number;
  emailId?: number;
  merchant: string;
  amount: number;
  currency: string;
  purchaseDate: Date;
  orderNumber?: string;
  items: string[];
  category: string;
}

// Contact types
export interface Contact {
  id?: number;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
  tags?: string[];
  emailCount: number;
  lastEmailDate: Date;
}

// Calendar event types
export interface CalendarEvent {
  id?: number;
  title: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  attendees: string[];
  description?: string;
  isAllDay: boolean;
  reminder?: boolean;
  isRead: boolean;
}

// Folder types
export interface Folder {
  id: string;
  name: string;
  icon?: string;
  isSystem: boolean; // System folders (inbox, archive, trash) can't be deleted
  color?: string;
  createdAt: Date;
}

// Default system folders
export const SYSTEM_FOLDERS = {
  INBOX: 'inbox',
  ARCHIVE: 'archive',
  TRASH: 'trash',
} as const;

// OLM processing
export interface OLMProcessingResult {
  emails: number;
  contacts: number;
  calendarEvents: number;
  accounts: number;
  purchases: number;
}

export interface OLMProcessingProgress {
  stage: 'extracting' | 'parsing_emails' | 'parsing_contacts' | 'parsing_calendar' | 'detecting' | 'saving';
  progress: number;
  message: string;
}

// Detection results
export interface DetectionResult {
  type: 'account' | 'purchase' | 'none';
  confidence: number;
  data?: {
    serviceName?: string;
    serviceType?: string;
    merchant?: string;
    amount?: number;
    orderNumber?: string;
  };
}

