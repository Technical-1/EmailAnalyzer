# Phase 6: Attachment Handling

## Overview

Phase 6 adds comprehensive attachment handling including preview capabilities for images and PDFs, an attachment gallery view, and download functionality.

## Features Implemented

### 1. Attachment Preview

**File**: `src/components/attachments/AttachmentPreview.tsx`

Display preview for supported file types inline with the email.

#### Supported Types:
- **Images**: JPEG, PNG, GIF, WebP, SVG
- **Documents**: PDF
- **Text**: TXT, CSV, JSON, XML, HTML

#### Usage:

```typescript
import { AttachmentPreview } from './components/attachments/AttachmentPreview';

<AttachmentPreview 
  attachment={attachment} 
  onDownload={handleDownload}
/>
```

### 2. Image Viewer / Lightbox

**File**: `src/components/attachments/ImageViewer.tsx`

Full-screen image viewer with zoom and navigation.

#### Features:
- Zoom in/out with buttons or scroll wheel
- Pan by dragging
- Keyboard navigation (arrow keys for gallery)
- Close with Escape key
- Touch gestures on mobile

#### Usage:

```typescript
import { ImageViewer } from './components/attachments/ImageViewer';

<ImageViewer
  src={imageUrl}
  alt="Image description"
  onClose={handleClose}
  onNext={handleNext}
  onPrevious={handlePrevious}
/>
```

### 3. PDF Viewer

**File**: `src/components/attachments/PdfViewer.tsx`

Embedded PDF viewer for document previews.

#### Features:
- Native browser PDF rendering
- Page navigation controls
- Zoom controls
- Download button
- Fallback for unsupported browsers

#### Usage:

```typescript
import { PdfViewer } from './components/attachments/PdfViewer';

<PdfViewer
  src={pdfUrl}
  filename="document.pdf"
  onDownload={handleDownload}
/>
```

### 4. Attachment Gallery

**File**: `src/components/attachments/AttachmentGallery.tsx`

Grid view of all attachments across emails.

#### Features:
- Thumbnail grid layout
- File type icons for non-image files
- Filter by file type
- Sort by date, size, or name
- Search by filename
- Click to preview

#### Usage:

```typescript
import { AttachmentGallery } from './components/attachments/AttachmentGallery';

<AttachmentGallery
  attachments={allAttachments}
  onSelect={handleSelect}
  filter={currentFilter}
/>
```

### 5. Attachment Service

**File**: `src/services/attachmentService.ts`

Service for attachment operations.

#### Methods:

```typescript
import { attachmentService } from './services/attachmentService';

// Get attachment URL for preview
const url = attachmentService.getPreviewUrl(attachment);

// Download single attachment
await attachmentService.download(attachment);

// Download multiple attachments as ZIP
await attachmentService.downloadAsZip(attachments, 'attachments.zip');

// Get file type info
const info = attachmentService.getFileTypeInfo(attachment.contentType);
// { icon: 'image', label: 'Image', previewable: true }

// Extract all attachments from emails
const allAttachments = attachmentService.extractFromEmails(emails);
```

### 6. Attachments Page

**File**: `src/pages/AttachmentsPage.tsx`

Dedicated page for browsing all attachments.

#### Features:
- Grid/List view toggle
- Filter by type (Images, Documents, Archives, etc.)
- Sort options
- Bulk selection and download
- Search functionality

## Implementation Details

### Attachment Type Detection

