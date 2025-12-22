import type { Email, Contact, CalendarEvent, Account, Subscription, Newsletter, OLMProcessingResult, OLMProcessingProgress } from '../types';
import type { ParsedOLMData, WorkerResponse } from '../workers/olmWorker';
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
  bulkInsertEmails,
  bulkInsertContacts,
  bulkInsertCalendarEvents,
  insertSubscription,
  getSubscriptionByServiceName,
  updateSubscription,
  insertNewsletter,
  getNewsletterBySender,
  updateNewsletter,
} from '../db/database';
import { accountDetector } from './accountDetector';
import { purchaseDetector } from './purchaseDetector';
import { subscriptionDetector } from './subscriptionDetector';
import { newsletterDetector } from './newsletterDetector';

export type ProgressCallback = (progress: OLMProcessingProgress) => void;

class WorkerOLMParser {
  private worker: Worker | null = null;

  async parseOLMFile(file: File, onProgress?: ProgressCallback): Promise<OLMProcessingResult> {
    return new Promise((resolve, reject) => {
      // Create worker using Vite's worker import
      this.worker = new Worker(
        new URL('../workers/olmWorker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = async (event: MessageEvent<WorkerResponse>) => {
        const { type, progress, result, error } = event.data;

        switch (type) {
          case 'progress':
            if (progress) {
              onProgress?.(progress);
            }
            break;

          case 'result':
            if (result) {
              // Process the parsed data on the main thread (for detection and DB operations)
              try {
                const processedResult = await this.processAndSaveData(result, onProgress);
                this.terminateWorker();
                resolve(processedResult);
              } catch (err) {
                this.terminateWorker();
                reject(err);
              }
            }
            break;

          case 'error':
            this.terminateWorker();
            reject(new Error(error || 'Unknown worker error'));
            break;
        }
      };

      this.worker.onerror = (error) => {
        this.terminateWorker();
        reject(new Error(`Worker error: ${error.message}`));
      };

      // Send file to worker
      this.worker.postMessage({ type: 'parse', file });
    });
  }

  private terminateWorker(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  private async processAndSaveData(
    data: ParsedOLMData,
    onProgress?: ProgressCallback
  ): Promise<OLMProcessingResult> {
    const result: OLMProcessingResult = {
      emails: 0,
      contacts: 0,
      calendarEvents: 0,
      accounts: 0,
      purchases: 0,
      subscriptions: 0,
      newsletters: 0,
    };

    onProgress?.({
      stage: 'detecting',
      progress: 0,
      message: 'Running detection on emails...',
    });

    // Process emails with detection
    const emailsToInsert: Omit<Email, 'id'>[] = [];
    const detectedAccounts: Map<string, Omit<Account, 'id'>> = new Map();
    const detectedPurchases: Array<{
      merchant: string;
      amount: number;
      orderNumber?: string;
      email: Omit<Email, 'id'>;
    }> = [];

    // Track subscriptions and newsletters for batch processing
    const subscriptionMap: Map<string, { sub: Omit<Subscription, 'id'>; emailIndices: number[] }> = new Map();
    const newsletterMap: Map<string, { nl: Omit<Newsletter, 'id'>; count: number; lastDate: Date }> = new Map();

    for (let i = 0; i < data.emails.length; i++) {
      const email = data.emails[i];

      // Run account detection
      const accountResult = accountDetector.detectAccountSignup(email as Email);
      if (accountResult.type === 'account' && accountResult.data?.serviceName) {
        email.emailType = 'account_signup';
        email.detectedAccount = accountResult.data.serviceName;

        if (!detectedAccounts.has(accountResult.data.serviceName)) {
          const existingAccount = await getAccountByServiceName(accountResult.data.serviceName);
          if (!existingAccount) {
            const accountData = accountDetector.createAccountFromEmail(
              email as Email,
              accountResult.data.serviceName,
              accountResult.data.serviceType as Account['serviceType']
            );
            detectedAccounts.set(accountResult.data.serviceName, accountData);
          }
        }
      }

      // Run purchase detection
      const purchaseResult = purchaseDetector.detectPurchase(email as Email);
      if (purchaseResult.type === 'purchase' && purchaseResult.data?.amount) {
        email.emailType = 'purchase';
        email.purchaseAmount = purchaseResult.data.amount;
        email.purchaseMerchant = purchaseResult.data.merchant;

        detectedPurchases.push({
          merchant: purchaseResult.data.merchant || 'Unknown',
          amount: purchaseResult.data.amount,
          orderNumber: purchaseResult.data.orderNumber,
          email,
        });
      }

      // Run subscription detection
      const subResult = subscriptionDetector.detectSubscription(email as Email);
      if (subResult.isSubscription && subResult.serviceName) {
        const existing = subscriptionMap.get(subResult.serviceName);
        if (existing) {
          existing.emailIndices.push(i);
          if (email.date > existing.sub.lastRenewalDate) {
            existing.sub.lastRenewalDate = email.date;
          }
          if (subResult.amount && subResult.amount > existing.sub.monthlyAmount) {
            existing.sub.monthlyAmount = subResult.amount;
          }
        } else {
          subscriptionMap.set(subResult.serviceName, {
            sub: {
              serviceName: subResult.serviceName,
              monthlyAmount: subResult.amount || 0,
              currency: subResult.currency || 'USD',
              frequency: subResult.frequency || 'monthly',
              lastRenewalDate: email.date,
              emailIds: [],
              isActive: true,
              category: subResult.category || 'other',
            },
            emailIndices: [i],
          });
        }
      }

      // Run newsletter detection
      const nlResult = newsletterDetector.detectNewsletter(email as Email);
      if (nlResult.isNewsletter || nlResult.isPromotional) {
        const existing = newsletterMap.get(email.sender);
        if (existing) {
          existing.count++;
          if (email.date > existing.lastDate) {
            existing.lastDate = email.date;
            if (nlResult.unsubscribeLink) {
              existing.nl.unsubscribeLink = nlResult.unsubscribeLink;
            }
          }
        } else {
          newsletterMap.set(email.sender, {
            nl: {
              senderEmail: email.sender,
              senderName: email.senderName || email.sender.split('@')[0],
              emailCount: 1,
              lastEmailDate: email.date,
              unsubscribeLink: nlResult.unsubscribeLink,
              isPromotional: nlResult.isPromotional,
            },
            count: 1,
            lastDate: email.date,
          });
        }
      }

      emailsToInsert.push(email);

      if (i % 100 === 0) {
        onProgress?.({
          stage: 'detecting',
          progress: Math.round((i / data.emails.length) * 100),
          message: `Running detection on ${i + 1} of ${data.emails.length} emails...`,
        });
      }
    }

    onProgress?.({
      stage: 'saving',
      progress: 0,
      message: 'Saving emails to database...',
    });

    // Bulk insert emails
    let insertedEmailIds: number[] = [];
    if (emailsToInsert.length > 0) {
      insertedEmailIds = await bulkInsertEmails(emailsToInsert);
      result.emails = insertedEmailIds.length;

      // Process purchases with email IDs
      for (const purchase of detectedPurchases) {
        const existingPurchase = await findDuplicatePurchase(
          purchase.merchant,
          purchase.amount,
          purchase.email.date,
          purchase.orderNumber
        );

        if (!existingPurchase) {
          const purchaseData = purchaseDetector.createPurchaseFromEmail(
            purchase.email as Email,
            purchase.merchant,
            purchase.amount,
            purchase.orderNumber
          );
          await insertPurchase(purchaseData);
          result.purchases++;
        }
      }
    }

    onProgress?.({
      stage: 'saving',
      progress: 20,
      message: 'Saving accounts...',
    });

    // Insert accounts
    for (const account of detectedAccounts.values()) {
      await insertAccount(account);
      result.accounts++;
    }

    onProgress?.({
      stage: 'saving',
      progress: 35,
      message: 'Saving subscriptions...',
    });

    // Insert subscriptions
    for (const [serviceName, { sub, emailIndices }] of subscriptionMap) {
      const existingSub = await getSubscriptionByServiceName(serviceName);
      if (existingSub) {
        // Update existing subscription
        const newEmailIds = emailIndices.map(i => insertedEmailIds[i]).filter(id => id !== undefined);
        await updateSubscription(existingSub.id!, {
          emailIds: [...existingSub.emailIds, ...newEmailIds],
          lastRenewalDate: sub.lastRenewalDate > existingSub.lastRenewalDate ? sub.lastRenewalDate : existingSub.lastRenewalDate,
          monthlyAmount: sub.monthlyAmount > existingSub.monthlyAmount ? sub.monthlyAmount : existingSub.monthlyAmount,
        });
      } else {
        // Insert new subscription with email IDs
        sub.emailIds = emailIndices.map(i => insertedEmailIds[i]).filter(id => id !== undefined);
        await insertSubscription(sub);
        result.subscriptions++;
      }
    }

    onProgress?.({
      stage: 'saving',
      progress: 50,
      message: 'Saving newsletters...',
    });

    // Insert newsletters
    for (const [senderEmail, { nl, count, lastDate }] of newsletterMap) {
      const existingNL = await getNewsletterBySender(senderEmail);
      if (existingNL) {
        await updateNewsletter(existingNL.id!, {
          emailCount: existingNL.emailCount + count,
          lastEmailDate: lastDate > existingNL.lastEmailDate ? lastDate : existingNL.lastEmailDate,
          unsubscribeLink: nl.unsubscribeLink || existingNL.unsubscribeLink,
        });
      } else {
        nl.emailCount = count;
        nl.lastEmailDate = lastDate;
        await insertNewsletter(nl);
        result.newsletters++;
      }
    }

    onProgress?.({
      stage: 'saving',
      progress: 65,
      message: 'Saving contacts...',
    });

    // Bulk insert contacts from OLM file
    if (data.contacts.length > 0) {
      // Filter out duplicates
      const uniqueContacts: Omit<Contact, 'id'>[] = [];
      for (const contact of data.contacts) {
        if (contact.email) {
          const existing = await getContactByEmail(contact.email);
          if (!existing) {
            uniqueContacts.push(contact);
          }
        } else {
          uniqueContacts.push(contact);
        }
      }
      if (uniqueContacts.length > 0) {
        const insertedIds = await bulkInsertContacts(uniqueContacts);
        result.contacts = insertedIds.length;
      }
    }

    onProgress?.({
      stage: 'saving',
      progress: 80,
      message: 'Tracking email contacts...',
    });

    // Track email senders as contacts
    for (const email of emailsToInsert) {
      const senderEmail = email.sender;
      if (senderEmail && senderEmail !== 'unknown@example.com') {
        const existingContact = await getContactByEmail(senderEmail);
        if (existingContact) {
          await updateContactEmailCount(
            senderEmail,
            existingContact.emailCount + 1,
            email.date
          );
        } else {
          await insertContact({
            name: email.senderName || senderEmail.split('@')[0] || 'Unknown',
            email: senderEmail,
            phone: undefined,
            emailCount: 1,
            lastEmailDate: email.date,
          });
          result.contacts++;
        }
      }
    }

    onProgress?.({
      stage: 'saving',
      progress: 90,
      message: 'Saving calendar events...',
    });

    // Bulk insert calendar events
    if (data.calendarEvents.length > 0) {
      const insertedIds = await bulkInsertCalendarEvents(data.calendarEvents);
      result.calendarEvents = insertedIds.length;
    }

    onProgress?.({
      stage: 'saving',
      progress: 100,
      message: 'Processing complete!',
    });

    return result;
  }
}

export const workerOlmParser = new WorkerOLMParser();
