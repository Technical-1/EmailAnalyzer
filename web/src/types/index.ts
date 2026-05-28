// Email types
export interface Email {
  id?: number;
  subject: string;
  sender: string;
  senderName?: string;
  recipients: string[];
  cc?: string[];
  date: Date;
  body: string;
  htmlBody?: string;
  attachments: Attachment[];
  size: number;
  isRead: boolean;
  isStarred: boolean;
  folderId: string;
  threadId?: string;
  snippet?: string;
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
  organization?: string;
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
  SENT: 'sent',
  DRAFTS: 'drafts',
  SPAM: 'spam',
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
  subscriptions: number;
  newsletters: number;
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
    currency?: string;
    orderNumber?: string;
  };
}

// Email Thread types
export interface EmailThread {
  id: string;
  subject: string; // Normalized subject
  emails: Email[];
  participants: string[];
  lastMessageDate: Date;
  firstMessageDate: Date;
  messageCount: number;
  unreadCount: number;
  hasAttachments: boolean;
  isStarred: boolean; // True if any email in thread is starred
}

// Saved Search types
export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  createdAt: Date;
  lastUsed?: Date;
}

// Subscription types (for Phase 4)
export interface Subscription {
  id?: number;
  serviceName: string;
  monthlyAmount: number;
  currency: string;
  frequency: 'weekly' | 'monthly' | 'yearly';
  lastRenewalDate: Date;
  nextRenewalDate?: Date;
  emailIds: number[];
  isActive: boolean;
  category: 'streaming' | 'software' | 'news' | 'fitness' | 'other';
}

// Newsletter types (for Phase 4)
export interface Newsletter {
  id?: number;
  senderEmail: string;
  senderName: string;
  emailCount: number;
  lastEmailDate: Date;
  frequency?: 'daily' | 'weekly' | 'monthly' | 'irregular';
  unsubscribeLink?: string;
  isPromotional: boolean;
}

// Custom Rule types (for Phase 3)
export interface CustomRule {
  id: string;
  name: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
  isActive: boolean;
  createdAt: Date;
}

export interface RuleCondition {
  field: 'sender' | 'subject' | 'body' | 'recipient';
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'regex';
  value: string;
  caseSensitive: boolean;
}

export interface RuleAction {
  type: 'tag' | 'move' | 'star' | 'markRead';
  value?: string;
}

