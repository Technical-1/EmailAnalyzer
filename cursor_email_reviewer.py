#!/usr/bin/env python3
"""
Cursor Email Reviewer - Interactive Email Processing Tool
Designed for efficient email review and categorization in Cursor
"""

import os
import json
import pandas as pd
from pathlib import Path
import re
from datetime import datetime
from collections import defaultdict
import argparse

class CursorEmailReviewer:
    def __init__(self, email_dir="emails"):
        self.email_dir = Path(email_dir)
        self.df = None
        self.categories = defaultdict(list)
        self.load_emails()

    def load_emails(self):
        """Load emails from directory"""
        email_files = list(self.email_dir.glob("*.txt"))
        emails = []

        print(f"Loading {len(email_files)} emails...")

        for filepath in email_files:
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Parse basic info from file
                lines = content.split('\n')
                subject = ""
                sender = ""
                date = ""
                body_start = 0

                for i, line in enumerate(lines):
                    if line.startswith('SUBJECT:'):
                        subject = line[8:].strip()
                    elif line.startswith('FROM:'):
                        sender = line[5:].strip()
                    elif line.startswith('DATE:'):
                        date = line[5:].strip()
                    elif line.startswith('=') and len(line) > 50:
                        body_start = i + 2
                        break

                body = '\n'.join(lines[body_start:]).strip()

                emails.append({
                    'filepath': str(filepath),
                    'filename': filepath.name,
                    'subject': subject,
                    'sender': sender,
                    'date': date,
                    'body': body,
                    'category': 'uncategorized',
                    'priority': 'normal',
                    'reviewed': False
                })

            except Exception as e:
                print(f"Error loading {filepath}: {e}")

        self.df = pd.DataFrame(emails)
        print(f"Loaded {len(emails)} emails successfully")

    def show_email_summary(self):
        """Show summary of emails by category and status"""
        if self.df is None:
            return

        print("\n" + "="*80)
        print("📊 EMAIL REVIEW STATUS")
        print("="*80)

        total = len(self.df)
        reviewed = len(self.df[self.df['reviewed'] == True])
        categorized = len(self.df[self.df['category'] != 'uncategorized'])

        print(f"Total emails: {total}")
        print(f"Reviewed: {reviewed} ({reviewed/total*100:.1f}%)")
        print(f"Categorized: {categorized} ({categorized/total*100:.1f}%)")

        print(f"\n📂 CATEGORIES:")
        category_counts = self.df['category'].value_counts()
        for category, count in category_counts.items():
            print(f"  {category}: {count} emails")

        print(f"\n⚡ PRIORITIES:")
        priority_counts = self.df['priority'].value_counts()
        for priority, count in priority_counts.items():
            print(f"  {priority}: {count} emails")

    def get_next_email(self, category_filter=None, priority_filter=None, reviewed_filter=False):
        """Get next email to review based on filters"""
        df_filtered = self.df

        if category_filter:
            df_filtered = df_filtered[df_filtered['category'] == category_filter]

        if priority_filter:
            df_filtered = df_filtered[df_filtered['priority'] == priority_filter]

        if reviewed_filter is False:
            df_filtered = df_filtered[df_filtered['reviewed'] == False]

        if len(df_filtered) == 0:
            return None

        # Sort by priority (high first), then by date (newest first)
        priority_order = {'high': 3, 'medium': 2, 'normal': 1, 'low': 0}
        df_filtered = df_filtered.copy()
        df_filtered['priority_score'] = df_filtered['priority'].map(priority_order)

        # Sort by priority score desc, then by filename desc (assuming newer files have higher numbers)
        df_filtered = df_filtered.sort_values(['priority_score', 'filename'], ascending=[False, False])

        return df_filtered.iloc[0]

    def display_email(self, email_data):
        """Display email in Cursor-friendly format"""
        print("\n" + "="*100)
        print(f"📧 EMAIL: {email_data['filename']}")
        print("="*100)
        print(f"Subject: {email_data['subject']}")
        print(f"From: {email_data['sender']}")
        print(f"Date: {email_data['date']}")
        print(f"Category: {email_data['category']}")
        print(f"Priority: {email_data['priority']}")
        print(f"Reviewed: {'✅ Yes' if email_data['reviewed'] else '❌ No'}")
        print("-"*100)

        # Show body preview (first 1000 chars)
        body_preview = email_data['body'][:1000]
        if len(email_data['body']) > 1000:
            body_preview += "\n\n[... truncated - full email available in file ...]"

        print(body_preview)
        print("\n" + "="*100)

    def categorize_email(self, filename, category, priority='normal'):
        """Categorize an email"""
        mask = self.df['filename'] == filename
        if mask.any():
            self.df.loc[mask, 'category'] = category
            self.df.loc[mask, 'priority'] = priority
            self.df.loc[mask, 'reviewed'] = True
            print(f"✅ Categorized '{filename}' as: {category} (priority: {priority})")
            return True
        return False

    def bulk_categorize(self, pattern, category, priority='normal', field='sender'):
        """Bulk categorize emails matching a pattern"""
        if field == 'sender':
            mask = self.df['sender'].str.contains(pattern, case=False, na=False)
        elif field == 'subject':
            mask = self.df['subject'].str.contains(pattern, case=False, na=False)
        else:
            print("❌ Invalid field. Use 'sender' or 'subject'")
            return 0

        count = mask.sum()
        if count > 0:
            self.df.loc[mask, 'category'] = category
            self.df.loc[mask, 'priority'] = priority
            self.df.loc[mask, 'reviewed'] = True
            print(f"✅ Bulk categorized {count} emails as: {category} (priority: {priority})")
        else:
            print(f"❌ No emails found matching pattern: {pattern}")

        return count

    def save_progress(self, filename="review_progress.json"):
        """Save review progress"""
        if self.df is not None:
            # Convert to serializable format
            progress_data = {
                'emails': self.df.to_dict('records'),
                'last_updated': datetime.now().isoformat()
            }

            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(progress_data, f, indent=2, default=str)

            print(f"💾 Progress saved to {filename}")

    def load_progress(self, filename="review_progress.json"):
        """Load review progress"""
        if os.path.exists(filename):
            with open(filename, 'r', encoding='utf-8') as f:
                progress_data = json.load(f)

            self.df = pd.DataFrame(progress_data['emails'])
            print(f"📂 Progress loaded from {filename}")
            return True
        return False

    def interactive_review(self):
        """Interactive email review session"""
        print("🚀 Starting interactive email review...")
        print("Commands:")
        print("  'next' - Show next email")
        print("  'cat <category> [priority]' - Categorize current email")
        print("  'bulk <pattern> <category> [field]' - Bulk categorize")
        print("  'search <query>' - Search emails")
        print("  'stats' - Show statistics")
        print("  'save' - Save progress")
        print("  'quit' - Exit")

        current_email = None

        while True:
            if not current_email:
                current_email = self.get_next_email()
                if current_email is not None:
                    self.display_email(current_email)
                else:
                    print("🎉 All emails reviewed!")
                    break

            try:
                cmd = input("\n> ").strip().lower()

                if cmd == 'next':
                    current_email = self.get_next_email()
                    if current_email is not None:
                        self.display_email(current_email)
                    else:
                        print("🎉 All emails reviewed!")

                elif cmd.startswith('cat '):
                    parts = cmd.split()
                    if len(parts) >= 2:
                        category = parts[1]
                        priority = parts[2] if len(parts) > 2 else 'normal'
                        if current_email is not None:
                            self.categorize_email(current_email['filename'], category, priority)
                            current_email = None  # Move to next

                elif cmd.startswith('bulk '):
                    parts = cmd.split()
                    if len(parts) >= 3:
                        pattern = parts[1]
                        category = parts[2]
                        field = parts[3] if len(parts) > 3 else 'sender'
                        priority = parts[4] if len(parts) > 4 else 'normal'
                        self.bulk_categorize(pattern, category, priority, field)

                elif cmd.startswith('search '):
                    query = cmd[7:]
                    results = self.df[
                        self.df['subject'].str.contains(query, case=False, na=False) |
                        self.df['sender'].str.contains(query, case=False, na=False) |
                        self.df['body'].str.contains(query, case=False, na=False)
                    ]
                    print(f"🔍 Found {len(results)} matches:")
                    for _, email in results.head(5).iterrows():
                        print(f"  📧 {email['subject'][:50]}... from {email['sender']}")

                elif cmd == 'stats':
                    self.show_email_summary()

                elif cmd == 'save':
                    self.save_progress()

                elif cmd == 'quit':
                    self.save_progress()
                    break

                else:
                    print("❌ Unknown command. Type 'help' for commands.")

            except KeyboardInterrupt:
                print("\n⚠️  Interrupted. Saving progress...")
                self.save_progress()
                break
            except Exception as e:
                print(f"❌ Error: {e}")

def main():
    parser = argparse.ArgumentParser(description="Interactive email reviewer for Cursor")
    parser.add_argument('--email-dir', default='emails', help='Directory containing emails')
    parser.add_argument('--load-progress', action='store_true', help='Load previous progress')
    parser.add_argument('--stats', action='store_true', help='Show statistics only')

    args = parser.parse_args()

    reviewer = CursorEmailReviewer(args.email_dir)

    if args.load_progress:
        reviewer.load_progress()

    if args.stats:
        reviewer.show_email_summary()
    else:
        reviewer.interactive_review()

if __name__ == "__main__":
    main()
