import { useCallback, useState } from 'react';
import { Upload, FileArchive, AlertCircle } from 'lucide-react';

interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
}

export function FileDropzone({ onFileSelect, isProcessing }: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const validateFile = (file: File): boolean => {
    setError(null);

    const fileName = file.name.toLowerCase();
    const isValidFormat = 
      fileName.endsWith('.olm') || 
      fileName.endsWith('.mbox') || 
      fileName.endsWith('.mbx') ||
      fileName.endsWith('.zip');

    if (!isValidFormat) {
      setError('Please select a valid email archive file (.olm, .mbox, .mbx, or .zip)');
      return false;
    }

    return true;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && validateFile(file)) {
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validateFile(file)) {
      onFileSelect(file);
    }
    // Reset the input so the same file can be selected again
    e.target.value = '';
  }, [onFileSelect]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer
          ${isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500'
          }
          ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input
          type="file"
          accept=".olm,.mbox,.mbx,.zip"
          onChange={handleFileInput}
          disabled={isProcessing}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        <div className="flex flex-col items-center gap-4">
          {isDragging ? (
            <FileArchive className="w-16 h-16 text-blue-500" />
          ) : (
            <Upload className="w-16 h-16 text-slate-400" />
          )}

          <div>
            <p className="text-lg font-medium text-slate-700 dark:text-slate-200">
              {isDragging ? 'Drop your email archive here' : 'Drag & drop your email archive'}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              or click to browse
            </p>
          </div>

          <div className="text-xs text-slate-400 dark:text-slate-500">
            Supports .olm (Outlook), .mbox/.mbx (Gmail/Thunderbird), or .zip (Gmail Takeout)
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3 text-red-700 dark:text-red-300">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
