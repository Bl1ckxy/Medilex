'use client';

import { useState } from 'react';
import { Users, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UsersData } from './users-data-table';
import { CasesData } from './cases-data-table';

const TABS = [
    { value: 'users', label: 'Team & Access', Icon: Users },
    { value: 'cases', label: 'Case Oversight', Icon: Scale },
] as const;

export function AdminTabs({ currentUserId }: { currentUserId: string }) {
    const [tab, setTab] = useState<'users' | 'cases'>('users');

    return (
        <div>
            <div className="flex overflow-x-auto border-b">
                {TABS.map(({ value, label, Icon }) => (
                    <button
                        key={value}
                        type="button"
                        onClick={() => setTab(value)}
                        aria-pressed={tab === value}
                        className={cn(
                            'flex shrink-0 items-center gap-2 border-b-2 px-6 py-3 text-sm font-medium transition-colors',
                            tab === value ? 'border-navy text-navy' : 'border-transparent text-slate-500 hover:text-navy',
                        )}
                    >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        {label}
                    </button>
                ))}
            </div>

            <div className="p-6">
                {tab === 'users' ? <UsersData currentUserId={currentUserId} /> : <CasesData />}
            </div>
        </div>
    );
}
