export type DemoCaseStatus = 'Analysis' | 'Investigation' | 'Intake' | 'Filed';

export type DemoCase = {
    id: string;
    client: string;
    matter: string;
    forum: string;
    status: DemoCaseStatus;
    updated: string;
    initials: string;
    tone: string;
    hospital: string;
    caseType: string;
};

export type DemoDeadline = {
    date: string;
    month: string;
    title: string;
    case: string;
    urgent: boolean;
};

export const demoCases: DemoCase[] = [
    {
        id: 'ML-2025-0042',
        client: 'Ananya Sharma',
        matter: 'Delayed treatment · permanent disability',
        forum: 'State commission',
        status: 'Analysis',
        updated: 'Updated 18 min ago',
        initials: 'AS',
        tone: 'bg-rose-100 text-rose-700',
        hospital: 'Apollo Hospitals',
        caseType: 'Delayed treatment',
    },
    {
        id: 'ML-2025-0041',
        client: 'Ramesh Kumar',
        matter: 'Surgical error · prolonged suffering',
        forum: 'District commission',
        status: 'Investigation',
        updated: 'Updated yesterday',
        initials: 'RK',
        tone: 'bg-blue-100 text-blue-700',
        hospital: 'Fortis Healthcare',
        caseType: 'Surgical error',
    },
    {
        id: 'ML-2025-0038',
        client: 'Meera Iyer',
        matter: 'Medication error · temporary disability',
        forum: 'District commission',
        status: 'Intake',
        updated: 'Updated 2 days ago',
        initials: 'MI',
        tone: 'bg-amber-100 text-amber-700',
        hospital: 'Kokilaben Hospital',
        caseType: 'Medication error',
    },
    {
        id: 'ML-2025-0035',
        client: 'Devendra Singh',
        matter: 'Informed consent failure · death',
        forum: 'NCDRC',
        status: 'Filed',
        updated: 'Updated 4 days ago',
        initials: 'DS',
        tone: 'bg-emerald-100 text-emerald-700',
        hospital: 'Max Super Speciality Hospital',
        caseType: 'Informed consent failure',
    },
];

export const demoDeadlines: DemoDeadline[] = [
    { date: '18', month: 'SEP', title: 'Submit expert opinion', case: 'ML-2025-0042 · Ananya Sharma', urgent: true },
    { date: '22', month: 'SEP', title: 'District commission hearing', case: 'ML-2025-0041 · Ramesh Kumar', urgent: false },
    { date: '30', month: 'SEP', title: 'Limitation period review', case: 'ML-2025-0038 · Meera Iyer', urgent: false },
];
