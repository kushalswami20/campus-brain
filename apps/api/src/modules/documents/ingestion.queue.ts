/** Shared constants and job payload for the ingestion queue. */

export const INGESTION_QUEUE = 'document-ingestion';

export interface IngestionJobData {
  documentId: string;
  ownerId: string;
  requestId: string;
}
