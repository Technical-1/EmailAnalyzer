import { useState } from 'react';
import { X, Download, ZoomIn, ZoomOut, RotateCw, File, FileText, Music, Video, Image } from 'lucide-react';
import type { Attachment } from '../types';
import { attachmentService } from '../services/attachmentService';

interface AttachmentPreviewProps {
  attachment: Attachment;
  /** Resolved base64 data for the attachment (fetched on demand by the caller). */
  resolvedData?: string;
  onClose: () => void;
}

export function AttachmentPreview({ attachment, resolvedData, onClose }: AttachmentPreviewProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const type = attachmentService.getAttachmentType(attachment.mimeType);
  // Use resolvedData (lazy-fetched) preferring over any attachment.data that might be present
  const data = resolvedData ?? attachment.data;
  const canPreviewImage = type === 'image' && !!data;
  const canPreviewPdf = type === 'pdf' && !!data;

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  const handleDownload = () => {
    if (!data) return;
    attachmentService.download(attachment.filename, attachment.mimeType, data);
  };

  const renderPreview = () => {
    if (canPreviewImage) {
      const imageUrl = attachmentService.createDataUrl(data!, attachment.mimeType);
      if (!imageUrl) return <NoPreview attachment={attachment} data={data} />;

      return (
        <div className="flex items-center justify-center h-full overflow-auto p-4">
          <img
            src={imageUrl}
            alt={attachment.filename}
            className="max-w-full max-h-full object-contain transition-transform"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
            }}
          />
        </div>
      );
    }

    if (canPreviewPdf) {
      const pdfUrl = attachmentService.createDataUrl(data!, attachment.mimeType);
      return (
        <iframe
          src={pdfUrl}
          className="w-full h-full"
          title={attachment.filename}
        />
      );
    }

    return <NoPreview attachment={attachment} data={data} />;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-slate-900 text-white">
        <div className="flex items-center gap-3">
          <span className="font-medium">{attachment.filename}</span>
          <span className="text-slate-400 text-sm">
            ({attachmentService.formatSize(attachment.size)})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {canPreviewImage && (
            <>
              <button
                onClick={handleZoomOut}
                className="p-2 hover:bg-slate-700 rounded transition-colors"
                title="Zoom out"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <span className="text-sm text-slate-400 w-16 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-2 hover:bg-slate-700 rounded transition-colors"
                title="Zoom in"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              <button
                onClick={handleRotate}
                className="p-2 hover:bg-slate-700 rounded transition-colors"
                title="Rotate"
              >
                <RotateCw className="w-5 h-5" />
              </button>
              <div className="w-px h-6 bg-slate-700 mx-2" />
            </>
          )}

          <button
            onClick={handleDownload}
            disabled={!data}
            className="p-2 hover:bg-slate-700 rounded transition-colors flex items-center gap-2 disabled:opacity-50"
            title={data ? 'Download' : 'Loading attachment data…'}
          >
            <Download className="w-5 h-5" />
            <span className="text-sm">Download</span>
          </button>

          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded transition-colors ml-2"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="flex-1 overflow-hidden">{renderPreview()}</div>
    </div>
  );
}

function NoPreview({ attachment, data }: { attachment: Attachment; data?: string }) {
  const type = attachmentService.getAttachmentType(attachment.mimeType);

  const Icon = type === 'image' ? Image
    : type === 'pdf' ? FileText
    : type === 'document' ? FileText
    : type === 'audio' ? Music
    : type === 'video' ? Video
    : File;

  return (
    <div className="flex flex-col items-center justify-center h-full text-white">
      <Icon className="w-24 h-24 text-slate-500 mb-4" />
      <p className="text-lg font-medium mb-2">{attachment.filename}</p>
      <p className="text-slate-400 mb-4">
        {attachmentService.formatSize(attachment.size)} • {attachment.mimeType}
      </p>
      <p className="text-slate-500">Preview not available for this file type</p>
      {data && (
        <button
          onClick={() => attachmentService.download(attachment.filename, attachment.mimeType, data)}
          className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Download className="w-4 h-4" />
          Download File
        </button>
      )}
    </div>
  );
}
