'use client';

import { UploadDropzone } from '@/components/documents/upload-dropzone';
import { DocumentList } from '@/components/documents/document-list';

export default function DocumentsPage(): React.ReactElement {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">Documents</h1>
          <p className="mt-1 text-muted">
            Upload your notes and papers. They become searchable once processed.
          </p>
        </header>

        <UploadDropzone />

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium text-muted">Your library</h2>
          <DocumentList />
        </section>
      </div>
    </div>
  );
}
