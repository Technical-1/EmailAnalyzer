/**
 * Import pipeline: turns a worker batch of parsed emails into persisted rows
 * plus detected accounts/purchases/subscriptions/newsletters/contacts.
 *
 * Extracted from HomePage so the orchestration is unit-testable and so the
 * three import bugs are fixed in one place:
 *  - detection + contact tracking run on EVERY email (no `% 5` / `% 10` sampling)
 *  - each batch is written in ONE transaction via bulkInsertEmails
 *  - subscriptions dedupe by sender domain, not a dead serviceName lookup
 */
import type { Email, Account, Subscription, Newsletter, CustomRule, RuleAction, OLMProcessingResult } from '../types';
import {
  bulkInsertEmails,
  insertAccount,
  insertPurchase,
  findDuplicatePurchase,
  getAccountByServiceName,
  getContactByEmail,
  insertContact,
  updateContactEmailCount,
  insertSubscription,
  getSubscriptionByServiceName,
  getSubscriptionByDomain,
  updateSubscription,
  insertNewsletter,
  getNewsletterBySender,
  updateNewsletter,
  updateEmailStar,
  updateEmailRead,
  updateEmailFolder,
  updateEmailTags,
} from '../db/database';
import {
  AccountDetector,
  PurchaseDetector,
  SubscriptionDetector,
  NewsletterDetector,
} from '@technical-1/email-archive-parser';
import { customRulesEngine } from './customRulesEngine';

const accountDetector = new AccountDetector();
const purchaseDetector = new PurchaseDetector();
const subscriptionDetector = new SubscriptionDetector();
const newsletterDetector = new NewsletterDetector();
import { extractDomain } from '../utils/emailUtils';
import { logger } from '../utils/logger';

export function createImportCounts(): OLMProcessingResult {
  return {
    emails: 0,
    contacts: 0,
    calendarEvents: 0,
    accounts: 0,
    purchases: 0,
    subscriptions: 0,
    newsletters: 0,
  };
}

/** Run all four detectors against a single (already-persisted) email. */
export async function runDetection(email: Email, counts: OLMProcessingResult): Promise<void> {
  // Account signups
  const accountResult = accountDetector.detect(email);
  if (accountResult.type === 'account' && accountResult.data?.serviceName) {
    const existingAccount = await getAccountByServiceName(accountResult.data.serviceName);
    if (!existingAccount) {
      await insertAccount({
        serviceName: accountResult.data.serviceName,
        signupEmailId: email.id,
        signupDate: email.date,
        serviceType: (accountResult.data.serviceType ?? 'other') as Account['serviceType'],
        domain: extractDomain(email.sender),
        emailCount: 1,
      });
      counts.accounts++;
    }
  }

  // Purchases
  const purchaseResult = purchaseDetector.detect(email);
  if (purchaseResult.type === 'purchase' && purchaseResult.data?.amount) {
    const merchant = purchaseResult.data.merchant || 'Unknown';
    const amount = purchaseResult.data.amount;
    const orderNumber = purchaseResult.data.orderNumber;
    const currency = purchaseResult.data.currency;

    const existingPurchase = await findDuplicatePurchase(merchant, amount, email.date, orderNumber);
    if (!existingPurchase) {
      await insertPurchase({
        emailId: email.id,
        merchant,
        amount,
        currency: currency || 'USD',
        purchaseDate: email.date,
        orderNumber,
        items: [],
        category: purchaseDetector.getCategory(merchant),
      });
      counts.purchases++;
    }
  }

  // Subscriptions — dedupe by serviceName, then by sender domain.
  const subResult = subscriptionDetector.detect(email);
  if (subResult.isSubscription && subResult.serviceName) {
    const senderDomain = extractDomain(email.sender);

    let existingSub = await getSubscriptionByServiceName(subResult.serviceName);
    if (!existingSub && senderDomain) {
      existingSub = await getSubscriptionByDomain(senderDomain);
    }

    if (existingSub) {
      const emailIds = [...new Set([...existingSub.emailIds, email.id!])];
      const isNewerEmail = email.date > existingSub.lastRenewalDate;
      const shouldUpdateAmount = isNewerEmail && subResult.amount != null && subResult.amount > 0;

      await updateSubscription(existingSub.id!, {
        emailIds,
        lastRenewalDate: isNewerEmail ? email.date : existingSub.lastRenewalDate,
        monthlyAmount: shouldUpdateAmount ? subResult.amount : existingSub.monthlyAmount,
      });
    } else {
      const newSub: Omit<Subscription, 'id'> = {
        serviceName: subResult.serviceName,
        domain: senderDomain || undefined,
        monthlyAmount: subResult.amount || 0,
        currency: subResult.currency || 'USD',
        frequency: subResult.frequency || 'monthly',
        lastRenewalDate: email.date,
        emailIds: [email.id!],
        isActive: true,
        category: subResult.category || 'other',
      };
      await insertSubscription(newSub);
      counts.subscriptions++;
    }
  }

  // Newsletters / promotional
  const nlResult = newsletterDetector.detect(email);
  if (nlResult.isNewsletter || nlResult.isPromotional) {
    const existingNL = await getNewsletterBySender(email.sender);
    if (existingNL) {
      await updateNewsletter(existingNL.id!, {
        emailCount: existingNL.emailCount + 1,
        lastEmailDate: email.date > existingNL.lastEmailDate ? email.date : existingNL.lastEmailDate,
        unsubscribeLink: nlResult.unsubscribeLink || existingNL.unsubscribeLink,
      });
    } else {
      const newNL: Omit<Newsletter, 'id'> = {
        senderEmail: email.sender,
        senderName: email.senderName || email.sender.split('@')[0],
        emailCount: 1,
        lastEmailDate: email.date,
        unsubscribeLink: nlResult.unsubscribeLink,
        isPromotional: nlResult.isPromotional,
      };
      await insertNewsletter(newNL);
      counts.newsletters++;
    }
  }
}

