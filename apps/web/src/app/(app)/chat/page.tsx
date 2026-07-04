'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useCreateChat } from '@/hooks/use-chats';
import { Spinner } from '@/components/ui/spinner';

/**
 * Entry to the chat area: creates a fresh chat once and redirects into it, so
 * the user always lands on a real, streamable conversation.
 */
export default function ChatIndexPage(): React.ReactElement {
  const router = useRouter();
  const createChat = useCreateChat();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    createChat
      .mutateAsync(undefined)
      .then((chat) => router.replace(`/chat/${chat.id}`))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full items-center justify-center">
      <Spinner className="h-6 w-6" />
    </div>
  );
}
