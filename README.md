# 📧 Email Archive Explorer

<div align="center">

![Email Analyzer](https://img.shields.io/badge/Email-Analyzer-blue?style=for-the-badge&logo=mail.ru&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white)

**A powerful, privacy-first email archive analyzer that runs entirely in your browser.**

Explore years of archived emails offline. Automatically discover accounts, track purchases, manage subscriptions, and gain insights—all without uploading a single email to any server.

[Live Demo](#live-demo) • [Features](#-features) • [Getting Started](#-getting-started) • [Tech Stack](#-tech-stack)

</div>

---

## 🎯 Live Demo

<!-- PASTE YOUR VERCEL LINK HERE -->
**🚀 Coming Soon!**

---

## ✨ Features

### 📥 Universal Email Import

Import your email archives from multiple sources:

| Format | Source | Support |
|--------|--------|---------|
| `.olm` | Outlook for Mac | ✅ Full |
| `.mbox` | Gmail Takeout | ✅ Full |
| `.mbox` | Mozilla Thunderbird | ✅ Full |
| `.mbx` | Other email clients | ✅ Partial |

**Import capabilities:**
- 📊 Progress tracking with stage-by-stage updates
- ⚡ Handles archives with **10,000+ emails** efficiently
- 🔄 Incremental imports—add more archives anytime
- 📎 Attachment preservation and extraction

---

### 🔍 Smart Search & Filtering

Advanced search syntax for finding exactly what you need:

```
from:amazon subject:order        # Orders from Amazon
has:attachment before:2024-01   # Attachments before January 2024
from:netflix OR from:spotify    # Entertainment subscriptions
"password reset"                # Exact phrase matching
is:starred is:unread            # Status filters
```

**Supported operators:**
| Operator | Example | Description |
|----------|---------|-------------|
| `from:` | `from:amazon.com` | Filter by sender |
| `to:` | `to:me@email.com` | Filter by recipient |
| `subject:` | `subject:receipt` | Search subject lines |
| `date:` | `date:2024` | Filter by year/month/day |
| `before:` / `after:` | `before:2024-06-01` | Date range |
| `has:attachment` | - | Only with attachments |
| `is:starred` | - | Starred emails |
| `is:unread` / `is:read` | - | Read status |
| `folder:` | `folder:inbox` | Specific folder |

---

### 🧠 Auto-Discovery & Detection

The analyzer automatically identifies and categorizes your emails:

#### 🔐 Account Detection
- Detects signups from **100+ known services**
- Categorizes by type: streaming, e-commerce, social, banking, development, etc.
- Tracks signup dates and email activity per service
- Confidence scoring for accurate detection

**Detected services include:** Netflix, Amazon, Spotify, GitHub, LinkedIn, Dropbox, Uber, DoorDash, Airbnb, and many more.

#### 🛒 Purchase Tracking
- Extracts orders from receipt emails
- Multi-currency support: USD, EUR, GBP, JPY, and more
- Order number extraction
- Merchant identification
- Purchase categorization

#### 🔄 Subscription Management
- Identifies recurring services (monthly, yearly, weekly)
- Tracks subscription costs
- Categories: streaming, software, news, fitness, etc.
- Monitors renewal patterns

#### 📰 Newsletter & Promotional Detection
- Identifies marketing emails vs. newsletters
- Extracts **unsubscribe links** when available
- One-click unsubscribe support (via List-Unsubscribe headers)
- Sender reputation analysis

---

### 📊 Analytics Dashboard

Visualize your email patterns with interactive charts:

| Chart | Description |
|-------|-------------|
| 📈 **Email Volume** | Emails over time (daily/weekly/monthly) |
| 👥 **Top Senders** | Bar chart of most frequent senders |
| 💰 **Spending** | Purchase spending over time |
| 🔥 **Activity Heatmap** | Day of week vs. hour patterns |

---

### 📎 Attachment Management

A dedicated gallery for all your email attachments:

- **Grid & List views** for browsing
- **Filter by type**: Images, Documents, Archives, Other
- **Preview support**: Images and PDFs render inline
- **Lightbox viewer** with zoom and pan
- **Download**: Individual or batch (ZIP)
- **Jump to email**: Quick link to the parent email

---

### 💬 Email Threading & Conversations

Emails are automatically grouped into conversations:

- Groups by thread ID or subject normalization
- **Collapsible conversation view**
- See the full context of email chains
- Unread count per thread
- Participant listing

---

### 🗂️ Drag & Drop Organization

Organize emails visually:

- Drag emails to sidebar folders
- **Multi-select** with Shift+Click
- Visual drop indicators
- **Undo actions** with 5-second toast notifications
- System folders: Inbox, Favorites, Archive, Trash

---

### 📇 Contact Management

Automatically builds your contact list from email senders:

- Name and email extraction
- Email count per contact
- Last contact date tracking
- **vCard export** (single or batch)
- Standard vCard 3.0 format

---

### 📅 Calendar Integration

Extracts calendar events from your archive:

- Event details: title, date, time, location
- All-day event support
- Attendee parsing
- Clean calendar view

---

### 🔒 Privacy & Security

**Your data never leaves your device:**

| Feature | Description |
|---------|-------------|
| 🔐 **100% Offline** | All processing happens in your browser |
| 💾 **Local Storage** | Uses IndexedDB—no server uploads |
| 🔑 **Encryption** | AES-256-GCM for backup files |
| 🛡️ **Key Derivation** | PBKDF2 for secure passphrase handling |
| 📤 **Secure Export** | Encrypted backup files |

---

### 🛠️ Backup & Restore

Full data portability:

- **Export** all data as JSON or encrypted archive
- **Selective export** by date range or folder
- **Encrypted backups** with passphrase protection
- **Import validation** ensures data integrity
- **Factory reset** option for clearing all data

---

### 🎨 User Experience

#### Theme Support
- ☀️ Light mode
- 🌙 Dark mode  
- 🖥️ System preference detection
- Persistent preference storage

#### Performance
- **Virtual scrolling** for smooth lists with thousands of items
- **Lazy loading** of email bodies (headers first)
- **Web Worker parsing** (UI never freezes)
- **Indexed queries** for fast search

#### Mobile Responsive
- Collapsible sidebar
- Touch-friendly targets
- Optimized layouts for all screen sizes

#### Print Support
- Clean print-friendly email view
- Proper header formatting
- Attachment list in print output

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/email-analyzer.git
cd email-analyzer

# Install dependencies
cd web
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Building for Production

```bash
# Build optimized bundle
npm run build

# Preview production build
npm run preview
```

### Running Tests

```bash
# Run all tests
npm run test

# Run with coverage
npm run test:coverage
```

---

## 💻 Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | React 19 |
| **Language** | TypeScript 5.9 |
| **Build Tool** | Vite 7 |
| **Styling** | Tailwind CSS 4 |
| **State Management** | Zustand |
| **Database** | Dexie (IndexedDB) |
| **Charts** | Recharts |
| **Icons** | Lucide React |
| **Routing** | React Router 7 |
| **Drag & Drop** | react-dnd |
| **Virtualization** | @tanstack/react-virtual |
| **Date Handling** | date-fns |
| **Archive Processing** | JSZip |
| **Testing** | Vitest + Testing Library |

---

## 📁 Project Structure

```
email-analyzer/
├── web/
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── charts/        # Analytics visualizations
│   │   │   └── ...
│   │   ├── pages/             # Route pages
│   │   ├── services/          # Business logic
│   │   │   ├── olmParser.ts   # OLM file parsing
│   │   │   ├── mboxParser.ts  # MBOX file parsing
│   │   │   ├── accountDetector.ts
│   │   │   ├── purchaseDetector.ts
│   │   │   ├── subscriptionDetector.ts
│   │   │   ├── newsletterDetector.ts
│   │   │   ├── encryptionService.ts
│   │   │   └── ...
│   │   ├── db/                # IndexedDB schema
│   │   ├── hooks/             # Custom React hooks
│   │   ├── store/             # Zustand state
│   │   ├── types/             # TypeScript definitions
│   │   └── utils/             # Helper functions
│   ├── docs/                  # Implementation docs
│   └── __tests__/             # Test suites
└── README.md
```

---

## 📖 How to Export Your Emails

### From Outlook for Mac (.olm)

1. Open **Outlook for Mac**
2. Go to **File → Export**
3. Select **"Outlook for Mac Data File (.olm)"**
4. Choose what to export (Mail, Contacts, Calendar)
5. Save the file
6. Drag the `.olm` file into Email Analyzer

### From Gmail (Google Takeout)

1. Go to [Google Takeout](https://takeout.google.com)
2. Deselect all, then select only **"Mail"**
3. Choose **MBOX format**
4. Create and download the export
5. Extract the ZIP and import the `.mbox` file

### From Thunderbird

1. Install the **ImportExportTools NG** add-on
2. Right-click a folder → **Export folder as MBOX**
3. Save the file
4. Import into Email Analyzer

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built with [React](https://react.dev/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Icons from [Lucide](https://lucide.dev/)
- Charts powered by [Recharts](https://recharts.org/)

---

<div align="center">

**Made with ❤️ by [Jacob Kanfer](https://jacobkanfer.com)**

</div>

