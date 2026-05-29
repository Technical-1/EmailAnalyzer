import { useState, useEffect, useRef, useCallback } from 'react';
import { File, FileText, Image, Music, Video, Download, Eye, Grid, List } from 'lucide-react';
import type { Attachment, Email } from '../types';
import { attachmentService } from '../services/attachmentService';
import { getEmailBody } from '../db/database';
import { AttachmentPreview } from './AttachmentPreview';

interface AttachmentGalleryProps {
  emails: Email[];
}

interface AttachmentWithEmail {
  attachment: Attachment;
  email: Email;
}

type ViewMode = 'grid' | 'list';

/** Cache: email id -> Record<attachmentId, base64> | null */
type BodyCache = Map<number, Record<string, string> | null>;

export function AttachmentGallery({ emails }: AttachmentGalleryProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentWithEmail | null>(null);
  const [filter, setFilter] = useState<string>('all');

  // Lazy attachment data cache: email id -> Record<attachmentId, base64> | null
  const [bodyCache, setBodyCache] = useState<BodyCache>(new Map());
  const inFlight = useRef<Map<number, Promise<Record<string, string> | null>>>(new Map());

  const fetchData = useCallback(async (emailId: number): Promise<Record<string, string> | null> => {
    if (bodyCache.has(emailId)) return bodyCache.get(emailId) ?? null;
    if (inFlight.current.has(emailId)) return inFlight.current.get(emailId)!;

    const p = getEmailBody(emailId).then(bodyRow => {
      const data = bodyRow?.attachmentData ?? null;
      setBodyCache(prev => {
        const next = new Map(prev);
        next.set(emailId, data);
        return next;
      });
      inFlight.current.delete(emailId);
      return data;
    }).catch(() => {
      inFlight.current.delete(emailId);
      return null;
    });

    inFlight.current.set(emailId, p);
    return p;
  }, [bodyCache]);

  // Collect all attachments with their parent emails
  const allAttachments: AttachmentWithEmail[] = [];
  emails.forEach((email) => {
    email.attachments.forEach((attachment) => {
      allAttachments.push({ attachment, email });
    });
  });

  // Filter attachments
  const filteredAttachments = allAttachments.filter(({ attachment }) => {
    if (filter === 'all') return true;
    const type = attachmentService.getAttachmentType(attachment.mimeType);
    return type === filter;
  });

  // Sort by date (newest first)
  filteredAttachments.sort(
    (a, b) => new Date(b.email.date).getTime() - new Date(a.email.date).getTime()
  );

  // Stable, content-based key of the image emails currently visible. Using a
  // value-comparable string (not just .length) re-runs the prefetch whenever the
  // image set itself changes, even if a filter swap leaves the count unchanged.
  const imageEmailKey = filteredAttachments
    .filter(({ attachment }) => attachmentService.getAttachmentType(attachment.mimeType) === 'image')
    .map(({ email }) => email.id)
    .join(',');

  // Pre-fetch attachment data for visible image thumbnails in grid view.
  // Only image attachments need their data for thumbnails; others just show an icon.
  useEffect(() => {
    if (viewMode !== 'grid') return;
    const imageEmailIds = new Set<number>();
    for (const { attachment, email } of filteredAttachments) {
      if (
        attachmentService.getAttachmentType(attachment.mimeType) === 'image' &&
        email.id !== undefined &&
        !bodyCache.has(email.id)
      ) {
        imageEmailIds.add(email.id);
      }
    }
    for (const emailId of imageEmailIds) {
      fetchData(emailId);
    }
    // filteredAttachments/bodyCache/fetchData intentionally excluded to avoid
    // refetch loops; imageEmailKey precisely captures the relevant changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, imageEmailKey]);

  const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'image', label: 'Images' },
    { value: 'pdf', label: 'PDFs' },
    { value: 'document', label: 'Documents' },
    { value: 'audio', label: 'Audio' },
    { value: 'video', label: 'Video' },
    { value: 'other', label: 'Other' },
  ];

  const getIcon = (mimeType: string) => {
    const type = attachmentService.getAttachmentType(mimeType);
    switch (type) {
      case 'image': return Image;
      case 'pdf': return FileText;
      case 'document': return FileText;
      case 'audio': return Music;
      case 'video': return Video;
      default: return File;
    }
  };

  if (allAttachments.length === 0) {
    return (
      <div className="text-center py-12">
        <File className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
          No Attachments Found
        </h3>
        <p className="text-slate-500 dark:text-slate-400">
          Emails with attachments will appear here.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                filter === option.value
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded transition-colors ${
              viewMode === 'grid'
                ? 'bg-slate-200 dark:bg-slate-700'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Grid view"
          >
            <Grid className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded transition-colors ${
              viewMode === 'list'
                ? 'bg-slate-200 dark:bg-slate-700'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="List view"
          >
            <List className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
        </div>
      </div>

      {/* Count */}
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        {filteredAttachments.length} attachment(s)
      </p>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredAttachments.map(({ attachment, email }) => {
            const Icon = getIcon(attachment.mimeType);
            const isImage = attachmentService.getAttachmentType(attachment.mimeType) === 'image';
            const emailAttData = email.id !== undefined ? bodyCache.get(email.id) : undefined;
            const imageData = isImage && emailAttData ? emailAttData[attachment.id] : undefined;
            const imageUrl = imageData ? attachmentService.createDataUrl(imageData, attachment.mimeType) : null;

            return (
              <div
                key={`${email.id}-${attachment.id}`}
                className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden group"
              >
                {/* Thumbnail */}
                <div className="aspect-square bg-slate-100 dark:bg-slate-700 flex items-center justify-center relative">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={attachment.filename}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Icon className="w-12 h-12 text-slate-400" />
                  )}

                  {/* Hover actions */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    {attachmentService.canPreview(attachment) && (
                      <button
                        onClick={() => setPreviewAttachment({ attachment, email })}
                        className="p-2 bg-white rounded-full hover:bg-slate-100 transition-colors"
                        title="Preview"
                      >
                        <Eye className="w-4 h-4 text-slate-700" />
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        const data = await fetchData(email.id!);
                        const attData = data?.[attachment.id];
                        if (attData) {
                          attachmentService.download(attachment.filename, attachment.mimeType, attData);
                        }
                      }}
                      className="p-2 bg-white rounded-full hover:bg-slate-100 transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4 text-slate-700" />
                    </button>
                  </div>
                </div>

                {/* Info */}
                <div className="p-2">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {attachment.filename}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {attachmentService.formatSize(attachment.size)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-2">
          {filteredAttachments.map(({ attachment, email }) => {
            const Icon = getIcon(attachment.mimeType);

            return (
              <div
                key={`${email.id}-${attachment.id}`}
                className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-slate-500" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 dark:text-white truncate">
                    {attachment.filename}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {attachmentService.formatSize(attachment.size)} • From: {email.sender}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  {attachmentService.canPreview(attachment) && (
                    <button
                      onClick={() => setPreviewAttachment({ attachment, email })}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                      title="Preview"
                    >
                      <Eye className="w-4 h-4 text-slate-500" />
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      const data = await fetchData(email.id!);
                      const attData = data?.[attachment.id];
                      if (attData) {
                        attachmentService.download(attachment.filename, attachment.mimeType, attData);
                      }
                    }}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                    title="Download"
                  >
                    <Download className="w-4 h-4 text-slate-500" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview Modal */}
      {previewAttachment && (
        <GalleryPreviewModal
          att={previewAttachment}
          bodyCache={bodyCache}
          fetchData={fetchData}
          onClose={() => setPreviewAttachment(null)}
        />
      )}
    </div>
  );
}

interface GalleryPreviewModalProps {
  att: AttachmentWithEmail;
  bodyCache: BodyCache;
  fetchData: (id: number) => Promise<Record<string, string> | null>;
  onClose: () => void;
}

function GalleryPreviewModal({ att, bodyCache, fetchData, onClose }: GalleryPreviewModalProps) {

  useEffect(() => {
    if (att.email.id === undefined) return;
    if (bodyCache.has(att.email.id)) return;
    // fetchData resolves via setBodyCache in the parent, which re-renders this
    // modal with the populated cache — no local force-update needed.
    void fetchData(att.email.id);
  }, [att.email.id, bodyCache, fetchData]);

  const attData = att.email.id !== undefined ? bodyCache.get(att.email.id) : undefined;
  const resolvedData = attData ? attData[att.attachment.id] : undefined;

  return (
    <AttachmentPreview
      attachment={att.attachment}
      resolvedData={resolvedData}
      onClose={onClose}
    />
  );
}
