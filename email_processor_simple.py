#!/usr/bin/env python3
"""
Simple Email Processor - No external dependencies required
Analyze downloaded emails using only standard library
"""

import os
import json
import csv
from datetime import datetime
from collections import defaultdict, Counter
import re
from pathlib import Path
import email.utils

class SimpleEmailProcessor:
    def __init__(self, email_dir="emails"):
        self.email_dir = Path(email_dir)
        self.emails = []

    def parse_email_file(self, filepath):
        """Parse a single email text file"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            # Extract header information
            lines = content.split('\n')
            headers = {}
            body_start = 0

            for i, line in enumerate(lines):
                if line.startswith('=') and len(line) > 50:  # End of header
                    body_start = i + 2
                    break
                if ':' in line and not line.startswith(' '):
                    key, value = line.split(':', 1)
                    headers[key.strip()] = value.strip()

            # Extract body
            body = '\n'.join(lines[body_start:]).strip()

            # Parse date
            date_str = headers.get('DATE', '')
            try:
                if date_str:
                    parsed_date = email.utils.parsedate_to_datetime(date_str)
                else:
                    parsed_date = None
            except:
                parsed_date = None

            return {
                'filepath': str(filepath),
                'filename': filepath.name,
                'email_id': headers.get('EMAIL ID', ''),
                'subject': headers.get('SUBJECT', ''),
                'sender': headers.get('FROM', ''),
                'recipient': headers.get('TO', ''),
                'date': parsed_date,
                'date_str': date_str,
                'body': body,
                'body_length': len(body)
            }

        except Exception as e:
            print(f"Error parsing {filepath}: {e}")
            return None

    def load_emails(self):
        """Load all email files from directory"""
        email_files = list(self.email_dir.glob("*.txt"))
        print(f"📂 Found {len(email_files)} email files")

        self.emails = []
        for filepath in email_files:
            email_data = self.parse_email_file(filepath)
            if email_data:
                self.emails.append(email_data)

        # Sort by date
        self.emails.sort(key=lambda x: x['date'] or datetime.min, reverse=True)

        print(f"✅ Loaded {len(self.emails)} emails successfully")
        return self.emails

    def analyze_emails(self):
        """Perform comprehensive email analysis"""
        if not self.emails:
            print("❌ No emails loaded")
            return

        print("\n" + "="*80)
        print("📊 EMAIL ANALYSIS REPORT")
        print("="*80)

        total_emails = len(self.emails)
        print(f"Total emails: {total_emails}")

        # Date range
        dates = [e['date'] for e in self.emails if e['date']]
        if dates:
            print(f"Date range: {min(dates).strftime('%Y-%m-%d')} to {max(dates).strftime('%Y-%m-%d')}")

        # Sender analysis
        print(f"\n📤 TOP SENDERS:")
        senders = [e['sender'] for e in self.emails if e['sender']]
        sender_counts = Counter(senders).most_common(20)
        for sender, count in sender_counts:
            print(f"  {sender}: {count} emails")

        # Subject analysis
        print(f"\n📧 COMMON SUBJECT PATTERNS:")
        subjects = [e['subject'] for e in self.emails if e['subject']]
        all_words = []
        for subject in subjects:
            words = re.findall(r'\b\w+\b', subject.lower())
            all_words.extend(words)

        # Filter out common stop words
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 're', 'fwd', 'fw'}
        filtered_words = [word for word in all_words if len(word) > 2 and word not in stop_words]
        word_counts = Counter(filtered_words).most_common(20)
        for word, count in word_counts:
            print(f"  '{word}': {count} times")

        # Email length analysis
        print(f"\n📏 EMAIL LENGTH STATISTICS:")
        lengths = [e['body_length'] for e in self.emails]
        print(f"  Average length: {sum(lengths)/len(lengths):.0f} characters")
        print(f"  Longest email: {max(lengths):.0f} characters")
        print(f"  Shortest email: {min(lengths):.0f} characters")

        # Time analysis
        if dates:
            print(f"\n🕐 EMAILS BY YEAR:")
            years = [d.year for d in dates]
            year_counts = Counter(years)
            for year in sorted(year_counts.keys()):
                print(f"  {year}: {year_counts[year]} emails")

        # Potential important emails
        print(f"\n🔍 POTENTIAL IMPORTANT EMAILS:")

        # Look for account-related emails
        account_keywords = ['account', 'password', 'login', 'security', 'verification', 'confirm', 'reset']
        account_emails = []
        for email in self.emails:
            text = (email['subject'] + ' ' + email['body']).lower()
            if any(keyword in text for keyword in account_keywords):
                account_emails.append(email)

        print(f"  Account/Security related: {len(account_emails)} emails")

        # Look for financial emails
        financial_keywords = ['invoice', 'payment', 'billing', 'receipt', 'charge', 'bank', 'credit']
        financial_emails = []
        for email in self.emails:
            text = (email['subject'] + ' ' + email['body']).lower()
            if any(keyword in text for keyword in financial_keywords):
                financial_emails.append(email)

        print(f"  Financial related: {len(financial_emails)} emails")

        # Look for service notifications
        service_keywords = ['service', 'subscription', 'membership', 'update', 'notification']
        service_emails = []
        for email in self.emails:
            text = (email['subject'] + ' ' + email['body']).lower()
            if any(keyword in text for keyword in service_keywords):
                service_emails.append(email)

        print(f"  Service/Subscription related: {len(service_emails)} emails")

        return {
            'total_emails': total_emails,
            'account_emails': len(account_emails),
            'financial_emails': len(financial_emails),
            'service_emails': len(service_emails),
            'top_senders': sender_counts[:10]
        }

    def search_emails(self, query, field='all'):
        """Search emails by query"""
        if not self.emails:
            print("❌ No emails loaded")
            return

        query = query.lower()
        results = []

        for email in self.emails:
            if field == 'all':
                search_text = (email['subject'] + ' ' + email['sender'] + ' ' + email['body']).lower()
            elif field == 'subject':
                search_text = email['subject'].lower()
            elif field == 'sender':
                search_text = email['sender'].lower()
            elif field == 'body':
                search_text = email['body'].lower()
            else:
                continue

            if query in search_text:
                results.append(email)

        print(f"🔍 Found {len(results)} emails matching '{query}' in {field}")
        if len(results) > 0:
            print("\nMatches:")
            for email in results[:10]:  # Show first 10
                date_str = email['date'].strftime('%Y-%m-%d') if email['date'] else 'Unknown'
                print(f"  📧 {date_str} - {email['subject'][:50]}... from {email['sender']}")

        return results

    def export_summary(self, output_file="email_summary.json"):
        """Export email summary to JSON"""
        if not self.emails:
            print("❌ No emails loaded")
            return

        # Create summary data
        analysis = self.analyze_emails()

        summary = {
            'total_emails': len(self.emails),
            'generated_at': datetime.now().isoformat(),
            'important_categories': {
                'account_security': analysis['account_emails'],
                'financial': analysis['financial_emails'],
                'services': analysis['service_emails']
            },
            'top_senders': [{'sender': sender, 'count': count} for sender, count in analysis['top_senders']]
        }

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2, default=str)

        print(f"📄 Summary exported to {output_file}")
        return summary

    def create_email_index(self, index_file="email_index.csv"):
        """Create a searchable index of all emails"""
        if not self.emails:
            print("❌ No emails loaded")
            return

        # Create CSV
        with open(index_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['filename', 'email_id', 'subject', 'sender', 'date', 'body_length'])

            for email in self.emails:
                writer.writerow([
                    email['filename'],
                    email['email_id'],
                    email['subject'],
                    email['sender'],
                    email['date_str'],
                    email['body_length']
                ])

        print(f"📋 Email index created: {index_file}")
        return index_file

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Process downloaded emails for analysis")
    parser.add_argument('--email-dir', default='emails', help='Directory containing email text files')
    parser.add_argument('--analyze', action='store_true', help='Run full analysis')
    parser.add_argument('--search', help='Search emails for specific text')
    parser.add_argument('--field', default='all', choices=['all', 'subject', 'sender', 'body'], help='Field to search in')
    parser.add_argument('--export-summary', action='store_true', help='Export summary to JSON')
    parser.add_argument('--create-index', action='store_true', help='Create searchable email index')

    args = parser.parse_args()

    # Initialize processor
    processor = SimpleEmailProcessor(args.email_dir)

    # Load emails
    processor.load_emails()

    # Perform requested actions
    if args.analyze:
        processor.analyze_emails()

    if args.search:
        processor.search_emails(args.search, args.field)

    if args.export_summary:
        processor.export_summary()

    if args.create_index:
        processor.create_index()

    # If no specific action requested, show basic info
    if not any([args.analyze, args.search, args.export_summary, args.create_index]):
        print(f"\n📂 Email processor ready. {len(processor.emails)} emails loaded.")
        print("Use --analyze for full analysis, --search for searching, etc.")

if __name__ == "__main__":
    main()
