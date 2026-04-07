import { Router } from 'express';
import { exportAnalysis } from '../usecases/exportAnalysis.js';
import { validateExportRequest } from '../utils/validators.js';

export const exportRouter = Router();

exportRouter.post('/excel', async (req, res, next) => {
  try {
    const payload = validateExportRequest(req.body ?? {});
    const file = await exportAnalysis(payload);
    const filename = buildFileName(payload.transferType, payload.targetStore, payload.strategy);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=' + filename);
    res.send(file);
  } catch (error) {
    next(error);
  }
});

function buildFileName(transferType: string, targetStore: string | undefined, strategy: string): string {
  const timestamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  if (transferType === 'size_completion') {
    return sanitizeFileName('beden-tamamlama-' + (targetStore ?? 'tum-magazalar') + '-' + strategy + '-' + timestamp + '.xlsx');
  }

  if (transferType === 'targeted') {
    return sanitizeFileName('targeted-' + (targetStore ?? 'hedef-magaza') + '-' + strategy + '-' + timestamp + '.xlsx');
  }

  return sanitizeFileName('global-transfer-' + strategy + '-' + timestamp + '.xlsx');
}

function sanitizeFileName(input: string): string {
  const allowed = new Set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-'.split(''));
  return input
    .split('')
    .map((char) => (allowed.has(char) ? char : '-'))
    .join('');
}
