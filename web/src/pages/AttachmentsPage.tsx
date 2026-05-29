import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Paperclip,
  Image,
  FileText,
  Archive,
  Download,
  Search,
  Grid,
  List,
  Eye
} from 'lucide-react';
import { useAppStore } from '../store';
import { EmptyState } from '../components/EmptyState';
import { AttachmentPreview } from '../components/AttachmentPreview';
import { attachmentService } from '../services/attachmentService';
import { getEmailBody } from '../db/database';
import type { Email, Attachment } from '../types';

interface AttachmentWithEmail extends Attachment {
  email: Email;
}

type ViewMode = 'grid' | 'list';
type FilterType = 'all' | 'images' | 'documents' | 'archives' | 'other';

/**
 * Cache of attachment data keyed by email id.
 * Stores a promise while fetching (to deduplicate concurrent requests for the
 * same email) and a resolved Record<attachmentId, base64> once complete.
 */
type BodyCache = Map<number, Record<string, string> | null>;

/** Fetch attachment data for an email, de-duplicating concurrent requests via the
 *  in-flight map. Resolves to a Record<attachmentId, base64> or null if none. */
async function fetchAttachmentData(
  emailId: number,
  inFlight: Map<number, Promise<Record<string, string> | null>>,
  cache: BodyCache,
  setCache: (fn: (prev: BodyCache) => BodyCache) => void
): Promise<Record<string, string> | null> {
  if (cache.has(emailId)) return cache.get(emailId) ?? null;
  if (inFlight.has(emailId)) return inFlight.get(emailId)!;

  const p = getEmailBody(emailId).then(bodyRow => {
    const data = bodyRow?.attachmentData ?? null;
    setCache(prev => {
      const next = new Map(prev);
      next.set(emailId, data);
      return next;
    });
    inFlight.delete(emailId);
    return data;
  }).catch(() => {
    inFlight.delete(emailId);
    return null;
  });

  inFlight.set(emailId, p);
  return p;
}

/** Small hook: lazy-load attachment data for a single email, cached by id. */
function useAttachmentData(
  emailId: number | undefined,
  bodyCache: BodyCache,
  fetchData: (id: number) => Promise<Record<string, string> | null>
): Record<string, string> | null {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (emailId === undefined) return;
    if (bodyCache.has(emailId)) return;
    fetchData(emailId).then(() => setTick(t => t + 1));
  }, [emailId, bodyCache, fetchData]);

  if (emailId === undefined) return null;
  return bodyCache.get(emailId) ?? null;
}

