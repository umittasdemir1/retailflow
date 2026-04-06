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
  return 'Beklenmeyen bir hata olustu.';
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
        : 'beden-tamamlama';
  return [base, targetStore || 'tum-magazalar', strategy, Date.now()].join('-') + '.xlsx';
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
