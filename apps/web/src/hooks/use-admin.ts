'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';
import type { Paginated } from '@/lib/types';

export interface AdminOverview {
  totalUsers: number;
  activeToday: number;
  documents: number;
  chats: number;
  messages: number;
  totalTokens: number;
  estCostUsd: number;
  avgLatencyMs: number;
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: 'STUDENT' | 'ADMIN' | 'SUPER_ADMIN';
  isActive: boolean;
  branch: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  documentCount: number;
  chatCount: number;
}

export function useAdminOverview() {
  return useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () => apiRequest<AdminOverview>('/api/admin/analytics/overview'),
  });
}

export function useMessagesPerDay(days = 14) {
  return useQuery({
    queryKey: ['admin', 'messages', days],
    queryFn: () =>
      apiRequest<{ date: string; count: number }[]>(
        `/api/admin/analytics/messages?days=${days}`,
      ),
  });
}

export function useDocumentsByType() {
  return useQuery({
    queryKey: ['admin', 'docsByType'],
    queryFn: () =>
      apiRequest<{ type: string; count: number }[]>(
        '/api/admin/analytics/documents-by-type',
      ),
  });
}

export function useAdminUsers(search: string) {
  return useQuery({
    queryKey: ['admin', 'users', search],
    queryFn: () =>
      apiRequest<Paginated<AdminUser>>(
        `/api/admin/users?pageSize=50${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      ),
  });
}

export function useSetUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) =>
      apiRequest(`/api/admin/users/${input.id}/status`, {
        method: 'PATCH',
        body: { isActive: input.isActive },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}
