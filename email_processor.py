#!/usr/bin/env python3
"""
Email Processor for Cursor-based Email Review
Fast processing and analysis of downloaded emails
"""

import os
import re
import json
from datetime import datetime
from collections import defaultdict, Counter
import pandas as pd
from pathlib import Path
import argparse
from tqdm import tqdm
import email.utils

class EmailProcessor:
    def __init__(self, email_dir="emails"):
        self.email_dir = Path(email_dir)
        self.emails = []
        self.df = None

    def parse_email_file(self, filepath):
        """Parse a single email text file"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            # Extract header information
            lines = content.split('\n')
            header_lines = []
            body_start = 0

            for i, line in enumerate(lines):
                if line.startswith('=') and len(line) > 50:  # End of header
                    body_start = i + 2
                    break
                header_lines.append(line)

            # Parse headers
            headers = {}
            current_key = None
            current_value = []

            for line in header_lines:
                if ':' in line and not line.startswith(' '):
                    # New header
                    if current_key:
                        headers[current_key] = ' '.join(current_value).strip()
                    parts = line.split(':', 1)
                    current_key = parts[0].strip()
                    current_value = [parts[1].strip()] if len(parts) > 1 else []
                elif current_key and line.startswith(' '):
                    # Continuation of previous header
                    current_value.append(line.strip())

            if current_key:
                headers[current_key] = ' '.join(current_value).strip()

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
                'cc': headers.get('CC', ''),
                'date': parsed_date,
                'date_str': date_str,
                'body': body,
                'body_length': len(body),
                'has_attachments': 'attachment' in body.lower() or 'attached' in body.lower()
            }

        except Exception as e:
            print(f"Error parsing {filepath}: {e}")
            return None

    def load_emails(self):
        """Load all email files from directory"""
        email_files = list(self.email_dir.glob("*.txt"))
        print(f"📂 Found {len(email_files)} email files")

        self.emails = []
        for filepath in tqdm(email_files, desc="Loading emails"):
            email_data = self.parse_email_file(filepath)
            if email_data:
                self.emails.append(email_data)

        # Create DataFrame for analysis
        self.df = pd.DataFrame(self.emails)
        if not self.df.empty and 'date' in self.df.columns:
            self.df['date'] = pd.to_datetime(self.df['date'], errors='coerce')
            self.df = self.df.sort_values('date', na_position='last')

        print(f"✅ Loaded {len(self.emails)} emails successfully")
        return self.df

    def analyze_emails(self):
        """Perform comprehensive email analysis"""
        if self.df is None or self.df.empty:
            print("❌ No emails loaded")
            return

        print("\n" + "="*80)
        print("📊 EMAIL ANALYSIS REPORT")
        print("="*80)

        # Basic stats
        print(f"Total emails: {len(self.df)}")
        print(f"Date range: {self.df['date'].min()} to {self.df['date'].max()}")

        # Sender analysis
        print(f"\n📤 TOP SENDERS:")
        sender_counts = self.df['sender'].value_counts().head(20)
        for sender, count in sender_counts.items():
            print(f"  {sender}: {count} emails")

        # Subject analysis
        print(f"\n📧 COMMON SUBJECT PATTERNS:")
        # Extract common words from subjects
        subjects = self.df['subject'].fillna('').str.lower()
        subject_words = []
        for subject in subjects:
            words = re.findall(r'\b\w+\b', subject)
            subject_words.extend(words)

        # Filter out common stop words
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 're', 'fwd', 'fw'}
        filtered_words = [word for word in subject_words if len(word) > 2 and word not in stop_words]

        word_counts = Counter(filtered_words).most_common(20)
        for word, count in word_counts:
            print(f"  '{word}': {count} times")

        # Email length analysis
        print(f"\n📏 EMAIL LENGTH STATISTICS:")
        print(f"  Average length: {self.df['body_length'].mean():.0f} characters")
        print(f"  Median length: {self.df['body_length'].median():.0f} characters")
        print(f"  Longest email: {self.df['body_length'].max():.0f} characters")
        print(f"  Shortest email: {self.df['body_length'].min():.0f} characters")

        # Time analysis
        if 'date' in self.df.columns:
            print(f"\n🕐 EMAILS BY YEAR:")
            year_counts = self.df['date'].dt.year.value_counts().sort_index()
            for year, count in year_counts.items():
                print(f"  {year}: {count} emails")

            print(f"\n🕐 EMAILS BY MONTH (Last 2 years):")
            recent_emails = self.df[self.df['date'] > pd.Timestamp.now() - pd.DateOffset(years=2)]
            month_counts = recent_emails['date'].dt.to_period('M').value_counts().sort_index().head(24)
            for month, count in month_counts.items():
                print(f"  {month}: {count} emails")

        # Potential important emails
        print(f"\n🔍 POTENTIAL IMPORTANT EMAILS:")

        # Look for account-related emails
        account_keywords = ['account', 'password', 'login', 'security', 'verification', 'confirm', 'reset']
        account_emails = self.df[
            self.df['subject'].str.lower().str.contains('|'.join(account_keywords), na=False) |
            self.df['body'].str.lower().str.contains('|'.join(account_keywords), na=False)
        ]
        print(f"  Account/Security related: {len(account_emails)} emails")

        # Look for financial emails
        financial_keywords = ['invoice', 'payment', 'billing', 'receipt', 'charge', 'bank', 'credit']
        financial_emails = self.df[
            self.df['subject'].str.lower().str.contains('|'.join(financial_keywords), na=False) |
            self.df['body'].str.lower().str.contains('|'.join(financial_keywords), na=False)
        ]
        print(f"  Financial related: {len(financial_emails)} emails")

        # Look for service notifications
        service_keywords = ['service', 'subscription', 'membership', 'update', 'notification']
        service_emails = self.df[
            self.df['subject'].str.lower().str.contains('|'.join(service_keywords), na=False) |
            self.df['body'].str.lower().str.contains('|'.join(service_keywords), na=False)
        ]
        print(f"  Service/Subscription related: {len(service_emails)} emails")

        return {
            'total_emails': len(self.df),
            'sender_counts': sender_counts.to_dict(),
            'account_emails': len(account_emails),
            'financial_emails': len(financial_emails),
            'service_emails': len(service_emails)
        }

    def search_emails(self, query, field='all'):
        """Search emails by query"""
        if self.df is None or self.df.empty:
            print("❌ No emails loaded")
            return

        query = query.lower()

        if field == 'all':
            mask = (
                self.df['subject'].str.lower().str.contains(query, na=False) |
                self.df['sender'].str.lower().str.contains(query, na=False) |
                self.df['body'].str.lower().str.contains(query, na=False)
            )
        elif field == 'subject':
            mask = self.df['subject'].str.lower().str.contains(query, na=False)
        elif field == 'sender':
            mask = self.df['sender'].str.lower().str.contains(query, na=False)
        elif field == 'body':
            mask = self.df['body'].str.lower().str.contains(query, na=False)

        results = self.df[mask]

        print(f"🔍 Found {len(results)} emails matching '{query}' in {field}")
        if len(results) > 0:
            print("\nMatches:")
            for _, email in results.head(10).iterrows():
                print(f"  📧 {email['date'].strftime('%Y-%m-%d') if email['date'] else 'Unknown'} - {email['subject'][:60]}... from {email['sender']}")

        return results

    def export_summary(self, output_file="email_summary.json"):
        """Export email summary to JSON"""
        if self.df is None or self.df.empty:
            print("❌ No emails loaded")
            return

        # Create summary data
        summary = {
            'total_emails': len(self.df),
            'date_range': {
                'start': str(self.df['date'].min()),
                'end': str(self.df['date'].max())
            },
            'top_senders': self.df['sender'].value_counts().head(10).to_dict(),
            'emails_by_year': self.df['date'].dt.year.value_counts().sort_index().to_dict() if 'date' in self.df.columns else {},
            'important_categories': {
                'account_security': len(self.df[
                    self.df['subject'].str.lower().str.contains('account|password|login|security', na=False)
                ]),
                'financial': len(self.df[
                    self.df['subject'].str.lower().str.contains('invoice|payment|billing', na=False)
                ]),
                'services': len(self.df[
                    self.df['subject'].str.lower().str.contains('subscription|service|membership', na=False)
                ])
            }
        }

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2, default=str)

        print(f"📄 Summary exported to {output_file}")
        return summary

    def create_email_index(self, index_file="email_index.csv"):
        """Create a searchable index of all emails"""
        if self.df is None or self.df.empty:
            print("❌ No emails loaded")
            return

        # Select columns for index
        index_df = self.df[['filename', 'email_id', 'subject', 'sender', 'date', 'body_length']].copy()

        # Add preview of body (first 200 chars)
        index_df['body_preview'] = self.df['body'].str[:200] + '...'

        # Save to CSV
        index_df.to_csv(index_file, index=False, encoding='utf-8')
        print(f"📋 Email index created: {index_file}")
        return index_df

def main():
    parser = argparse.ArgumentParser(description="Process downloaded emails for analysis")
    parser.add_argument('--email-dir', default='emails', help='Directory containing email text files')
    parser.add_argument('--analyze', action='store_true', help='Run full analysis')
    parser.add_argument('--search', help='Search emails for specific text')
    parser.add_argument('--field', default='all', choices=['all', 'subject', 'sender', 'body'], help='Field to search in')
    parser.add_argument('--export-summary', action='store_true', help='Export summary to JSON')
    parser.add_argument('--create-index', action='store_true', help='Create searchable email index')

    args = parser.parse_args()

    # Initialize processor
    processor = EmailProcessor(args.email_dir)

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
