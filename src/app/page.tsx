'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    Bell,
    BriefcaseBusiness,
    CalendarDays,
    ChevronDown,
    ChevronRight,
    CircleHelp,
    Clock3,
    FileText,
    FolderOpen,
    Gavel,
    LayoutDashboard,
    Menu,
    Moon,
    Plus,
    Search,
    Settings,
    ShieldCheck,
    Sparkles,
    Sun,
    Users,
    X,
} from 'lucide-react';
import { demoCases, demoDeadlines, type DemoCase, type DemoCaseStatus } from '@/mockDashboardData';

const statusStyles: Record<DemoCaseStatus, string> = {
    Analysis: 'bg-violet-50 text-violet-700 ring-violet-600/10',
    Investigation: 'bg-blue-50 text-blue-700 ring-blue-600/10',
    Intake: 'bg-amber-50 text-amber-700 ring-amber-600/10',
    Filed: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10',
};

const navItems = [
    { label: 'Overview', icon: LayoutDashboard, target: 'overview' },
    { label: 'Cases', icon: BriefcaseBusiness, count: '24', target: 'recent-cases' },
    { label: 'Documents', icon: FolderOpen, target: 'analysis-queue' },
    { label: 'Hearings', icon: CalendarDays, count: '3', target: 'deadlines' },
    { label: 'Team', icon: Users, target: 'team' },
];

