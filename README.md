# EmailHelper - Complete Email Download & Processing Solution

A comprehensive toolkit to download all your emails before access cutoff and efficiently process them for review.

## 🚨 URGENT: For Outlook/UFL Email Users

If your university email access is being cut off tomorrow, this tool will help you:
- Download ALL 6000+ emails automatically
- Process and analyze them efficiently
- Identify important accounts and services
- Review emails at lightning speed using Cursor

## 🔐 IMPORTANT: 2-Factor Authentication (2FA)

**If your Outlook account has 2FA enabled (most do), you CANNOT use your regular password!**

### You MUST create an "App Password" first:

1. Go to: https://account.microsoft.com/security/app-passwords
2. Sign in with your Outlook/UFL email
3. Click "Create a new app password"
4. Name it "EmailHelper Backup"
5. **Copy the 16-character password shown**
6. **Use this app password in EmailHelper** (not your regular password)

**Without an App Password, the download will fail with authentication errors.**

## 🚀 Quick Start - Interactive WebApp

```bash
# One command to start the interactive web interface
python run_webapp.py
```

**What you'll get:**
- 🌐 **Web browser interface** - No command line needed!
- 📊 **Real-time progress** - Watch emails download live
- 👀 **Interactive viewer** - Click to view any email
- 🔍 **One-click analysis** - Instant insights into your emails
- 📈 **Visual charts** - See email patterns and statistics

The webapp automatically handles:
- Installing dependencies
- Setting up directories
- Opening your browser

## 🌟 Interactive WebApp - All-in-One Solution

### `run_webapp.py` - The Complete EmailHelper Experience ⭐
**One command gives you everything:**
- **Web Interface**: Modern, responsive browser-based UI
- **Real-time Download**: Watch progress bars, see emails being saved
- **Interactive Viewer**: Click any email to read it instantly
- **Smart Analysis**: One-click analysis with visual charts
- **Live Search**: Find emails instantly
- **Progress Tracking**: Complete statistics dashboard

### 🔧 Advanced Tools (Command Line)

For power users who prefer command line:

- **`email_downloader_simple.py`** - Standalone email downloader
- **`email_processor_simple.py`** - Email analysis and search
- **`cursor_email_reviewer.py`** - Interactive review tool
- **`app.py`** - Raw Flask webapp (for development)

## 📧 Step-by-Step Instructions

### Step 1: Handle 2FA (CRITICAL - 2 minutes)

**STOP RIGHT HERE:** If your Outlook account has 2FA enabled, you need an App Password first!

**Quick 2FA Check:**
1. Go to: https://account.microsoft.com/security/app-passwords
2. Try to sign in with your Outlook/UFL email
3. If it asks for a verification code → You have 2FA → Create App Password
4. If it lets you in directly → No 2FA → Use regular password

**Create App Password:**
- Click "Create a new app password"
- Name it "EmailHelper"
- Copy the 16-character password
- Use THIS in EmailHelper (not your regular password)

### Step 2: Launch the Interactive WebApp (30 seconds)

```bash
# Simply run this - everything else is automatic!
python start.py
```

**The webapp will:**
1. ✅ Install all required dependencies
2. ✅ Create necessary directories
3. ✅ Start the web server
4. ✅ Open your browser automatically

### Step 2: Download Your Emails (Watch Live!)

In the web interface:
1. Enter your Outlook/UFL email address
2. **Enter your password:**
   - If 2FA is **disabled**: Use your regular password
   - If 2FA is **enabled**: Use an **App Password** (see below)
3. Click **"Start Download"**
4. **Watch the progress bar** as emails download in real-time!

#### 🔐 **If You Have 2-Factor Authentication (2FA) Enabled:**

**You MUST use an "App Password" instead of your regular password.**

**For Outlook/Office365/UFL accounts:**

1. Go to: https://account.microsoft.com/security
2. Sign in with your email
3. Under "Security" → "More security options"
4. Find "App passwords" section
5. Click "Create a new app password"
6. Give it a name like "EmailHelper Backup"
7. **Copy the generated 16-character password**
8. **Use this app password in the webapp** (not your regular password)

**Important Notes:**
- App passwords are one-time use for security
- You may need to create a new one if this fails
- Your regular password won't work with IMAP when 2FA is enabled
- The app password bypasses 2FA for this specific app

### Step 3: Analyze & Explore

Once download completes:
1. Click **"Analyze Downloaded Emails"**
2. View statistics, charts, and insights
3. **Click any email** in the list to read it
4. Use the search box to find specific emails

### Step 4: Identify Critical Emails

The analysis will highlight:
- 🔐 **Account/Security emails** (password resets, verifications)
- 💰 **Financial emails** (invoices, banking, payments)
- 🛠️ **Service emails** (subscriptions, accounts you maintain)

---

## ⚙️ Manual Setup (Alternative)

```bash
# Clone or download this repository
cd /path/to/EmailHelper

# Install dependencies
python setup.py
```