export function AttachmentsPage() {
  const { emails } = useAppStore();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAttachment, setSelectedAttachment] = useState<AttachmentWithEmail | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Cache: email id -> Record<attachmentId, base64> | null (null = no attachment data)
  const [bodyCache, setBodyCache] = useState<BodyCache>(new Map());
  // In-flight promises to deduplicate concurrent fetches for the same email
  const inFlight = useRef<Map<number, Promise<Record<string, string> | null>>>(new Map());

  const fetchData = useCallback(
    (emailId: number) =>
      fetchAttachmentData(emailId, inFlight.current, bodyCache, setBodyCache),
    [bodyCache]
  );

  // Extract all attachments from emails
  const allAttachments = useMemo(() => {
    const attachments: AttachmentWithEmail[] = [];
    for (const email of emails) {
      for (const attachment of email.attachments) {
        attachments.push({ ...attachment, email });
      }
    }
    return attachments.sort((a, b) => b.email.date.getTime() - a.email.date.getTime());
  }, [emails]);

  // Filter attachments
  const filteredAttachments = useMemo(() => {
    return allAttachments.filter(att => {
      // Type filter
      if (filter !== 'all') {
        const type = attachmentService.getAttachmentType(att.mimeType);
        if (filter === 'images' && type !== 'image') return false;
        if (filter === 'documents' && type !== 'document' && type !== 'pdf') return false;
        if (filter === 'archives' && type !== 'other') return false;
        if (filter === 'other' && !['image', 'document', 'pdf'].includes(type)) return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return att.filename.toLowerCase().includes(query) ||
               att.email.subject.toLowerCase().includes(query) ||
               att.email.sender.toLowerCase().includes(query);
      }

      return true;
    });
  }, [allAttachments, filter, searchQuery]);

  // Calculate stats
  const stats = useMemo(() => {
    const images = allAttachments.filter(a => attachmentService.getAttachmentType(a.mimeType) === 'image').length;
    const documents = allAttachments.filter(a => {
      const type = attachmentService.getAttachmentType(a.mimeType);
      return type === 'document' || type === 'pdf';
    }).length;
    const totalSize = allAttachments.reduce((sum, a) => sum + a.size, 0);
    return {
      total: allAttachments.length,
      images,
      documents,
      totalSize,
    };
  }, [allAttachments]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkDownload = async () => {
    const selected = filteredAttachments.filter(a => selectedIds.has(a.id));
    if (selected.length === 0) return;

    // Fetch attachment data for all selected emails (deduplicates per email id)
    const dataMap = new Map<number, Record<string, string> | null>();
    await Promise.all(
      [...new Set(selected.map(a => a.email.id!))].map(async emailId => {
        const data = await fetchData(emailId);
        dataMap.set(emailId, data);
      })
    );

    await attachmentService.downloadMultiple(
      selected.map(a => ({
        filename: a.filename,
        mimeType: a.mimeType,
        data: dataMap.get(a.email.id!)?.[ a.id],
      }))
    );
  };

  if (emails.length === 0) {
    return (
      <EmptyState
        icon={Paperclip}
        title="No emails imported"
        description="Import your emails to browse attachments"
      />
    );
  }

  if (allAttachments.length === 0) {
    return (
      <EmptyState
        icon={Paperclip}
        title="No attachments found"
        description="Your imported emails don't contain any attachments"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Attachments
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Browse and download all email attachments
          </p>
        </div>
        {selectedIds.size > 0 && (
          <button
            onClick={handleBulkDownload}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download {selectedIds.size} files
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
            <Paperclip className="w-4 h-4" />
            Total Files
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {stats.total}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-blue-500 text-sm">
            <Image className="w-4 h-4" />
            Images
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {stats.images}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-orange-500 text-sm">
            <FileText className="w-4 h-4" />
            Documents
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {stats.documents}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-purple-500 text-sm">
            <Archive className="w-4 h-4" />
            Total Size
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {attachmentService.formatSize(stats.totalSize)}
          </div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search attachments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex gap-2">
          {(['all', 'images', 'documents', 'archives', 'other'] as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 text-sm rounded-lg transition-colors capitalize ${
                filter === f
                  ? 'bg-blue-500 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex gap-1 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Attachment Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredAttachments.map((att) => (
            <GridAttachmentCard
              key={att.id}
              att={att}
              isSelected={selectedIds.has(att.id)}
              bodyCache={bodyCache}
              fetchData={fetchData}
              onSelect={() => toggleSelection(att.id)}
              onClick={() => setSelectedAttachment(att)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredAttachments.map((att) => (
            <ListAttachmentRow
              key={att.id}
              att={att}
              isSelected={selectedIds.has(att.id)}
              bodyCache={bodyCache}
              fetchData={fetchData}
              onSelect={() => toggleSelection(att.id)}
              onClick={() => setSelectedAttachment(att)}
            />
          ))}
        </div>
      )}

      {filteredAttachments.length === 0 && (
        <EmptyState
          icon={Paperclip}
          title="No attachments found"
          description="No attachments match your current filters"
        />
      )}

      {/* Preview Modal */}
      {selectedAttachment && (
        <PreviewModal
          att={selectedAttachment}
          bodyCache={bodyCache}
          fetchData={fetchData}
          onClose={() => setSelectedAttachment(null)}
          onNavigate={() => navigate(`/emails/${selectedAttachment.email.id}`)}
        />
      )}
    </div>
  );
}

// ---- Sub-components ----

interface GridCardProps {
  att: AttachmentWithEmail;
  isSelected: boolean;
  bodyCache: BodyCache;
  fetchData: (id: number) => Promise<Record<string, string> | null>;
  onSelect: () => void;
  onClick: () => void;
}

function GridAttachmentCard({ att, isSelected, bodyCache, fetchData, onSelect, onClick }: GridCardProps) {
  const isImage = attachmentService.getAttachmentType(att.mimeType) === 'image';
  // Only fetch attachment data for image cards (thumbnails need it; other types don't)
  const attData = useAttachmentData(
    isImage ? att.email.id : undefined,
    bodyCache,
    fetchData
  );
  const imageData = isImage ? (attData?.[att.id] ?? null) : null;

  return (
    <div
      className={`relative group bg-white dark:bg-slate-800 rounded-xl border overflow-hidden cursor-pointer transition-all ${
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-500/20'
          : 'border-slate-200 dark:border-slate-700 hover:border-blue-300'
      }`}
      onClick={onClick}
    >
      <div className="aspect-square bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
        {isImage && imageData ? (
          <img
            src={`data:${att.mimeType};base64,${imageData}`}
            alt={att.filename}
            className="w-full h-full object-cover"
          />
        ) : (
          <AttachmentIcon type={attachmentService.getAttachmentType(att.mimeType)} />
        )}
      </div>
      <div className="p-2">
        <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
          {att.filename}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {attachmentService.formatSize(att.size)}
        </div>
      </div>

      {/* Selection checkbox */}
      <div
        className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}}
          className="w-5 h-5 rounded border-slate-300"
        />
      </div>
    </div>
  );
}

interface ListRowProps {
  att: AttachmentWithEmail;
  isSelected: boolean;
  bodyCache: BodyCache;
  fetchData: (id: number) => Promise<Record<string, string> | null>;
  onSelect: () => void;
  onClick: () => void;
}

function ListAttachmentRow({ att, isSelected, bodyCache, fetchData, onSelect, onClick }: ListRowProps) {
  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const data = await fetchData(att.email.id!);
    const attData = data?.[att.id];
    if (attData) {
      attachmentService.download(att.filename, att.mimeType, attData);
    }
  };

  // Pre-warm cache if data already available
  const cachedData = bodyCache.get(att.email.id!)?.[ att.id];

  return (
    <div
      className={`flex items-center gap-4 p-3 bg-white dark:bg-slate-800 rounded-lg border cursor-pointer transition-all ${
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-500/20'
          : 'border-slate-200 dark:border-slate-700 hover:border-blue-300'
      }`}
      onClick={onClick}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onSelect()}
        onClick={(e) => e.stopPropagation()}
        className="w-5 h-5 rounded border-slate-300"
      />
      <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded flex items-center justify-center">
        <AttachmentIcon type={attachmentService.getAttachmentType(att.mimeType)} size="sm" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-slate-900 dark:text-white truncate">
          {att.filename}
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400 truncate">
          From: {att.email.sender} • {format(att.email.date, 'MMM d, yyyy')}
        </div>
      </div>
      <div className="text-sm text-slate-500 dark:text-slate-400">
        {attachmentService.formatSize(att.size)}
      </div>
      <button
        onClick={handleDownload}
        title={cachedData ? `Download ${att.filename}` : 'Download (will load data first)'}
        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
      >
        <Download className="w-4 h-4 text-slate-500" />
      </button>
    </div>
  );
}

