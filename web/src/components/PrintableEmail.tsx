import React from 'react';
import { format } from 'date-fns';
import DOMPurify from 'dompurify';
import type { Email } from '../types';

interface PrintableEmailProps {
  email: Email;
  showAttachments?: boolean;
}

/**
 * Print-friendly email view component
 * Renders email in a clean, printable format
 */
export const PrintableEmail: React.FC<PrintableEmailProps> = ({
  email,
  showAttachments = true,
}) => {
  return (
    <div className="print-email">
      <style>
        {`
          @media print {
            .print-email {
              font-family: 'Times New Roman', serif;
              font-size: 12pt;
              line-height: 1.5;
              color: #000;
              background: #fff;
              padding: 0.5in;
            }
            
            .print-email-header {
              border-bottom: 2px solid #000;
              padding-bottom: 16px;
              margin-bottom: 24px;
            }
            
            .print-email-subject {
              font-size: 18pt;
              font-weight: bold;
              margin-bottom: 16px;
            }
            
            .print-email-meta {
              display: grid;
              grid-template-columns: auto 1fr;
              gap: 4px 16px;
              font-size: 10pt;
            }
            
            .print-email-meta-label {
              font-weight: bold;
              color: #333;
            }
            
            .print-email-body {
              margin-top: 24px;
            }
            
            .print-email-body pre {
              white-space: pre-wrap;
              font-family: inherit;
            }
            
            .print-email-attachments {
              margin-top: 24px;
              padding-top: 16px;
              border-top: 1px solid #ccc;
            }
            
            .print-email-attachments h3 {
              font-size: 12pt;
              font-weight: bold;
              margin-bottom: 8px;
            }
            
            .print-email-attachments ul {
              list-style: none;
              padding: 0;
            }
            
            .print-email-attachments li {
              padding: 4px 0;
            }
            
            /* Hide non-printable elements */
            .no-print {
              display: none !important;
            }
          }
          
          /* Screen preview styles */
          @media screen {
            .print-email {
              max-width: 800px;
              margin: 0 auto;
              padding: 32px;
              background: white;
              border-radius: 8px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            
            .print-email-header {
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 16px;
              margin-bottom: 24px;
            }
            
            .print-email-subject {
              font-size: 24px;
              font-weight: 600;
              color: #1e293b;
              margin-bottom: 16px;
            }
            
            .print-email-meta {
              display: grid;
              grid-template-columns: auto 1fr;
              gap: 4px 16px;
              font-size: 14px;
            }
            
            .print-email-meta-label {
              font-weight: 600;
              color: #64748b;
            }
            
            .print-email-meta-value {
              color: #1e293b;
            }
            
            .print-email-body {
              margin-top: 24px;
              color: #334155;
            }
            
            .print-email-body pre {
              white-space: pre-wrap;
              font-family: inherit;
              line-height: 1.6;
            }
            
            .print-email-attachments {
              margin-top: 24px;
              padding-top: 16px;
              border-top: 1px solid #e2e8f0;
            }
            
            .print-email-attachments h3 {
              font-size: 16px;
              font-weight: 600;
              color: #64748b;
              margin-bottom: 8px;
            }
            
            .print-email-attachments ul {
              list-style: none;
              padding: 0;
            }
            
            .print-email-attachments li {
              padding: 8px 12px;
              background: #f8fafc;
              border-radius: 4px;
              margin-bottom: 4px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
          }
        `}
      </style>

      <div className="print-email-header">
        <div className="print-email-subject">{email.subject}</div>
        
        <div className="print-email-meta">
          <span className="print-email-meta-label">From:</span>
          <span className="print-email-meta-value">
            {email.senderName ? `${email.senderName} <${email.sender}>` : email.sender}
          </span>
          
          <span className="print-email-meta-label">To:</span>
          <span className="print-email-meta-value">
            {email.recipients.join(', ')}
          </span>
          
          <span className="print-email-meta-label">Date:</span>
          <span className="print-email-meta-value">
            {format(email.date, 'EEEE, MMMM d, yyyy \'at\' h:mm a')}
          </span>
          
          {email.cc && email.cc.length > 0 && (
            <>
              <span className="print-email-meta-label">CC:</span>
              <span className="print-email-meta-value">
                {email.cc.join(', ')}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="print-email-body">
        {email.htmlBody ? (
          <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(email.htmlBody) }} />
        ) : (
          <pre>{email.body}</pre>
        )}
      </div>

      {showAttachments && email.attachments && email.attachments.length > 0 && (
        <div className="print-email-attachments">
          <h3>Attachments ({email.attachments.length})</h3>
          <ul>
            {email.attachments.map((attachment, index) => (
              <li key={index}>
                <span>{attachment.filename}</span>
                <span>{formatFileSize(attachment.size)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

/**
 * Print an email
 */
// eslint-disable-next-line react-refresh/only-export-components
export function printEmail(email: Email): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to print emails');
    return;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${email.subject}</title>
        <style>
          body {
            font-family: 'Times New Roman', serif;
            font-size: 12pt;
            line-height: 1.5;
            color: #000;
            background: #fff;
            padding: 0.5in;
            margin: 0;
          }
          
          .header {
            border-bottom: 2px solid #000;
            padding-bottom: 16px;
            margin-bottom: 24px;
          }
          
          .subject {
            font-size: 18pt;
            font-weight: bold;
            margin-bottom: 16px;
          }
          
          .meta {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 4px 16px;
            font-size: 10pt;
          }
          
          .meta-label {
            font-weight: bold;
          }
          
          .body {
            margin-top: 24px;
          }
          
          .body pre {
            white-space: pre-wrap;
            font-family: inherit;
          }
          
          .attachments {
            margin-top: 24px;
            padding-top: 16px;
            border-top: 1px solid #ccc;
          }
          
          .attachments h3 {
            font-size: 12pt;
            font-weight: bold;
            margin-bottom: 8px;
          }
          
          .attachments ul {
            list-style: none;
            padding: 0;
            margin: 0;
          }
          
          .attachments li {
            padding: 4px 0;
          }
          
          @media print {
            @page {
              margin: 0.5in;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="subject">${escapeHtml(email.subject)}</div>
          <div class="meta">
            <span class="meta-label">From:</span>
            <span>${escapeHtml(email.senderName ? `${email.senderName} <${email.sender}>` : email.sender)}</span>
            <span class="meta-label">To:</span>
            <span>${escapeHtml(email.recipients.join(', '))}</span>
            <span class="meta-label">Date:</span>
            <span>${format(email.date, 'EEEE, MMMM d, yyyy \'at\' h:mm a')}</span>
          </div>
        </div>
        <div class="body">
          ${email.htmlBody ? sanitizeHtml(email.htmlBody) : `<pre>${escapeHtml(email.body)}</pre>`}
        </div>
        ${email.attachments && email.attachments.length > 0 ? `
          <div class="attachments">
            <h3>Attachments (${email.attachments.length})</h3>
            <ul>
              ${email.attachments.map(a => `<li>${escapeHtml(a.filename)} - ${formatFileSize(a.size)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
  
  // Wait for content to load then print
  printWindow.onload = () => {
    printWindow.print();
    // Close after printing
    printWindow.onafterprint = () => printWindow.close();
  };
}

// Helper functions
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'div', 'span', 'a', 'b', 'strong', 'i', 'em', 'u',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote',
      'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'hr'
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'style', 'width', 'height'],
    ALLOW_DATA_ATTR: false,
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

