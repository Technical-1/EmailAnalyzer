#!/usr/bin/env python3
"""
EmailHelper WebApp - Interactive Email Download & Analysis Tool
"""

from flask import Flask, render_template, request, jsonify, Response
from flask_socketio import SocketIO, emit
import os
import json
import threading
import time
from datetime import datetime
from pathlib import Path
import imaplib
import email
import email.header
import email.utils
import re
from collections import defaultdict, Counter
import pandas as pd
from tqdm import tqdm
import sys

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = 'emailhelper-secret-key-2024'
socketio = SocketIO(app, cors_allowed_origins="*")

# Global variables for download status
download_status = {
    'running': False,
    'progress': 0,
    'current_email': 0,
    'total_emails': 0,
    'status_message': 'Ready',
    'errors': 0,
    'downloaded': 0
}

class EmailDownloader:
    def __init__(self, email_address, password, imap_server="outlook.office365.com", port=993):
        self.email_address = email_address
        self.password = password
        self.imap_server = imap_server
        self.port = port
        self.mail = None
        self.sid = None  # SocketIO session ID

    def connect(self):
        """Connect to IMAP server"""
        try:
            self.mail = imaplib.IMAP4_SSL(self.imap_server, self.port)
            self.mail.login(self.email_address, self.password)
            socketio.emit('status_update', {'message': '✅ Connected to IMAP server'}, room=self.sid)
            return True
        except Exception as e:
            error_msg = str(e).lower()
            if 'authentication' in error_msg or 'password' in error_msg or 'login' in error_msg:
                enhanced_msg = f'''❌ Authentication failed: {e}

💡 If you have 2FA enabled, you need an App Password:
   1. Visit: https://account.microsoft.com/security/app-passwords
   2. Create a new app password
   3. Use that 16-character password here instead of your regular password'''
                socketio.emit('error', {'message': enhanced_msg}, room=self.sid)
            else:
                socketio.emit('error', {'message': f'❌ Failed to connect: {e}'}, room=self.sid)
            return False

    def get_mailboxes(self):
        """List all available mailboxes"""
        status, mailboxes = self.mail.list()
        if status == 'OK':
            mailbox_list = []
            for mailbox in mailboxes:
                mailbox_list.append(mailbox.decode())
            socketio.emit('mailboxes_found', {'mailboxes': mailbox_list}, room=self.sid)
        return mailboxes

    def select_mailbox(self, mailbox="INBOX"):
        """Select a mailbox to work with"""
        status, data = self.mail.select(mailbox)
        if status == 'OK':
            total = int(data[0])
            socketio.emit('mailbox_selected', {
                'mailbox': mailbox,
                'total_emails': total
            }, room=self.sid)
            return total
        else:
            socketio.emit('error', {'message': f'❌ Failed to select mailbox: {mailbox}'}, room=self.sid)
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
        invalid_chars = '<>:"/\\|?*'
        for char in invalid_chars:
            filename = filename.replace(char, '_')
        filename = re.sub(r'[_\s]+', '_', filename)
        if len(filename) > 100:
            filename = filename[:97] + "..."
        return filename.strip('_')

    def save_email(self, email_message, email_id, output_dir):
        """Save a single email as text file"""
        subject = self.decode_str(email_message.get('Subject', 'No Subject'))
        sender = self.decode_str(email_message.get('From', 'Unknown'))
        date = email_message.get('Date', 'Unknown Date')
        to = self.decode_str(email_message.get('To', ''))
        cc = self.decode_str(email_message.get('Cc', ''))

        try:
            parsed_date = email.utils.parsedate_to_datetime(date)
            date_str = parsed_date.strftime('%Y-%m-%d %H:%M:%S')
            date_filename = parsed_date.strftime('%Y%m%d_%H%M%S')
        except:
            date_str = str(date)
            date_filename = "unknown_date"

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

        clean_subject = self.clean_filename(subject)
        filename = f"{date_filename}_{email_id:06d}_{clean_subject}.txt"
        filepath = os.path.join(output_dir, filename)

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
        global download_status

        os.makedirs(output_dir, exist_ok=True)

        total_emails = self.select_mailbox(mailbox)
        if total_emails == 0:
            return

        download_status.update({
            'running': True,
            'progress': 0,
            'current_email': 0,
            'total_emails': total_emails,
            'status_message': f'Starting download of {total_emails} emails',
            'errors': 0,
            'downloaded': 0
        })

        socketio.emit('download_started', download_status, room=self.sid)

        downloaded = 0
        errors = 0

        for start in range(1, total_emails + 1, batch_size):
            if not download_status['running']:
                socketio.emit('download_cancelled', room=self.sid)
                break

            end = min(start + batch_size - 1, total_emails)

            status, data = self.mail.fetch(f'{start}:{end}', '(RFC822)')
            if status != 'OK':
                socketio.emit('error', {'message': f'❌ Failed to fetch emails {start}-{end}'}, room=self.sid)
                continue

            for i in range(0, len(data), 2):
                try:
                    email_id = start + (i // 2)
                    raw_email = data[i][1]

                    email_message = email.message_from_bytes(raw_email)
                    filepath = self.save_email(email_message, email_id, output_dir)

                    downloaded += 1
                    download_status.update({
                        'current_email': email_id,
                        'downloaded': downloaded,
                        'progress': (downloaded / total_emails) * 100,
                        'status_message': f'Downloaded {downloaded}/{total_emails} emails'
                    })

                    socketio.emit('progress_update', download_status, room=self.sid)

                    if downloaded % 10 == 0:
                        socketio.sleep(0.1)  # Small delay to prevent overwhelming the UI

                except Exception as e:
                    errors += 1
                    download_status['errors'] = errors
                    socketio.emit('error', {'message': f'❌ Error processing email {email_id}: {e}'}, room=self.sid)

        download_status.update({
            'running': False,
            'status_message': f'✅ Download complete! {downloaded} emails saved, {errors} errors'
        })

        socketio.emit('download_complete', download_status, room=self.sid)
        return downloaded, errors

    def close(self):
        """Close IMAP connection"""
        if self.mail:
            self.mail.close()
            self.mail.logout()

class EmailProcessor:
    def __init__(self, email_dir="emails"):
        self.email_dir = Path(email_dir)
        self.df = None

    def load_emails(self):
        """Load all email files from directory"""
        email_files = list(self.email_dir.glob("*.txt"))
        emails = []

        for filepath in email_files:
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()

                lines = content.split('\n')
                headers = {}
                body_start = 0

                for i, line in enumerate(lines):
                    if line.startswith('=') and len(line) > 50:
                        body_start = i + 2
                        break
                    if ':' in line and not line.startswith(' '):
                        key, value = line.split(':', 1)
                        headers[key.strip()] = value.strip()

                body = '\n'.join(lines[body_start:]).strip()

                date_str = headers.get('DATE', '')
                try:
                    if date_str:
                        parsed_date = email.utils.parsedate_to_datetime(date_str)
                    else:
                        parsed_date = None
                except:
                    parsed_date = None

                emails.append({
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
                })

            except Exception as e:
                print(f"Error loading {filepath}: {e}")

        self.df = pd.DataFrame(emails)
        if not self.df.empty and 'date' in self.df.columns:
            self.df = self.df.sort_values('date', na_position='last')

        return self.df

    def analyze_emails(self):
        """Perform comprehensive email analysis"""
        if self.df is None or self.df.empty:
            return None

        analysis = {
            'total_emails': len(self.df),
            'date_range': {
                'start': str(self.df['date'].min()) if not self.df['date'].isna().all() else None,
                'end': str(self.df['date'].max()) if not self.df['date'].isna().all() else None
            }
        }

        # Sender analysis
        if not self.df['sender'].isna().all():
            sender_counts = self.df['sender'].value_counts().head(20)
            analysis['top_senders'] = sender_counts.to_dict()
        else:
            analysis['top_senders'] = {}

        # Subject analysis
        subjects = self.df['subject'].fillna('')
        all_words = []
        for subject in subjects:
            words = re.findall(r'\b\w+\b', subject.lower())
            all_words.extend(words)

        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 're', 'fwd', 'fw'}
        filtered_words = [word for word in all_words if len(word) > 2 and word not in stop_words]
        word_counts = Counter(filtered_words).most_common(20)
        analysis['common_subject_words'] = dict(word_counts)

        # Important categories
        account_keywords = ['account', 'password', 'login', 'security', 'verification', 'confirm', 'reset']
        financial_keywords = ['invoice', 'payment', 'billing', 'receipt', 'charge', 'bank', 'credit']
        service_keywords = ['service', 'subscription', 'membership', 'update', 'notification']

        account_emails = 0
        financial_emails = 0
        service_emails = 0

        for _, email in self.df.iterrows():
            text = (email['subject'] + ' ' + email['body']).lower()
            if any(keyword in text for keyword in account_keywords):
                account_emails += 1
            if any(keyword in text for keyword in financial_keywords):
                financial_emails += 1
            if any(keyword in text for keyword in service_keywords):
                service_emails += 1

        analysis['important_categories'] = {
            'account_security': account_emails,
            'financial': financial_emails,
            'services': service_emails
        }

        # Time analysis
        if not self.df['date'].isna().all():
            years = self.df['date'].dt.year.value_counts().sort_index()
            analysis['emails_by_year'] = years.to_dict()
        else:
            analysis['emails_by_year'] = {}

        return analysis