interface PreviewModalProps {
  att: AttachmentWithEmail;
  bodyCache: BodyCache;
  fetchData: (id: number) => Promise<Record<string, string> | null>;
  onClose: () => void;
  onNavigate: () => void;
}

function PreviewModal({ att, bodyCache, fetchData, onClose, onNavigate }: PreviewModalProps) {
  // Eagerly fetch attachment data when the modal opens
  const attData = useAttachmentData(att.email.id, bodyCache, fetchData);
  const resolvedData = attData?.[att.id];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-xl max-w-4xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">
              {att.filename}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {attachmentService.formatSize(att.size)} • From: {att.email.sender}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onNavigate}
              className="flex items-center gap-1 px-3 py-2 text-sm bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              <Eye className="w-4 h-4" />
              View Email
            </button>
            <button
              onClick={() => resolvedData && attachmentService.download(att.filename, att.mimeType, resolvedData)}
              disabled={!resolvedData}
              className="flex items-center gap-1 px-3 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
              title={resolvedData ? 'Download' : 'Loading attachment data…'}
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>
        </div>
        <div className="p-4 max-h-[70vh] overflow-auto">
          <AttachmentPreview
            attachment={att}
            resolvedData={resolvedData}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
}

// Helper component for attachment icons
function AttachmentIcon({ type, size = 'lg' }: { type: string; size?: 'sm' | 'lg' }) {
  const className = size === 'sm' ? 'w-5 h-5' : 'w-10 h-10';
  const color =
    type === 'image' ? 'text-blue-500' :
    type === 'document' ? 'text-orange-500' :
    type === 'archive' ? 'text-purple-500' :
    'text-slate-400';

  const Icon =
    type === 'image' ? Image :
    type === 'document' ? FileText :
    type === 'archive' ? Archive :
    Paperclip;

  return <Icon className={`${className} ${color}`} />;
}
