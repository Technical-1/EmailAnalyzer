# Phase 7: Data Import/Export & Security

## Overview

Phase 7 adds comprehensive data import/export capabilities and local encryption for enhanced privacy. This phase enables users to import emails from various sources (MBOX, Gmail Takeout) and securely backup/restore their data.

## Features Implemented

### 1. MBOX Parser

**File**: `src/services/mboxParser.ts`

The MBOX parser supports the standard MBOX email archive format used by:
- Gmail Takeout
- Mozilla Thunderbird
- Apple Mail
- Many other email clients

#### Key Features:
- Parses standard MBOX format with "From " line separators
- Handles quoted-printable and base64 content encoding
- Decodes RFC 2047 encoded headers (UTF-8, etc.)
- Extracts email metadata (sender, recipients, date, subject)
- Preserves thread IDs for conversation threading
- Progress reporting for large files

#### Usage:

```typescript
import { mboxParser } from './services/mboxParser';

// Check if file is MBOX format
if (mboxParser.isMBOXFile(file)) {
  const emails = await mboxParser.parseMBOXFile(file, (progress, message) => {
    console.log(`${progress}%: ${message}`);
  });
}
```

### 2. Gmail Takeout Parser

**File**: `src/services/gmailTakeoutParser.ts`

Specialized parser for Google Takeout email archives.

#### Key Features:
- Handles ZIP structure from Google Takeout
- Automatically finds all MBOX files within the archive
- Maps Gmail labels to folder IDs
- Deduplicates emails across labels
- Validates Takeout structure before import

#### Gmail Label Mapping:

| Gmail Label | Folder ID |
|-------------|-----------|
| Inbox | `inbox` |
| Sent | `sent` |
| Drafts | `drafts` |
| Trash | `trash` |
| Spam | `spam` |
| All Mail | `archive` |
| Starred | `starred` |
| Custom Labels | `gmail-{label-name}` |

#### Usage:

```typescript
import { gmailTakeoutParser } from './services/gmailTakeoutParser';

// Validate before import
const validation = await gmailTakeoutParser.validateTakeout(file);
if (validation.valid) {
  const emails = await gmailTakeoutParser.parseGmailTakeout(file, onProgress);
}
```

### 3. Encryption Service

**File**: `src/services/encryptionService.ts`

Provides AES-GCM encryption using the Web Crypto API for local data security.

#### Security Features:
- AES-256-GCM encryption (authenticated encryption)
- PBKDF2 key derivation with 100,000 iterations
- Unique random IV for each encryption operation
- Secure salt storage for consistent key derivation

#### API Methods:

```typescript
import { encryptionService } from './services/encryptionService';

// Check browser support
if (encryptionService.isSupported()) {
  // Set up encryption with passphrase
  await encryptionService.setupEncryption('user-passphrase');
  
  // Encrypt data
  const encrypted = await encryptionService.encrypt('secret data');
  
  // Decrypt data
  const decrypted = await encryptionService.decrypt(encrypted);
  
  // Encrypt/decrypt objects
  const encObj = await encryptionService.encryptObject({ key: 'value' });
  const decObj = await encryptionService.decryptObject(encObj);
  
  // Lock (clear key from memory)
  encryptionService.lock();
  
  // Verify passphrase
  const isValid = await encryptionService.verifyPassphrase('user-passphrase');
  
  // Generate strong passphrase
  const passphrase = encryptionService.generatePassphrase(4); // e.g., "apple-forest-thunder-zenith"
}
```

### 4. Backup Service

**File**: `src/services/backupService.ts`

Comprehensive backup and restore functionality.

#### Export Options:
- **Selective export**: Choose which data types to include
- **Date range filtering**: Export only emails within a date range
- **Folder filtering**: Export specific folders only
- **Encryption**: Optionally encrypt the backup

