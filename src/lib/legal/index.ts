export * from './limitation';
export * from './forum';
export * from './compensation';
export * from './day4';
export function formatCaseNumber(year = new Date().getFullYear(), sequence = 1): string {
    return `NS/${year}/${String(sequence).padStart(4, '0')}`;
}
