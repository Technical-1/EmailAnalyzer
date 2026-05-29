import { useState, useEffect } from 'react';
import { getEmailBody } from '../db/database';
import { logger } from '../utils/logger';

interface EmailBody {
  body: string;
  htmlBody?: string;
  attachmentData?: Record<string, string>; // base64 data keyed by attachment id
}

interface UseLazyEmailBodyResult {
  body: EmailBody | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for lazy loading email body content
 * This allows the email list to show email metadata without loading full body content
 * The body is only loaded when viewing the email detail
 */
export function useLazyEmailBody(emailId: number | undefined): UseLazyEmailBodyResult {
  const [body, setBody] = useState<EmailBody | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!emailId) {
      setBody(null);
      return;
    }

    let cancelled = false;

    const loadBody = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const emailBody = await getEmailBody(emailId);
        if (!cancelled) {
          if (emailBody) {
            setBody(emailBody);
          } else {
            setError('Email body not found');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load email body');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadBody();

    return () => {
      cancelled = true;
    };
  }, [emailId]);

  return { body, isLoading, error };
}

/**
 * Prefetch email body in the background
 * Can be used to prefetch when hovering over an email in the list
 */
export async function prefetchEmailBody(emailId: number): Promise<void> {
  try {
    await getEmailBody(emailId);
  } catch (err) {
    logger.warn('Failed to prefetch email body:', err);
  }
}

