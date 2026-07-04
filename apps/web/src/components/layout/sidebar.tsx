'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  BookOpen,
  FileText,
  LogOut,
  MessageSquarePlus,
  Pin,
  PinOff,
  Search,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemeToggle } from './theme-toggle';
import {
  useChats,
  useCreateChat,
  useDeleteChat,
  useUpdateChat,
} from '@/hooks/use-chats';
import { useLogout } from '@/hooks/use-auth';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';

export function Sidebar(): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useChats(search || undefined);
  const createChat = useCreateChat();
  const updateChat = useUpdateChat();
  const deleteChat = useDeleteChat();
  const logout = useLogout();
  const user = useAuthStore((s) => s.user);

  const chats = data?.data ?? [];

  const handleNewChat = async () => {
    const chat = await createChat.mutateAsync(undefined);
    router.push(`/chat/${chat.id}`);
  };

  return (
    <aside className="flex h-full w-72 flex-col border-r border-border bg-surface/60">
      <div className="flex items-center justify-between p-4">
        <Link href="/chat" className="font-semibold">
          Campus<span className="gradient-text">Brain</span>
        </Link>
        <ThemeToggle />
      </div>

      <div className="px-3">
        <Button onClick={handleNewChat} className="w-full" disabled={createChat.isPending}>
          <MessageSquarePlus className="h-4 w-4" /> New chat
        </Button>
      </div>

      <div className="relative px-3 py-3">
        <Search className="absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search chats"
          className="pl-9"
        />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))
        ) : chats.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted">No chats yet.</p>
        ) : (
          chats.map((chat) => {
            const active = pathname === `/chat/${chat.id}`;
            return (
              <div
                key={chat.id}
                className={cn(
                  'group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm',
                  active ? 'bg-surface-2' : 'hover:bg-surface-2',
                )}
              >
                <Link href={`/chat/${chat.id}`} className="flex-1 truncate">
                  {chat.isPinned && (
                    <Pin className="mr-1 inline h-3 w-3 text-accent" />
                  )}
                  {chat.title}
                </Link>
                <button
                  aria-label="Pin chat"
                  className="hidden text-muted hover:text-fg group-hover:block"
                  onClick={() =>
                    updateChat.mutate({ id: chat.id, isPinned: !chat.isPinned })
                  }
                >
                  {chat.isPinned ? (
                    <PinOff className="h-3.5 w-3.5" />
                  ) : (
                    <Pin className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  aria-label="Delete chat"
                  className="hidden text-muted hover:text-red-400 group-hover:block"
                  onClick={async () => {
                    await deleteChat.mutateAsync(chat.id);
                    if (active) router.push('/chat');
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })
        )}
      </nav>

      <div className="space-y-2 border-t border-border p-3">
        <Link
          href="/study"
          className={cn(
            'flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-surface-2',
            pathname === '/study' && 'bg-surface-2',
          )}
        >
          <BookOpen className="h-4 w-4" /> Study tools
        </Link>
        <Link
          href="/documents"
          className={cn(
            'flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-surface-2',
            pathname === '/documents' && 'bg-surface-2',
          )}
        >
          <FileText className="h-4 w-4" /> Documents
        </Link>
        <div className="flex items-center justify-between rounded-lg px-2 py-1.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user?.fullName}</p>
            <p className="truncate text-xs text-muted">{user?.email}</p>
          </div>
          <button
            aria-label="Log out"
            className="text-muted hover:text-fg"
            onClick={async () => {
              await logout();
              router.push('/login');
            }}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
