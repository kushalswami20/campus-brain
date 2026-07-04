import { API_URL } from './api-client';
import { authStore } from '@/stores/auth-store';
import type { Citation } from './types';

export interface StreamHandlers {
  onToken: (text: string) => void;
  onCitations?: (citations: Citation[]) => void;
  onUsage?: (usage: Record<string, unknown>) => void;
  onDone?: (info: { grounded: boolean; trace: string[] }) => void;
  onError?: (message: string) => void;
}

/**
 * POST a chat message and consume the Server-Sent Events stream, dispatching
 * typed callbacks. Returns when the stream ends; abort via the signal.
 */
export async function streamChatMessage(
  chatId: string,
  content: string,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const token = authStore.get().tokens?.accessToken;
  const response = await fetch(`${API_URL}/api/chats/${chatId}/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ content }),
    signal,
  });

  if (!response.ok || !response.body) {
    handlers.onError?.(`Stream failed (${response.status}).`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep = buffer.indexOf('\n\n');
    while (sep !== -1) {
      dispatchFrame(buffer.slice(0, sep), handlers);
      buffer = buffer.slice(sep + 2);
      sep = buffer.indexOf('\n\n');
    }
  }
}

function dispatchFrame(frame: string, handlers: StreamHandlers): void {
  let event = 'message';
  let data = '';
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  if (!data) return;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(data) as Record<string, unknown>;
  } catch {
    return;
  }

  switch (event) {
    case 'token':
      handlers.onToken(String(parsed.text ?? ''));
      break;
    case 'citations':
      handlers.onCitations?.((parsed.citations as Citation[]) ?? []);
      break;
    case 'usage':
      handlers.onUsage?.(parsed);
      break;
    case 'done':
      handlers.onDone?.({
        grounded: Boolean(parsed.grounded),
        trace: (parsed.trace as string[]) ?? [],
      });
      break;
    case 'error':
      handlers.onError?.('The assistant encountered an error.');
      break;
  }
}
