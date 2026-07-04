'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useChat } from '@/hooks/use-chats';
import { streamChatMessage } from '@/lib/stream';
import { Composer } from './composer';
import { MessageBubble, type DisplayMessage } from './message-bubble';
import { Skeleton } from '@/components/ui/skeleton';
import type { Citation } from '@/lib/types';

const SUGGESTIONS = [
  'Summarise the key topics in my notes.',
  'Generate 5 practice questions.',
  'Explain the most important concept simply.',
];

export function ChatView({ chatId }: { chatId: string }): React.ReactElement {
  const { data, isLoading } = useChat(chatId);
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Hydrate from the server whenever we switch chats (and we're not streaming).
  useEffect(() => {
    if (data && !streaming) {
      setMessages(
        data.messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          citations: message.metadata?.citations ?? undefined,
          grounded: message.metadata?.grounded,
        })),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id, data?.messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (content: string) => {
    const assistantId = `assistant-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'USER', content },
      { id: assistantId, role: 'ASSISTANT', content: '', streaming: true },
    ]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const patch = (updater: (m: DisplayMessage) => DisplayMessage) =>
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? updater(m) : m)),
      );

    try {
      await streamChatMessage(
        chatId,
        content,
        {
          onToken: (text) =>
            patch((m) => ({ ...m, content: m.content + text })),
          onCitations: (citations: Citation[]) =>
            patch((m) => ({ ...m, citations })),
          onDone: ({ grounded }) => patch((m) => ({ ...m, grounded })),
          onError: () =>
            patch((m) => ({
              ...m,
              content:
                m.content || 'Sorry — something went wrong generating a reply.',
            })),
        },
        controller.signal,
      );
    } finally {
      patch((m) => ({ ...m, streaming: false }));
      setStreaming(false);
      abortRef.current = null;
      // Refresh chat list (title may have been auto-set) and history.
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
    }
  };

  const stop = () => abortRef.current?.abort();

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 pb-6 pt-4">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-16 w-2/3" />
              <Skeleton className="ml-auto h-16 w-1/2" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-24 text-center">
              <h2 className="text-2xl font-semibold">How can I help you study?</h2>
              <p className="mt-2 text-muted">
                Ask anything about your uploaded material.
              </p>
              <div className="mt-6 grid w-full gap-2 sm:grid-cols-3">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-xl border border-border p-3 text-left text-sm text-muted hover:bg-surface-2 hover:text-fg"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <Composer onSend={send} onStop={stop} streaming={streaming} />
    </div>
  );
}