#### Backup Format:
- ZIP archive containing JSON files
- `metadata.json` - Backup info (version, counts, encryption status)
- `emails.json` / `emails.enc` - Email data
- `accounts.json` / `accounts.enc` - Account data
- `purchases.json` / `purchases.enc` - Purchase data
- `contacts.json` / `contacts.enc` - Contact data
- `calendar-events.json` / `calendar-events.enc` - Calendar data
- `folders.json` / `folders.enc` - Folder data

#### Usage:

```typescript
import { backupService } from './services/backupService';

// Export backup
const blob = await backupService.exportBackup({
  includeEmails: true,
  includeAccounts: true,
  includePurchases: true,
  includeContacts: true,
  includeCalendarEvents: true,
  includeFolders: true,
  dateRange: {
    start: new Date('2024-01-01'),
    end: new Date('2024-12-31'),
  },
  encrypt: true,
}, onProgress);

// Download backup
backupService.downloadBackup(blob, 'my-backup.zip');

// Get backup info without importing
const metadata = await backupService.getBackupInfo(file);

// Import backup
await backupService.importBackup(file, onProgress);

// Factory reset
await backupService.clearAllData();
```

## Data Flow

### Import Flow

```
User selects file
        ↓
Detect file type (OLM/MBOX/ZIP)
        ↓
Parse emails → Apply detectors → Store in IndexedDB
        ↓
Update UI with imported data
```

### Export Flow

```
User selects options
        ↓
Collect data from IndexedDB
        ↓
Apply filters (date, folder)
        ↓
Encrypt if enabled → Create ZIP
        ↓
Download file
```

## Testing

### Test Files

- `src/__tests__/phase-7/mboxParser.test.ts`
- `src/__tests__/phase-7/encryptionService.test.ts`
- `src/__tests__/phase-7/backupService.test.ts`

### Running Tests

```bash
npm run test -- --grep "phase-7"
```

### Test Coverage

| Feature | Tests |
|---------|-------|
| MBOX parsing | 6 tests |
| Gmail Takeout | 4 tests |
| Encryption | 10 tests |
| Backup/Restore | 6 tests |

## Security Considerations

### Encryption Best Practices

1. **Passphrase Strength**: Use the `generatePassphrase()` method for strong passphrases
2. **Memory Security**: Call `lock()` when the user logs out or closes the app
3. **No Server Storage**: Encryption is entirely client-side; passphrases are never transmitted

### Data Privacy

- All data remains in the browser's IndexedDB
- Backups can be encrypted before download
- No data is sent to any server

## File Format Support

| Format | Source | Status |
|--------|--------|--------|
| OLM | Outlook for Mac | ✅ Existing |
| MBOX | Gmail, Thunderbird, Apple Mail | ✅ New |
| Gmail Takeout ZIP | Google Takeout | ✅ New |
| EML | Individual emails | 🔜 Future |

## Implementation Notes

### MBOX Parsing Challenges

1. **Line Encoding**: MBOX uses different line endings (CR, LF, CRLF)
2. **From Escaping**: Lines starting with "From " in body must be escaped
3. **Multi-part MIME**: Complex emails may have multiple parts

### Encryption Key Management

The encryption key is derived from:
1. User's passphrase
2. Random salt (stored in localStorage)
3. PBKDF2 with SHA-256

This ensures:
- Same passphrase produces same key (for decryption)
- Different users have different salts (unique keys)
- Brute-force attacks are computationally expensive

## Dependencies

No new external dependencies required:
- `JSZip` - Already used for OLM parsing
- Web Crypto API - Built into modern browsers

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Web Crypto API | ✅ | ✅ | ✅ | ✅ |
| SubtleCrypto | ✅ | ✅ | ✅ | ✅ |
| PBKDF2 | ✅ | ✅ | ✅ | ✅ |
| AES-GCM | ✅ | ✅ | ✅ | ✅ |

## Future Enhancements

1. **EML Import**: Support for individual .eml files
2. **Cloud Backup**: Optional encrypted backup to cloud storage
3. **Incremental Backup**: Only export changed data
4. **Auto-backup**: Scheduled automatic backups