```typescript
const MIME_TYPE_MAP = {
  // Images
  'image/jpeg': { icon: 'image', label: 'JPEG Image', previewable: true },
  'image/png': { icon: 'image', label: 'PNG Image', previewable: true },
  'image/gif': { icon: 'image', label: 'GIF Image', previewable: true },
  'image/webp': { icon: 'image', label: 'WebP Image', previewable: true },
  'image/svg+xml': { icon: 'image', label: 'SVG Image', previewable: true },
  
  // Documents
  'application/pdf': { icon: 'file-text', label: 'PDF Document', previewable: true },
  'application/msword': { icon: 'file-text', label: 'Word Document', previewable: false },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 
    { icon: 'file-text', label: 'Word Document', previewable: false },
  
  // Spreadsheets
  'application/vnd.ms-excel': { icon: 'table', label: 'Excel Spreadsheet', previewable: false },
  'text/csv': { icon: 'table', label: 'CSV File', previewable: true },
  
  // Archives
  'application/zip': { icon: 'archive', label: 'ZIP Archive', previewable: false },
  'application/x-rar-compressed': { icon: 'archive', label: 'RAR Archive', previewable: false },
  
  // Text
  'text/plain': { icon: 'file-text', label: 'Text File', previewable: true },
  'text/html': { icon: 'file-code', label: 'HTML File', previewable: true },
  'application/json': { icon: 'file-code', label: 'JSON File', previewable: true },
};
```

### Thumbnail Generation

For images, thumbnails are generated client-side using canvas:

```typescript
async function generateThumbnail(
  imageBlob: Blob, 
  maxSize: number = 150
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Calculate dimensions
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);
      
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(imageBlob);
  });
}
```

### ZIP Download

Multiple attachments can be downloaded as a ZIP file:

```typescript
async function downloadAsZip(
  attachments: Attachment[], 
  filename: string
): Promise<void> {
  const zip = new JSZip();
  
  for (const attachment of attachments) {
    if (attachment.content) {
      zip.file(attachment.filename, attachment.content);
    }
  }
  
  const blob = await zip.generateAsync({ type: 'blob' });
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
```

## Testing

### Test Files

- `src/__tests__/phase-6/attachmentPreview.test.ts`
- `src/__tests__/phase-6/attachmentService.test.ts`
- `src/__tests__/phase-6/imageViewer.test.ts`

### Running Tests

```bash
npm run test -- --grep "phase-6"
```

### Test Coverage

| Feature | Tests |
|---------|-------|
| Type detection | 6 tests |
| Preview rendering | 4 tests |
| Download | 3 tests |
| ZIP generation | 2 tests |
| Gallery filtering | 4 tests |

## UI Components

### AttachmentCard

```typescript
interface AttachmentCardProps {
  attachment: Attachment;
  selected?: boolean;
  onSelect?: () => void;
  onPreview?: () => void;
  onDownload?: () => void;
}
```

### AttachmentList

```typescript
interface AttachmentListProps {
  attachments: Attachment[];
  view: 'grid' | 'list';
  selectedIds?: number[];
  onSelect?: (id: number) => void;
  onPreview?: (attachment: Attachment) => void;
}
```

## Accessibility

- All images have alt text
- Keyboard navigation in gallery
- Focus management in lightbox
- Screen reader announcements
- Color-independent type indicators (icons)

## Performance Considerations

- Thumbnails generated lazily
- Large images loaded on demand
- Memory-efficient preview (object URLs revoked)
- Virtual scrolling for large galleries
- Progressive image loading

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Image preview | ✅ | ✅ | ✅ | ✅ |
| PDF viewer | ✅ | ✅ | ✅ | ✅ |
| ZIP download | ✅ | ✅ | ✅ | ✅ |
| Touch gestures | ✅ | ✅ | ✅ | ✅ |

## File Icons

Uses Lucide React icons for file type representation:

| Type | Icon |
|------|------|
| Image | `Image` |
| PDF | `FileText` |
| Word | `FileText` |
| Excel | `Table` |
| Archive | `Archive` |
| Code | `FileCode` |
| Video | `Video` |
| Audio | `Music` |
| Other | `File` |

## Future Enhancements

1. **Video Preview**: Inline video player for common formats
2. **Audio Preview**: Audio player for MP3, WAV, etc.
3. **Office Preview**: Integration with online viewers
4. **OCR**: Text extraction from images
5. **Attachment Search**: Full-text search within attachments