### Step 2: Download Your Emails (Time varies - ~1-2 hours for 6000 emails)

```bash
python email_downloader.py
```

**What it will ask:**
1. Your Outlook/UFL email address
2. Your password (use app password if 2FA enabled)
3. Mailbox to download (usually "INBOX")
4. Output directory (default: "emails")

**IMAP Server Settings:**
- The tool automatically tries common Outlook servers
- For UFL: Usually `outlook.office365.com` or `imap-mail.outlook.com`
- Port: 993 (SSL)

### Step 3: Analyze Your Emails (2 minutes)

```bash
# Run full analysis
python email_processor.py --analyze --export-summary --create-index
```

This will show you:
- Total emails and date ranges
- Top senders (who emails you most)
- Common subject patterns
- Potential important emails (accounts, financial, services)

### Step 4: Review Emails Efficiently (However long you need)

```bash
# Start interactive review
python cursor_email_reviewer.py
```

**Commands in review mode:**
```
next                    - Show next email to review
cat banking high       - Categorize current email as "banking" priority "high"
bulk "amazon.com" shopping - Bulk categorize all Amazon emails as "shopping"
search "password"      - Search for emails containing "password"
stats                  - Show review progress statistics
save                   - Save your progress
quit                   - Exit (auto-saves)
```

## 🎯 Smart Review Strategy

### Priority Categories to Create:
1. **accounts** - Password resets, account verification, security alerts
2. **financial** - Banking, invoices, payments, credit cards
3. **services** - Subscriptions, memberships, utilities
4. **important** - Work-related, legal, tax documents
5. **personal** - Friends, family (can review later)
6. **spam** - Marketing, newsletters (can delete after review)

### Bulk Categorization Examples:
```bash
# Common patterns to categorize automatically
bulk "bank" financial high
bulk "amazon" shopping medium
bulk "netflix" entertainment low
bulk "password" accounts high
bulk "invoice" financial high
bulk "newsletter" marketing low
```

## 🔍 Finding Important Emails

### Critical emails to look for first:
1. **Account Recovery**: Password reset emails, account verification
2. **Financial**: Bank statements, credit card notifications
3. **Services**: Subscription confirmations, service logins
4. **Legal/Tax**: Important documents, tax information
5. **Addresses**: Any emails with your address/contact info

### Search Commands:
```bash
# Search for specific terms
python email_processor.py --search "password reset" --field all
python email_processor.py --search "bank" --field sender
python email_processor.py --search "invoice" --field subject
```

## 💾 Data Storage

### Files Created:
- `emails/` - Individual email text files
- `email_summary.json` - Analysis summary
- `email_index.csv` - Searchable email index
- `review_progress.json` - Your review progress

### Email Format:
Each email is saved as:
```
================================================================================
EMAIL ID: 12345
SUBJECT: Your Subject Here
FROM: sender@example.com
TO: you@ufl.edu
DATE: 2024-01-15 14:30:00
================================================================================

[Full email body text]
```

## 🔐 Security & Privacy

- **Credentials**: Only used for IMAP connection, not stored
- **App Passwords**: Use app passwords if 2FA is enabled
- **Local Processing**: All processing happens on your machine
- **No Upload**: Emails never leave your computer

## 🚨 Troubleshooting

### Can't connect to email?
- Try using an app password instead of your regular password
- Check if IMAP is enabled in your email settings
- Verify your email provider's IMAP server settings

### Download is slow?
- The tool processes emails in batches of 100
- For 6000 emails, expect 1-2 hours
- You can stop and restart - it won't re-download

### Memory issues?
- Large emails are processed individually
- Reduce batch size in the script if needed

### Permission errors?
- Ensure you have write permissions in the directory
- Run with appropriate user permissions

## 🆘 Emergency Backup Options

If the IMAP method doesn't work:

### Option 1: Outlook Desktop App
1. Open Outlook desktop app
2. File → Open & Export → Import/Export
3. Export to PST file
4. Use PST conversion tools to extract emails

### Option 2: Web Interface
1. Use Outlook web interface
2. Select all emails (Ctrl+A)
3. Forward to another email account
4. Download from the backup account

### Option 3: University IT Support
- Contact UFL IT before cutoff
- Ask for email export assistance
- Request mailbox backup

## 📈 Advanced Features

### Custom Analysis:
```bash
# Analyze specific date ranges
python email_processor.py --analyze

# Export detailed reports
python email_processor.py --export-summary
```

### Integration with Local LLM:
The text files in `emails/` can be directly fed to local LLMs like:
- GPT-4 with API
- Local models via transformers
- Cursor's built-in AI features

## 🤝 Support

This tool is designed specifically for urgent email backup scenarios. If you encounter issues:

1. Check the troubleshooting section above
2. Verify your email account settings
3. Try with a small test mailbox first
4. Contact your email provider's support

---

**Remember**: Act fast! If your email access is cut off tomorrow, having this local backup could save you countless hours of account recovery and service reconnection.
