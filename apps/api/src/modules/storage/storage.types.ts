/** Result of persisting a file to the storage backend. */
export interface StoredFile {
  /** Publicly resolvable URL (or a local path in the local driver). */
  url: string;
  /** Opaque key used to fetch/delete the object later. */
  key: string;
}

export interface SaveFileInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  /** Namespacing prefix, e.g. the owner user id. */
  prefix: string;
}

/**
 * Storage abstraction. Feature code depends on this interface, never on a
 * concrete backend — mirrors the AI service's provider pattern so `local` (dev)
 * and `cloudinary` (prod) are interchangeable via config.
 */
export interface StorageProvider {
  save(input: SaveFileInput): Promise<StoredFile>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

/** DI token for the active storage provider. */
export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