function StatusBadge({ status }: { status: DemoCaseStatus }) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusStyles[status]}`}
        >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {status}
        </span>
    );
}

export default function HomePage() {
    const [activeNav, setActiveNav] = useState('Overview');
    const [query, setQuery] = useState('');
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [showNewCase, setShowNewCase] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [selectedCase, setSelectedCase] = useState<DemoCase | null>(null);
    const [caseList, setCaseList] = useState<DemoCase[]>(demoCases);
    const [newCase, setNewCase] = useState({ client: '', hospital: '', caseType: 'Misdiagnosis' });
    const [darkMode, setDarkMode] = useState(false);
    const [currentTime, setCurrentTime] = useState<Date | null>(null);

    useEffect(() => {
        const storedPreference = window.localStorage.getItem('medilex-theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setDarkMode(storedPreference ? storedPreference === 'dark' : prefersDark);
    }, []);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', darkMode);
        window.localStorage.setItem('medilex-theme', darkMode ? 'dark' : 'light');
    }, [darkMode]);

    useEffect(() => {
        const updateClock = () => setCurrentTime(new Date());
        updateClock();
        const timer = window.setInterval(updateClock, 1000);
        return () => window.clearInterval(timer);
    }, []);

    const filteredCases = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        if (!normalized) return caseList;
        return caseList.filter((item) =>
            [item.client, item.matter, item.id, item.status, item.hospital, item.caseType].some((value) =>
                value.toLowerCase().includes(normalized),
            ),
        );
    }, [caseList, query]);

    const scrollToSection = (target: string) => {
        document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleCreateCase = () => {
        const client = newCase.client.trim();
        const hospital = newCase.hospital.trim();
        if (!client || !hospital) return;
        const initials = client.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
        const createdCase: DemoCase = {
            id: `ML-2025-${String(caseList.length + 43).padStart(4, '0')}`,
            client,
            hospital,
            caseType: newCase.caseType,
            matter: `${newCase.caseType} · new intake`,
            forum: 'To be assigned',
            status: 'Intake',
            updated: 'Updated just now',
            initials,
            tone: 'bg-gold-100 text-gold-700',
        };
        setCaseList((current) => [createdCase, ...current]);
        setNewCase({ client: '', hospital: '', caseType: 'Misdiagnosis' });
        setShowNewCase(false);
        setActiveNav('Cases');
    };

    const formattedDate = currentTime
        ? new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(currentTime)
        : 'Loading current date';
    const formattedTime = currentTime
        ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(currentTime)
        : 'Loading time';

    return (
        <div className="min-h-screen w-full overflow-x-hidden bg-[#f7f8fb] text-navy">
            <aside
                className={`fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:translate-x-0 ${
                    mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <div className="flex h-20 items-center gap-3 border-b border-slate-100 px-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-gold shadow-sm">
                        <Gavel className="h-5 w-5" strokeWidth={2.2} />
                    </div>
                    <div>
                        <p className="font-serif text-xl font-semibold tracking-tight">MediLex</p>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                            Legal intelligence
                        </p>
                    </div>
                    <button
                        aria-label="Close navigation"
                        className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-slate-100 lg:hidden"
                        onClick={() => setMobileNavOpen(false)}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 px-3 py-6">
                    <p className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        Workspace
                    </p>
                    <nav className="mt-3 space-y-1">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const active = activeNav === item.label;
                            return (
                                <button
                                    key={item.label}
                                    onClick={() => {
                                        setActiveNav(item.label);
                                        setMobileNavOpen(false);
                                        scrollToSection(item.target);
                                    }}
                                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                                        active
                                            ? 'bg-navy text-white shadow-sm'
                                            : 'text-slate-500 hover:bg-slate-50 hover:text-navy'
                                    }`}
                                >
                                    <Icon className="h-[18px] w-[18px]" />
                                    <span>{item.label}</span>
                                    {item.count && (
                                        <span
                                            className={`ml-auto rounded-full px-2 py-0.5 text-xs ${
                                                active
                                                    ? 'bg-white/15 text-white'
                                                    : 'bg-slate-100 text-slate-500'
                                            }`}
                                        >
                                            {item.count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </nav>

                    <p className="mt-9 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        Intelligence
                    </p>
                    <nav className="mt-3 space-y-1">
                        <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-navy">
                            <Sparkles className="h-[18px] w-[18px] text-gold-500" />
                            <span>AI analysis</span>
                            <span className="ml-auto rounded-full bg-gold-50 px-2 py-0.5 text-[10px] font-bold text-gold-600">
                                NEW
                            </span>
                        </button>
                        <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-navy">
                            <FileText className="h-[18px] w-[18px]" />
                            <span>Templates</span>
                        </button>
                    </nav>
                </div>

                <div className="border-t border-slate-100 p-3">
                    <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-100 text-xs font-bold text-gold-700">
                            AK
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">Aarav Kapoor</p>
                            <p className="truncate text-xs text-slate-400">Kapoor &amp; Associates</p>
                        </div>
                        <Settings className="h-4 w-4 text-slate-400" />
                    </div>
                </div>
            </aside>

            {mobileNavOpen && (
                <button
                    aria-label="Close navigation overlay"
                    className="fixed inset-0 z-30 bg-navy/30 lg:hidden"
                    onClick={() => setMobileNavOpen(false)}
                />
            )}

            <div className="min-w-0 lg:pl-[252px]">
                <header className="relative sticky top-0 z-20 flex h-20 min-w-0 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-md sm:px-8">
                    <div className="flex items-center gap-3">
                        <button
                            aria-label="Open navigation"
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
                            onClick={() => setMobileNavOpen(true)}
                        >
                            <Menu className="h-5 w-5" />
                        </button>
                        <div className="hidden items-center gap-2 text-sm text-slate-400 sm:flex">
                            <span>Workspace</span>
                            <ChevronRight className="h-4 w-4" />
                            <span className="font-semibold text-navy">{activeNav}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4">
                        <div className="relative hidden md:block">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                aria-label="Search cases"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Search cases..."
                                className="h-10 w-56 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-gold-400 focus:bg-white focus:ring-2 focus:ring-gold-100"
                            />
                        </div>
                        <button
                            aria-label="Help"
                            onClick={() => { setShowHelp((current) => !current); setShowNotifications(false); setShowProfile(false); }}
                            className="hidden rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-navy sm:block"
                        >
                            <CircleHelp className="h-5 w-5" />
                        </button>
                        {showHelp && <div className="absolute right-40 top-16 z-30 w-64 rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-lg"><p className="font-semibold text-navy">Need a hand?</p><p className="mt-1 text-xs leading-5 text-slate-500">Use search to find a matter, or open a case to view its working file.</p></div>}
                        <button
                            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                            onClick={() => setDarkMode((current) => !current)}
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-navy dark:hover:bg-slate-800 dark:hover:text-slate-100"
                        >
                            {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                        </button>
                        <button
                            aria-label="Notifications"
                            onClick={() => { setShowNotifications((current) => !current); setShowHelp(false); setShowProfile(false); }}
                            className="relative rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-navy"
                        >
                            <Bell className="h-5 w-5" />
                            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-white bg-crimson-400" />
                        </button>
                        {showNotifications && <div className="absolute right-16 top-16 z-30 w-72 rounded-lg border border-slate-200 bg-white p-4 shadow-lg"><p className="font-semibold text-navy">Notifications</p><p className="mt-1 text-xs leading-5 text-slate-500">Ananya Sharma has an expert opinion due on 18 September.</p></div>}
                        <div className="hidden h-8 w-px bg-slate-200 sm:block" />
                        <button onClick={() => { setShowProfile((current) => !current); setShowHelp(false); setShowNotifications(false); }} className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-slate-50" aria-label="Open profile menu">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-100 text-xs font-bold text-gold-700">
                                AK
                            </div>
                            <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
                        </button>
                        {showProfile && <div className="absolute right-4 top-16 z-30 w-48 rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-lg"><p className="px-3 py-2 font-semibold text-navy">Aarav Kapoor</p><button onClick={() => setShowProfile(false)} className="w-full rounded-md px-3 py-2 text-left text-slate-600 hover:bg-slate-50">Close menu</button></div>}
                    </div>
                </header>

                <main id="overview" className="mx-auto w-full max-w-[1440px] min-w-0 px-4 py-7 sm:px-8 lg:px-10 lg:py-9">
                    <section className="flex scroll-mt-24 flex-col justify-between gap-5 border-b border-slate-200 pb-7 sm:flex-row sm:items-end dark:border-slate-700">
                        <div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                                <span>Overview</span>
                                <span className="text-slate-300">/</span>
                                <time dateTime={currentTime?.toISOString()}>{formattedDate}</time>
                                <span className="text-slate-300">/</span>
                                <time dateTime={currentTime?.toISOString()}>{formattedTime}</time>
                            </div>
                            <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
                                Case portfolio
                            </h1>
                            <p className="mt-2 text-sm text-slate-500">
                                A concise view of matters, deadlines, and team activity.
                            </p>
                        </div>
                        <button
                            onClick={() => setShowNewCase(true)}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-navy px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-700 focus:outline-none focus:ring-2 focus:ring-gold-400 focus:ring-offset-2"
                        >
                            <Plus className="h-4 w-4" />
                            New case
                        </button>
                    </section>

                    <section aria-label="Portfolio summary" className="mt-7 grid gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 shadow-sm dark:border-slate-700 dark:bg-slate-700 sm:grid-cols-2 xl:grid-cols-4">
                        {[
                            { label: 'Active cases', value: String(caseList.length), detail: '+3 this month', icon: BriefcaseBusiness, color: 'text-blue-600 bg-blue-50' },
                            { label: 'Needs attention', value: '7', detail: '2 due this week', icon: Clock3, color: 'text-amber-600 bg-amber-50' },
                            { label: 'Documents processed', value: '186', detail: '+28 this month', icon: FileText, color: 'text-violet-600 bg-violet-50' },
                            { label: 'Team members', value: '8', detail: 'All accounts active', icon: ShieldCheck, color: 'text-emerald-600 bg-emerald-50' },
                        ].map((stat) => {
                            const Icon = stat.icon;
                            return (
                                <div key={stat.label} className="bg-white p-5 dark:bg-[#121d35]">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                                            <p className="mt-2 text-3xl font-semibold tracking-tight text-navy">{stat.value}</p>
                                        </div>
                                        <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.color}`}>
                                            <Icon className="h-5 w-5" />
                                        </span>
                                    </div>
                                    <p className="mt-4 text-xs font-medium text-slate-400">{stat.detail}</p>
                                </div>
                            );
                        })}
                    </section>

                    <section className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
                        <div id="recent-cases" className="scroll-mt-24 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/30 dark:border-slate-700 dark:bg-[#121d35]">
                            <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                                <div>
                                    <h2 className="font-serif text-xl font-semibold text-navy">Recent cases</h2>
                                    <p className="mt-1 text-sm text-slate-400">Your team&apos;s latest case activity</p>
                                </div>
                                <button onClick={() => scrollToSection('recent-cases')} className="inline-flex cursor-pointer items-center gap-1 text-sm font-semibold text-gold-600 hover:text-gold-700 hover:underline">
                                    View all cases <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[680px] text-left">
                                    <thead className="bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                        <tr>
                                            <th className="px-6 py-3 font-semibold">Matter</th>
                                            <th className="px-4 py-3 font-semibold">Forum</th>
                                            <th className="px-4 py-3 font-semibold">Status</th>
                                            <th className="px-6 py-3 text-right font-semibold">Last activity</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredCases.map((item) => (
                                            <tr key={item.id} onClick={() => setSelectedCase(item)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedCase(item); }} tabIndex={0} className="group cursor-pointer transition-colors hover:bg-slate-50/70 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gold-500">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <span className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${item.tone}`}>
                                                            {item.initials}
                                                        </span>
                                                        <div>
                                                            <p className="text-sm font-semibold text-navy">{item.client}</p>
                                                            <p className="mt-0.5 text-xs text-slate-400">{item.id} · {item.matter}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-sm text-slate-500">{item.forum}</td>
                                                <td className="px-4 py-4"><StatusBadge status={item.status} /></td>
                                                <td className="px-6 py-4 text-right text-xs text-slate-400">{item.updated}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {filteredCases.length === 0 && (
                                    <div className="px-6 py-12 text-center">
                                        <Search className="mx-auto h-6 w-6 text-slate-300" />
                                        <p className="mt-3 text-sm font-medium text-slate-500">No cases found</p>
                                        <button onClick={() => setQuery('')} className="mt-1 text-xs font-semibold text-gold-600">Clear search</button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div id="deadlines" className="scroll-mt-24 rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30 dark:border-slate-700 dark:bg-[#121d35] sm:p-6">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="font-serif text-xl font-semibold text-navy">Upcoming deadlines</h2>
                                    <p className="mt-1 text-sm text-slate-400">Stay ahead of your calendar</p>
                                </div>
                                <button onClick={() => setActiveNav('Hearings')} aria-label="Open calendar" className="cursor-pointer rounded-md text-gold-500 transition hover:bg-gold-50 hover:text-gold-700">
                                    <CalendarDays className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="mt-5 space-y-4">
                                {demoDeadlines.map((item) => (
                                    <div key={item.title} className="flex items-center gap-3">
                                        <div className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg ${item.urgent ? 'bg-crimson-50 text-crimson-500' : 'bg-slate-50 text-slate-500'}`}>
                                            <span className="text-base font-bold leading-none">{item.date}</span>
                                            <span className="mt-0.5 text-[9px] font-bold tracking-wider">{item.month}</span>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-navy">{item.title}</p>
                                            <p className="mt-1 truncate text-xs text-slate-400">{item.case}</p>
                                        </div>
                                        {item.urgent && <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-crimson-400" />}
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => setActiveNav('Hearings')} className="mt-6 flex w-full cursor-pointer items-center justify-center gap-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-gold-300 hover:bg-gold-50 hover:text-gold-700 active:scale-[0.99]">
                                Open calendar <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </section>

                    <section id="analysis-queue" className="mt-6 scroll-mt-24 rounded-lg border border-navy-700 bg-navy p-6 text-white shadow-sm sm:p-7">
                        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
                            <div className="flex items-start gap-4">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold text-navy">
                                    <Sparkles className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-gold-300">Analysis queue</p>
                                    <h2 className="mt-2 font-serif text-2xl font-semibold">Three matters are ready for review.</h2>
                                    <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
                                        Review extracted timelines, contradictions, and precedent matches before sharing the next update with your client.
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => scrollToSection('recent-cases')} className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-gold px-4 py-3 text-sm font-bold text-navy transition hover:bg-gold-300 active:scale-[0.99]">
                                Review queue <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </section>
                </main>
            </div>

            {showNewCase && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4 backdrop-blur-sm">
                    <div role="dialog" aria-modal="true" aria-labelledby="new-case-title" className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 id="new-case-title" className="font-serif text-2xl font-semibold text-navy">Create a new case</h2>
                                <p className="mt-1 text-sm text-slate-500">Start with the essential case details.</p>
                            </div>
                            <button aria-label="Close dialog" onClick={() => setShowNewCase(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-navy">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="mt-6 space-y-4">
                            <label className="block text-sm font-medium text-slate-700">Client name<input value={newCase.client} onChange={(event) => setNewCase((current) => ({ ...current, client: event.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-100" placeholder="e.g. Priya Menon" /></label>
                            <label className="block text-sm font-medium text-slate-700">Hospital name<input value={newCase.hospital} onChange={(event) => setNewCase((current) => ({ ...current, hospital: event.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-100" placeholder="e.g. Apollo Hospitals" /></label>
                            <label className="block text-sm font-medium text-slate-700">Case type<select value={newCase.caseType} onChange={(event) => setNewCase((current) => ({ ...current, caseType: event.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-100"><option>Misdiagnosis</option><option>Surgical error</option><option>Delayed treatment</option><option>Medication error</option></select></label>
                        </div>
                        <div className="mt-7 flex justify-end gap-3">
                            <button onClick={() => setShowNewCase(false)} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50">Cancel</button>
                            <button onClick={handleCreateCase} disabled={!newCase.client.trim() || !newCase.hospital.trim()} className="rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-40">Create case</button>
                        </div>
                    </div>
                </div>
            )}

            {selectedCase && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4 backdrop-blur-sm" onClick={() => setSelectedCase(null)}>
                    <div role="dialog" aria-modal="true" aria-labelledby="case-detail-title" className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.16em] text-gold-600">{selectedCase.id}</p>
                                <h2 id="case-detail-title" className="mt-2 font-serif text-2xl font-semibold text-navy">{selectedCase.client}</h2>
                                <p className="mt-1 text-sm text-slate-500">{selectedCase.matter}</p>
                            </div>
                            <button aria-label="Close case details" onClick={() => setSelectedCase(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-navy"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="mt-6 grid gap-4 sm:grid-cols-2">
                            <div><p className="text-xs font-semibold text-slate-400">Hospital</p><p className="mt-1 text-sm font-medium text-navy">{selectedCase.hospital}</p></div>
                            <div><p className="text-xs font-semibold text-slate-400">Case type</p><p className="mt-1 text-sm font-medium text-navy">{selectedCase.caseType}</p></div>
                            <div><p className="text-xs font-semibold text-slate-400">Forum</p><p className="mt-1 text-sm font-medium text-navy">{selectedCase.forum}</p></div>
                            <div><p className="text-xs font-semibold text-slate-400">Stage</p><div className="mt-1"><StatusBadge status={selectedCase.status} /></div></div>
                        </div>
                        <button onClick={() => setSelectedCase(null)} className="mt-7 w-full rounded-lg bg-navy px-4 py-3 text-sm font-semibold text-white hover:bg-navy-700">Close matter</button>
                    </div>
                </div>
            )}
        </div>
    );
}
