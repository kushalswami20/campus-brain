'use client';

import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';
import { endpoints } from '@/lib/endpoints';
import { useAuthStore } from '@/stores/auth-store';
import type { AuthResult } from '@/lib/types';

interface LoginInput {
  email: string;
  password: string;
}

interface RegisterInput extends LoginInput {
  fullName: string;
  branch?: string;
  semester?: number;
}

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: (input: LoginInput) =>
      apiRequest<AuthResult>(endpoints.auth.login, {
        method: 'POST',
        body: input,
        auth: false,
      }),
    onSuccess: (result) => setSession(result.user, result.tokens),
  });
}

export function useRegister() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      apiRequest<AuthResult>(endpoints.auth.register, {
        method: 'POST',
        body: input,
        auth: false,
      }),
    onSuccess: (result) => setSession(result.user, result.tokens),
  });
}

export function useLogout() {
  const clear = useAuthStore((s) => s.clear);
  return async () => {
    await apiRequest(endpoints.auth.logout, { method: 'POST' }).catch(
      () => undefined,
    );
    clear();
  };
}