/**
 * Apply active custom rules to a freshly imported email. The email still carries
 * its full body here, so body conditions evaluate against real content. Any
 * "move" target folder is added to folderIds so it gets created with the batch.
 */
export async function applyRulesToEmail(
  email: Email,
  rules: CustomRule[],
  folderIds: Set<string>,
): Promise<void> {
  if (rules.length === 0) return;

  const actions: RuleAction[] = [];
  for (const rule of rules) {
    if (customRulesEngine.matchesRule(email, rule)) {
      actions.push(...rule.actions);
    }
  }

  const patch = customRulesEngine.applyActionsToEmail(email, actions);
  if (!patch) return;

  const id = email.id!;
  if (patch.folderId !== undefined) {
    folderIds.add(patch.folderId);
    await updateEmailFolder(id, patch.folderId);
  }
  if (patch.isStarred !== undefined) await updateEmailStar(id, patch.isStarred);
  if (patch.isRead !== undefined) await updateEmailRead(id, patch.isRead);
  if (patch.tags !== undefined) await updateEmailTags(id, patch.tags);
}

/** Track the sender as a contact. Returns true if a new contact was created. */
export async function trackContact(email: Pick<Email, 'sender' | 'senderName' | 'date'>): Promise<boolean> {
  const senderEmail = email.sender;
  if (!senderEmail || senderEmail === 'unknown@example.com') return false;

  const existing = await getContactByEmail(senderEmail);
  if (existing) {
    await updateContactEmailCount(senderEmail, existing.emailCount + 1, email.date);
    return false;
  }

  await insertContact({
    name: email.senderName || senderEmail.split('@')[0] || 'Unknown',
    email: senderEmail,
    phone: undefined,
    emailCount: 1,
    lastEmailDate: email.date,
  });
  return true;
}

/**
 * Persist one worker batch and run detection + contact tracking on every email.
 * The whole batch is written in a single transaction (bulkInsertEmails); detection
 * runs against the in-memory batch objects (which still carry body/htmlBody) using
 * the ids returned from the insert.
 */
export async function processEmailBatch(
  batch: Omit<Email, 'id'>[],
  counts: OLMProcessingResult,
  folderIds: Set<string>,
): Promise<void> {
  if (batch.length === 0) return;

  // Worker messages may serialize dates to strings; coerce defensively.
  const emails = batch.map((e) => ({ ...e, date: new Date(e.date) }));
  for (const e of emails) {
    if (e.folderId) folderIds.add(e.folderId);
  }

  let ids: number[];
  try {
    ids = await bulkInsertEmails(emails);
  } catch (err) {
    logger.warn('Failed to insert email batch:', err);
    return;
  }
  counts.emails += ids.length;

  // Load active rules once per batch rather than re-reading localStorage per email.
  const activeRules = customRulesEngine.getActiveRules();

  for (let i = 0; i < ids.length; i++) {
    const withId: Email = { ...emails[i], id: ids[i] };
    try {
      await runDetection(withId, counts);
      const isNewContact = await trackContact(withId);
      if (isNewContact) counts.contacts++;
      await applyRulesToEmail(withId, activeRules, folderIds);
    } catch (err) {
      logger.warn('Error processing email:', err);
    }
  }
}