# Global downloader instance
current_downloader = None

@app.route('/')
def index():
    """Main page"""
    return render_template('index.html')

@app.route('/api/status')
def get_status():
    """Get current download status"""
    return jsonify(download_status)

@app.route('/api/emails')
def get_emails():
    """Get list of downloaded emails"""
    email_dir = Path('emails')
    if not email_dir.exists():
        return jsonify({'emails': [], 'total': 0})

    email_files = list(email_dir.glob('*.txt'))
    emails = []

    for filepath in email_files[:100]:  # Limit for performance
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            lines = content.split('\n')
            headers = {}
            body_start = 0

            for i, line in enumerate(lines):
                if line.startswith('=') and len(line) > 50:
                    body_start = i + 2
                    break
                if ':' in line and not line.startswith(' '):
                    key, value = line.split(':', 1)
                    headers[key.strip()] = value.strip()

            emails.append({
                'filename': filepath.name,
                'subject': headers.get('SUBJECT', 'No Subject'),
                'sender': headers.get('FROM', 'Unknown'),
                'date': headers.get('DATE', 'Unknown Date'),
                'body_preview': '\n'.join(lines[body_start:])[:200] + '...'
            })

        except Exception as e:
            continue

    return jsonify({'emails': emails, 'total': len(email_files)})

