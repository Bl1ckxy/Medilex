'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/shared/ui';
import { Shield, ShieldOff, UserCheck, UserX, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TeamMember {
    id: string;
    full_name: string | null;
    email: string;
    role: string;
    is_active: boolean;
    created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
    firm_admin: 'Firm admin',
    senior_partner: 'Senior partner',
    associate: 'Associate',
    paralegal: 'Paralegal',
};

function RoleBadge({ role }: { role: string }) {
    const label = ROLE_LABELS[role] ?? role.replace(/_/g, ' ');
    const isAdmin = role === 'firm_admin';
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                isAdmin ? 'bg-gold-50 text-gold-600' : 'bg-slate-100 text-slate-600',
            )}
        >
            {label}
        </span>
    );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-crimson-50 text-crimson-600',
            )}
        >
            {isActive ? 'Active' : 'Suspended'}
        </span>
    );
}

export function UsersData({ currentUserId }: { currentUserId: string }) {
    const [users, setUsers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function fetchUsers() {
            const supabase = createSupabaseBrowserClient();
            const { data, error } = await supabase
                .from('users')
                .select('id, full_name, email, role, is_active, created_at')
                .order('created_at', { ascending: false });
            if (cancelled) return;
            if (error) {
                console.error('[ADMIN] Failed to load team:', error.message);
                toast.error('Failed to load team members');
                setUsers([]);
            } else {
                setUsers((data ?? []) as TeamMember[]);
            }
            setLoading(false);
        }
        void fetchUsers();
        return () => {
            cancelled = true;
        };
    }, []);

    async function toggleRole(user: TeamMember) {
        if (user.id === currentUserId) return;
        setActionLoading(user.id);
        const newRole = user.role === 'firm_admin' ? 'associate' : 'firm_admin';
        const supabase = createSupabaseBrowserClient();
        const { error } = await (supabase.from('users') as any).update({ role: newRole }).eq('id', user.id);

        if (error) {
            toast.error(`Failed to update role: ${error.message}`);
        } else {
            setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u)));
            toast.success(`Role updated to ${ROLE_LABELS[newRole] ?? newRole}`);
        }
        setActionLoading(null);
    }

    async function toggleStatus(user: TeamMember) {
        if (user.id === currentUserId) return;
        setActionLoading(user.id);
        const newActive = !user.is_active;
        const supabase = createSupabaseBrowserClient();
        const { error } = await (supabase.from('users') as any).update({ is_active: newActive }).eq('id', user.id);

        if (error) {
            toast.error(`Failed to update status: ${error.message}`);
        } else {
            setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_active: newActive } : u)));
            toast.success(`User ${newActive ? 'activated' : 'suspended'}`);
        }
        setActionLoading(null);
    }

    if (loading) {
        return (
            <div className="flex h-48 items-center justify-center text-slate-400">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" /> Loading team data…
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Team Members</h3>
                <p className="text-xs text-slate-400">
                    {users.length} {users.length === 1 ? 'member' : 'members'} · role changes take effect on next sign-in
                </p>
            </div>

            <div className="overflow-x-auto rounded-md border border-slate-200">
                <table className="w-full min-w-[720px] text-sm">
                    <thead className="border-b bg-slate-50">
                        <tr>
                            <th className="p-3 text-left font-semibold text-slate-500">User</th>
                            <th className="p-3 text-left font-semibold text-slate-500">Role</th>
                            <th className="p-3 text-left font-semibold text-slate-500">Status</th>
                            <th className="p-3 text-right font-semibold text-slate-500">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => (
                            <tr key={user.id} className="border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50/50">
                                <td className="p-3">
                                    <div className="font-medium text-navy">{user.full_name || 'Unnamed'}</div>
                                    <div className="text-xs text-slate-500">{user.email}</div>
                                </td>
                                <td className="p-3">
                                    <RoleBadge role={user.role} />
                                </td>
                                <td className="p-3">
                                    <StatusBadge isActive={user.is_active} />
                                </td>
                                <td className="space-x-2 p-3 text-right">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => void toggleRole(user)}
                                        disabled={user.id === currentUserId || actionLoading === user.id}
                                        title={user.id === currentUserId ? 'You cannot change your own role' : undefined}
                                    >
                                        {actionLoading === user.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                        ) : user.role === 'firm_admin' ? (
                                            <ShieldOff className="mr-1 h-4 w-4" aria-hidden="true" />
                                        ) : (
                                            <Shield className="mr-1 h-4 w-4" aria-hidden="true" />
                                        )}
                                        {user.role === 'firm_admin' ? 'Demote' : 'Promote'}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => void toggleStatus(user)}
                                        disabled={user.id === currentUserId || actionLoading === user.id}
                                        title={user.id === currentUserId ? 'You cannot suspend your own account' : undefined}
                                        className={cn(
                                            user.is_active
                                                ? 'text-crimson hover:text-crimson'
                                                : 'text-emerald-600 hover:text-emerald-600',
                                        )}
                                    >
                                        {user.is_active ? (
                                            <UserX className="mr-1 h-4 w-4" aria-hidden="true" />
                                        ) : (
                                            <UserCheck className="mr-1 h-4 w-4" aria-hidden="true" />
                                        )}
                                        {user.is_active ? 'Suspend' : 'Activate'}
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
