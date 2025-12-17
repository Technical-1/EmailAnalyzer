#!/usr/bin/env python3
"""
Simple Email Downloader - No external dependencies required
Downloads all emails via IMAP using only standard library
"""

import imaplib
import email
import email.header
import os
import sys
from datetime import datetime
import email.utils
import re
from pathlib import Path

class SimpleEmailDownloader:
    def __init__(self, email_address, password, imap_server="outlook.office365.com", port=993):
        self.email_address = email_address
        self.password = password
        self.imap_server = imap_server
        self.port = port
        self.mail = None

    def connect(self):
        """Connect to IMAP server"""
        try:
            self.mail = imaplib.IMAP4_SSL(self.imap_server, self.port)
            self.mail.login(self.email_address, self.password)
            print("✅ Connected to IMAP server")
            return True
        except Exception as e:
            print(f"❌ Failed to connect: {e}")
            return False

    def get_mailboxes(self):
        """List all available mailboxes"""
        status, mailboxes = self.mail.list()
        if status == 'OK':
            print("📁 Available mailboxes:")
            for mailbox in mailboxes:
                print(f"  {mailbox.decode()}")
        return mailboxes

    def select_mailbox(self, mailbox="INBOX"):
        """Select a mailbox to work with"""
        status, data = self.mail.select(mailbox)
        if status == 'OK':
            print(f"📬 Selected mailbox: {mailbox} ({data[0].decode()} messages)")
            return int(data[0])
        else:
            print(f"❌ Failed to select mailbox: {mailbox}")
            return 0

    def decode_str(self, s):
        """Decode email header strings"""
        if s is None:
            return ""

        decoded_parts = email.header.decode_header(s)
        decoded_string = ""
        for part, encoding in decoded_parts:
            if isinstance(part, bytes):
                if encoding:
                    decoded_string += part.decode(encoding)
                else:
                    decoded_string += part.decode('utf-8', errors='ignore')
            else:
                decoded_string += str(part)
        return decoded_string

    def clean_filename(self, filename):
        """Clean filename for filesystem compatibility"""
        # Remove or replace invalid characters
        invalid_chars = '<>:"/\\|?*'
        for char in invalid_chars:
            filename = filename.replace(char, '_')

        # Remove multiple spaces/underscores
        filename = re.sub(r'[_\s]+', '_', filename)

        # Limit length
        if len(filename) > 100:
            filename = filename[:97] + "..."

        return filename.strip('_')

    def save_email(self, email_message, email_id, output_dir):
        """Save a single email as text file"""
        # Extract email components
        subject = self.decode_str(email_message.get('Subject', 'No Subject'))
        sender = self.decode_str(email_message.get('From', 'Unknown'))
        date = email_message.get('Date', 'Unknown Date')
        to = self.decode_str(email_message.get('To', ''))
        cc = self.decode_str(email_message.get('Cc', ''))

        # Parse date
        try:
            parsed_date = email.utils.parsedate_to_datetime(date)
            date_str = parsed_date.strftime('%Y-%m-%d %H:%M:%S')
            date_filename = parsed_date.strftime('%Y%m%d_%H%M%S')
        except:
            date_str = str(date)
            date_filename = "unknown_date"

        # Get email body
        body = ""
        if email_message.is_multipart():
            for part in email_message.walk():
                if part.get_content_type() == "text/plain":
                    try:
                        body = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                        break
                    except:
                        continue
        else:
            try:
                body = email_message.get_payload(decode=True).decode('utf-8', errors='ignore')
            except:
                body = str(email_message.get_payload())

        # Create filename
        clean_subject = self.clean_filename(subject)
        filename = f"{date_filename}_{email_id:06d}_{clean_subject}.txt"
        filepath = os.path.join(output_dir, filename)

        # Write email to file
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write("=" * 80 + "\n")
            f.write(f"EMAIL ID: {email_id}\n")
            f.write(f"SUBJECT: {subject}\n")
            f.write(f"FROM: {sender}\n")
            f.write(f"TO: {to}\n")
            if cc:
                f.write(f"CC: {cc}\n")
            f.write(f"DATE: {date_str}\n")
            f.write("=" * 80 + "\n\n")
            f.write(body)

        return filepath

    def download_emails(self, mailbox="INBOX", output_dir="emails", batch_size=50):
        """Download all emails from specified mailbox"""
        # Create output directory
        os.makedirs(output_dir, exist_ok=True)

        # Select mailbox
        total_emails = self.select_mailbox(mailbox)
        if total_emails == 0:
            return

        print(f"📥 Starting download of {total_emails} emails...")

        downloaded = 0
        errors = 0

        # Download emails in batches to avoid memory issues
        for start in range(1, total_emails + 1, batch_size):
            end = min(start + batch_size - 1, total_emails)

            # Fetch email IDs for this batch
            status, data = self.mail.fetch(f'{start}:{end}', '(RFC822)')
            if status != 'OK':
                print(f"❌ Failed to fetch emails {start}-{end}")
                continue

            # Process each email in batch
            for i in range(0, len(data), 2):
                try:
                    email_id = start + (i // 2)
                    raw_email = data[i][1]

                    # Parse email
                    email_message = email.message_from_bytes(raw_email)

                    # Save email
                    filepath = self.save_email(email_message, email_id, output_dir)
                    downloaded += 1

                    if downloaded % 50 == 0:
                        print(f"📄 Downloaded {downloaded}/{total_emails} emails")

                except Exception as e:
                    errors += 1
                    print(f"❌ Error processing email {email_id}: {e}")
                    continue

        print(f"✅ Download complete! {downloaded} emails saved, {errors} errors")
        return downloaded, errors

    def close(self):
        """Close IMAP connection"""
        if self.mail:
            self.mail.close()
            self.mail.logout()
            print("🔌 Connection closed")

def main():
    print("🚀 Simple Email Downloader (No external dependencies)")
    print("=" * 60)

    # Configuration
    EMAIL_ADDRESS = input("Enter your Outlook/UFL email address: ").strip()
    PASSWORD = input("Enter your password (use app password if 2FA enabled): ").strip()

    # For UFL/Outlook, try common servers
    servers_to_try = [
        ("outlook.office365.com", 993),
        ("imap-mail.outlook.com", 993),
    ]

    downloader = None
    connected = False

    for server, port in servers_to_try:
        print(f"🔍 Trying server: {server}:{port}")
        downloader = SimpleEmailDownloader(EMAIL_ADDRESS, PASSWORD, server, port)
        if downloader.connect():
            connected = True
            break

    if not connected:
        print("❌ Could not connect to any IMAP server.")
        print("💡 Common causes and solutions:")
        print("  1. Wrong password - If 2FA is enabled, use an APP PASSWORD instead:")
        print("     Outlook: https://account.microsoft.com/security/app-passwords")
        print("  2. IMAP not enabled - Check your email provider settings")
        print("  3. Account locked - Try logging in via web first")
        print("  4. Wrong server - UFL might use different IMAP settings")
        print()
        print("🔐 For Outlook with 2FA: Create an App Password and use it here.")
        sys.exit(1)

    # List mailboxes
    downloader.get_mailboxes()

    # Ask which mailbox to download
    mailbox = input("Enter mailbox to download (default: INBOX): ").strip() or "INBOX"

    # Ask for output directory
    output_dir = input("Enter output directory (default: emails): ").strip() or "emails"

    # Download emails
    try:
        downloaded, errors = downloader.download_emails(mailbox, output_dir)
        print(f"📊 Summary: {downloaded} emails downloaded, {errors} errors")
    except KeyboardInterrupt:
        print("\n⚠️  Download interrupted by user")
    finally:
        downloader.close()

if __name__ == "__main__":
    main()
