import type { AnalyzeRequest } from '@retailflow/shared';

export function normalizeError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { error?: string } } }).response;
    if (response?.data?.error) {
      return response.data.error;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred.';
}

export function buildClientFileName(
  transferType: AnalyzeRequest['transferType'],
  targetStore: string,
  strategy: AnalyzeRequest['strategy'],
): string {
  const base =
    transferType === 'global'
      ? 'global-transfer'
      : transferType === 'targeted'
        ? 'targeted-transfer'
        : 'size-completion';
  return [base, targetStore || 'all-stores', strategy, Date.now()].join('-') + '.xlsx';
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
