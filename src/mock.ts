import { mockCases, mockDocuments, mockAnalysis, mockProfiles, mockFirm } from '@/mockData';

const isProduction = process.env.NODE_ENV === 'production';

export function getMockCases() {
  if (!isProduction && (!globalThis as any).supabase) {
    return mockCases;
  }
  return [];
}

export function getMockDocuments() {
  if (!isProduction && (!globalThis as any).supabase) {
    return mockDocuments;
  }
  return [];
}

export function getMockCase(caseId: string) {
  if (!isProduction && (!globalThis as any).supabase) {
    return mockCases.find((c) => c.id === caseId);
  }
  return undefined;
}

export function getMockDocumentsForCase(caseId: string) {
  if (!isProduction && (!globalThis as any).supabase) {
    return mockDocuments.filter((d) => d.case_id === caseId);
  }
  return [];
}

export const MOCK_DATA = {
  cases: mockCases,
  documents: mockDocuments,
  analysis: mockAnalysis,
  profiles: mockProfiles,
  firm: mockFirm,
};