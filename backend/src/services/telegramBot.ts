import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { appConfig } from '../config.js';
import { runTelegramMidtownAnalysis } from '../usecases/runTelegramMidtownAnalysis.js';

interface TelegramPhotoSize {
  file_id: string;
  width: number;
  height: number;
  file_size?: number;
}

interface TelegramChat {
  id: number;
  type: string;
}

interface TelegramMessage {
  message_id: number;
  chat: TelegramChat;
  photo?: TelegramPhotoSize[];
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

let botStarted = false;
let pollingOffset = 0;
let stopPolling = false;

async function telegramApi<T>(method: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${appConfig.telegramBotToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json = await response.json() as { ok: boolean; result?: T; description?: string };
  if (!response.ok || !json.ok || json.result == null) {
    throw new Error(json.description || `Telegram API hatasi (${method})`);
  }
  return json.result;
}

async function sendMessage(chatId: number, text: string): Promise<void> {
  await telegramApi('sendMessage', {
    chat_id: chatId,
    text,
  });
}

async function sendTyping(chatId: number): Promise<void> {
  await telegramApi('sendChatAction', {
    chat_id: chatId,
    action: 'typing',
  });
}

function pickLargestPhoto(photos: TelegramPhotoSize[]): TelegramPhotoSize | undefined {
  return [...photos].sort((left, right) => {
    const leftScore = left.file_size ?? left.width * left.height;
    const rightScore = right.file_size ?? right.width * right.height;
    return rightScore - leftScore;
  })[0];
}

async function downloadTelegramPhoto(fileId: string): Promise<string> {
  const fileResult = await telegramApi<{ file_path?: string }>('getFile', { file_id: fileId });
  if (!fileResult.file_path) {
    throw new Error('Telegram dosya yolu alinamadi.');
  }

  const fileUrl = `https://api.telegram.org/file/bot${appConfig.telegramBotToken}/${fileResult.file_path}`;
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error('Telegram fotograf indirilemedi.');
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const ext = path.extname(fileResult.file_path) || '.jpg';
  const filePath = path.resolve(appConfig.uploadDir, `telegram-${randomUUID()}${ext}`);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, bytes);
  return filePath;
}

async function handlePhotoMessage(message: TelegramMessage): Promise<void> {
  const photos = message.photo ?? [];
  if (photos.length === 0) return;

  const bestPhoto = pickLargestPhoto(photos);
  if (!bestPhoto) return;

  await sendTyping(message.chat.id);
  const imagePath = await downloadTelegramPhoto(bestPhoto.file_id);

  try {
    const result = await runTelegramMidtownAnalysis(imagePath);
    await sendMessage(message.chat.id, result.messageText);
    console.log(`[TELEGRAM] Analiz tamamlandi chat=${message.chat.id} found=${result.foundCount}`);
  } catch (error) {
    console.error('[TELEGRAM] Analiz hatasi:', error);
    const errorText = error instanceof Error ? error.message : 'Bilinmeyen hata';
    await sendMessage(message.chat.id, `Midtown analizi basarisiz.\n${errorText}`);
  } finally {
    await fs.rm(imagePath, { force: true });
  }
}

async function handleUpdate(update: TelegramUpdate): Promise<void> {
  const message = update.message;
  if (!message) return;

  if (message.photo && message.photo.length > 0) {
    await handlePhotoMessage(message);
    return;
  }

  if (message.chat.type === 'private') {
    await sendMessage(message.chat.id, 'Sistem hazir. Gruba raf fotografi gondermen yeterli.');
  }
}

async function syncOffsetWithLatestUpdate(): Promise<void> {
  const updates = await telegramApi<TelegramUpdate[]>('getUpdates', {
    timeout: 0,
    allowed_updates: ['message'],
  });
  const lastUpdate = updates.at(-1);
  if (lastUpdate) {
    pollingOffset = lastUpdate.update_id + 1;
  }
}

async function pollLoop(): Promise<void> {
  while (!stopPolling) {
    try {
      const updates = await telegramApi<TelegramUpdate[]>('getUpdates', {
        offset: pollingOffset,
        timeout: 30,
        allowed_updates: ['message'],
      });

      if (stopPolling) break;

      if (updates.length === 0) {
        continue;
      }

      for (const update of updates) {
        pollingOffset = Math.max(pollingOffset, update.update_id + 1);
        await handleUpdate(update);
      }
    } catch (error) {
      if (stopPolling) break;
      const msg = error instanceof Error ? error.message : String(error);
      const isConflict = msg.includes('Conflict') || msg.includes('terminated by other');
      if (isConflict) {
        // Eski process hâlâ poll ediyor — bekle, o ölünce devam et
        console.log('[TELEGRAM] Çakışma tespit edildi, 12 saniye bekleniyor...');
        await new Promise((resolve) => setTimeout(resolve, 12000));
      } else {
        console.error('[TELEGRAM] Polling hatasi:', msg);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  }
  console.log('[TELEGRAM] Polling durduruldu.');
}

export async function startTelegramBot(): Promise<void> {
  if (botStarted) return;
  if (!appConfig.telegramBotToken) {
    console.log('[TELEGRAM] TELEGRAM_BOT_TOKEN yok, bot baslatilmadi.');
    return;
  }

  botStarted = true;
  stopPolling = false;

  // tsx watch SIGTERM gönderdiğinde polling'i temiz durdur
  const shutdown = (): void => {
    stopPolling = true;
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  await syncOffsetWithLatestUpdate();
  console.log(`[TELEGRAM] Bot polling basladi. Store=${appConfig.telegramTestStore} provider=${appConfig.telegramTestProvider}`);
  void pollLoop();
}
