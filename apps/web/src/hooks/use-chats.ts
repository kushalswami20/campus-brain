'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';
import { endpoints } from '@/lib/endpoints';
import type { ChatDetail, ChatSummary, Paginated } from '@/lib/types';

export function useChats(search?: string) {
  return useQuery({
    queryKey: ['chats', search ?? ''],
    queryFn: () =>
      apiRequest<Paginated<ChatSummary>>(
        `${endpoints.chats.root}?pageSize=100${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      ),
  });
}

export function useChat(chatId: string | null) {
  return useQuery({
    queryKey: ['chat', chatId],
    queryFn: () => apiRequest<ChatDetail>(endpoints.chats.byId(chatId!)),
    enabled: Boolean(chatId),
  });
}

export function useCreateChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title?: string) =>
      apiRequest<ChatSummary>(endpoints.chats.root, {
        method: 'POST',
        body: { title },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chats'] }),
  });
}

export function useUpdateChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      title?: string;
      isPinned?: boolean;
    }) =>
      apiRequest<ChatSummary>(endpoints.chats.byId(input.id), {
        method: 'PATCH',
        body: { title: input.title, isPinned: input.isPinned },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chats'] }),
  });
}

export function useDeleteChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(endpoints.chats.byId(id), { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chats'] }),
  });
}
