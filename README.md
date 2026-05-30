# 📧 Email Archive Explorer

<div align="center">

![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white)

**A privacy-first email archive analyzer that runs entirely in your browser.**

Explore years of archived emails offline. Automatically discover accounts, track purchases, manage subscriptions, and gain insights—all without uploading a single email to any server.

**🔗 [Live Demo](https://email-analyzer-eta.vercel.app)**

</div>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📥 **Universal Import** | Supports `.olm` (Outlook), `.mbox` (Gmail/Thunderbird), and Gmail Takeout `.zip` files |
| 🔍 **Smart Search** | Advanced syntax: `from:`, `subject:`, `has:attachment`, `before:`, date ranges, and more |
| 🔐 **Account Detection** | Auto-discovers signups from 100+ services (Netflix, Amazon, GitHub, etc.) |
| 🛒 **Purchase Tracking** | Extracts orders, amounts, and merchants from receipt emails |
| 🔄 **Subscriptions** | Identifies recurring services and tracks renewal patterns |
| 📰 **Newsletters** | Detects marketing emails and extracts unsubscribe links |
| 📊 **Analytics** | Email volume charts, top senders, spending trends, activity heatmaps |
| 📎 **Attachments** | Gallery view with previews, filtering, and batch downloads |
| 💬 **Threading** | Groups emails into conversations automatically |
| 📇 **Contacts** | Builds contact list from senders with vCard export |
| 🔒 **100% Private** | All processing happens locally—your data never leaves your device |
| 🌙 **Dark Mode** | Toggle between light and dark themes |
| 📱 **Mobile Responsive** | Slide-out sidebar navigation optimized for mobile devices |
| ⚙️ **Custom Rules** | Match on sender/subject/body and auto-tag, move, star, or mark emails read — applied on import and re-runnable across the whole archive |
| 🏷️ **Tags** | Label emails by hand or automatically via rules; tags render as chips in the list and detail views |
| 💾 **Saved Searches** | Save and reuse frequently used search queries |
| ⚡ **Performance** | Web Worker parsing, virtual scrolling, lazy loading for large archives |

---

## 🚀 How to Export Your Emails

### Outlook for Mac (.olm)
1. Go to **File → Export**
2. Select **"Outlook for Mac Data File (.olm)"**
3. Save and import into Email Archive Explorer

### Gmail (Google Takeout)
1. Go to [takeout.google.com](https://takeout.google.com)
2. Deselect all, then select only **"Mail"** with MBOX format
3. Download and import the `.mbox` file (or the entire `.zip`)

### Thunderbird (.mbox)
1. Install **ImportExportTools NG** add-on
2. Right-click a folder → **Export folder as MBOX**
3. Import the `.mbox` file

---

## 💻 Tech Stack

| **Frontend** | React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4 |
| **State** | Zustand |
| **Storage** | Dexie (IndexedDB) |
| **Charts** | Recharts |
| **Other** | React Router 7, react-dnd, @tanstack/react-virtual, JSZip |

---

<div align="center">

**Made by [Jacob Kanfer](https://jacobkanfer.com)**

</div>
