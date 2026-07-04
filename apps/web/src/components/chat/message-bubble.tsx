'use client';

import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User } from 'lucide-react';
import { Citations } from './citations';
import { Spinner } from '@/components/ui/spinner';
import type { Citation } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface DisplayMessage {
  id: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  citations?: Citation[];
  streaming?: boolean;
  grounded?: boolean;
}

export function MessageBubble({
  message,
}: {
  message: DisplayMessage;
}): React.ReactElement {
  const isUser = message.role === 'USER';

  return (
    <div className={cn('flex gap-3 py-4', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          isUser ? 'bg-surface-2' : 'bg-primary/15 text-primary',
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-3',
          isUser ? 'bg-surface-2' : 'glass',
        )}
      >
        {message.content ? (
          <div className="prose-chat text-sm">
            <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
          </div>
        ) : message.streaming ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Spinner /> Thinking…
          </div>
        ) : null}

        {message.streaming && message.content && (
          <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary align-middle" />
        )}

        {!message.streaming && message.citations && (
          <Citations citations={message.citations} />
        )}
      </div>
    </div>
  );
}
