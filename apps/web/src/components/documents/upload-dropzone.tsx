'use client';

import { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useUploadDocument } from '@/hooks/use-documents';
import { cn } from '@/lib/utils';

const ACCEPT =
  '.pdf,.docx,.doc,.pptx,.txt,.md,.png,.jpg,.jpeg';

export function UploadDropzone(): React.ReactElement {
  const upload = useUploadDocument();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    for (const file of Array.from(files)) {
      try {
        await upload.mutateAsync({ file });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed.');
      }
    }
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition-colors',
          dragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-surface-2/50',
        )}
      >
        {upload.isPending ? (
          <Spinner className="h-6 w-6" />
        ) : (
          <UploadCloud className="h-8 w-8 text-muted" />
        )}
        <p className="mt-3 font-medium">
          {upload.isPending ? 'Uploading…' : 'Drop files or click to upload'}
        </p>
        <p className="mt-1 text-sm text-muted">
          PDF, DOCX, PPTX, TXT, MD, PNG, JPG · up to 25MB
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
