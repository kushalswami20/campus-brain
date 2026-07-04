'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Activity,
  FileText,
  MessageSquare,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart } from '@/components/admin/bar-chart';
import {
  useAdminOverview,
  useAdminUsers,
  useDocumentsByType,
  useMessagesPerDay,
  useSetUserStatus,
} from '@/hooks/use-admin';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';

function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
}): React.ReactElement {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 text-muted">
        <Icon className="h-4 w-4" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default function AdminPage(): React.ReactElement {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  const overview = useAdminOverview();
  const messages = useMessagesPerDay(14);
  const docsByType = useDocumentsByType();
  const [search, setSearch] = useState('');
  const users = useAdminUsers(search);
  const setStatus = useSetUserStatus();

  useEffect(() => {
    if (user && !isAdmin) router.replace('/chat');
  }, [user, isAdmin, router]);

  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <ShieldAlert className="h-8 w-8 text-muted" />
        <p className="mt-2 text-muted">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-semibold">Admin dashboard</h1>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {overview.isLoading || !overview.data ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))
          ) : (
            <>
              <Kpi icon={Users} label="Total users" value={overview.data.totalUsers} />
              <Kpi icon={Activity} label="Active today" value={overview.data.activeToday} />
              <Kpi icon={FileText} label="Documents" value={overview.data.documents} />
              <Kpi icon={MessageSquare} label="Messages" value={overview.data.messages} />
            </>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {overview.data && (
            <>
              <Kpi icon={MessageSquare} label="Chats" value={overview.data.chats} />
              <Kpi icon={Activity} label="Avg latency" value={`${overview.data.avgLatencyMs}ms`} />
              <Kpi icon={Activity} label="Tokens" value={overview.data.totalTokens} />
              <Kpi icon={Activity} label="Est. cost" value={`$${overview.data.estCostUsd}`} />
            </>
          )}
        </div>

        {/* Charts */}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-medium text-muted">Messages / day (14d)</h3>
            {messages.data ? (
              <BarChart
                data={messages.data.map((d) => ({ label: d.date, value: d.count }))}
              />
            ) : (
              <Skeleton className="h-40 w-full" />
            )}
          </div>
          <div className="rounded-2xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-medium text-muted">Documents by type</h3>
            {docsByType.data ? (
              <BarChart
                data={docsByType.data.map((d) => ({ label: d.type, value: d.count }))}
              />
            ) : (
              <Skeleton className="h-40 w-full" />
            )}
          </div>
        </div>

        {/* Users */}
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted">Users</h3>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users"
              className="h-8 w-56"
            />
          </div>
          <div className="overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-2">User</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Docs</th>
                  <th className="px-4 py-2">Chats</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {users.data?.data.map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="px-4 py-2">
                      <div className="font-medium">{u.fullName}</div>
                      <div className="text-xs text-muted">{u.email}</div>
                    </td>
                    <td className="px-4 py-2">
                      <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-2">{u.documentCount}</td>
                    <td className="px-4 py-2">{u.chatCount}</td>
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          'text-xs',
                          u.isActive ? 'text-emerald-400' : 'text-red-400',
                        )}
                      >
                        {u.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setStatus.mutate({ id: u.id, isActive: !u.isActive })
                        }
                      >
                        {u.isActive ? 'Disable' : 'Enable'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
