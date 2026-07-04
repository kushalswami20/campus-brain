'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { apiRequest, API_URL } from '@/lib/api-client';
import { authStore } from '@/stores/auth-store';
import type { DocumentItem, Paginated } from '@/lib/types';

export function useDocuments() {
  return useQuery({
    queryKey: ['documents'],
    queryFn: () =>
      apiRequest<Paginated<DocumentItem>>('/api/documents?pageSize=100'),
    // Poll while anything is still processing so status updates live.
    refetchInterval: (query) => {
      const items = query.state.data?.data ?? [];
      const pending = items.some(
        (doc) => doc.status === 'QUEUED' || doc.status === 'PROCESSING',
      );
      return pending ? 2000 : false;
    },
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { file: File; type?: string }) => {
      // Multipart upload can't go through the JSON client; call fetch directly.
      const form = new FormData();
      form.append('file', input.file);
      if (input.type) form.append('type', input.type);
      const token = authStore.get().tokens?.accessToken;
      const res = await fetch(`${API_URL}/api/documents`, {
        method: 'POST',
        headers: token ? { authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { error?: { message?: string } })?.error?.message ??
            'Upload failed.',
        );
      }
      return (await res.json()) as DocumentItem;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/api/documents/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}