@app.route('/api/email/<filename>')
def get_email(filename):
    """Get full email content"""
    try:
        filepath = Path('emails') / filename
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        return jsonify({'content': content})
    except Exception as e:
        return jsonify({'error': str(e)}), 404

@app.route('/api/analyze')
def analyze_emails():
    """Analyze downloaded emails"""
    try:
        processor = EmailProcessor('emails')
        processor.load_emails()
        analysis = processor.analyze_emails()

        if analysis:
            return jsonify(analysis)
        else:
            return jsonify({'error': 'No emails found to analyze'}), 404

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    print('Client connected')

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    print('Client disconnected')

@socketio.on('start_download')
def handle_start_download(data):
    """Handle download start request"""
    global current_downloader, download_status

    if download_status['running']:
        emit('error', {'message': 'Download already in progress'})
        return

    email_address = data.get('email')
    password = data.get('password')
    mailbox = data.get('mailbox', 'INBOX')
    output_dir = data.get('output_dir', 'emails')

    if not email_address or not password:
        emit('error', {'message': 'Email and password required'})
        return

    # Reset status
    download_status.update({
        'running': False,
        'progress': 0,
        'current_email': 0,
        'total_emails': 0,
        'status_message': 'Connecting...',
        'errors': 0,
        'downloaded': 0
    })

    # Start download in background thread
    def download_thread():
        global current_downloader
        try:
            current_downloader = EmailDownloader(email_address, password)
            current_downloader.sid = request.sid

            if current_downloader.connect():
                current_downloader.download_emails(mailbox, output_dir)
        except Exception as e:
            emit('error', {'message': f'Download failed: {e}'})
        finally:
            if current_downloader:
                current_downloader.close()

    thread = threading.Thread(target=download_thread)
    thread.daemon = True
    thread.start()

@socketio.on('stop_download')
def handle_stop_download():
    """Handle download stop request"""
    global download_status
    download_status['running'] = False
    emit('download_stopped')

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
