import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const configDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(configDir, '..');
const repoRoot = path.resolve(backendDir, '..');
const backendEnvPath = path.join(backendDir, '.env');
const rootEnvPath = path.join(repoRoot, '.env');

loadEnv({ path: backendEnvPath });
loadEnv({ path: rootEnvPath, override: true });

function positiveIntFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

const visionProvider: 'python' | 'openai' = process.env.VISION_PROVIDER === 'openai' ? 'openai' : 'python';
const openAIVisionDetail = ['low', 'high', 'original', 'auto'].includes(process.env.OPENAI_VISION_DETAIL ?? '')
  ? (process.env.OPENAI_VISION_DETAIL as 'low' | 'high' | 'original' | 'auto')
  : 'original';
const openAIVisionReasoningEffort = ['low', 'medium', 'high'].includes(process.env.OPENAI_VISION_REASONING_EFFORT ?? '')
  ? (process.env.OPENAI_VISION_REASONING_EFFORT as 'low' | 'medium' | 'high')
  : 'medium';

export const appConfig = {
  port: Number(process.env.PORT ?? 8787),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  uploadDir: process.env.UPLOAD_DIR ?? 'tmp',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  telegramTestStore: process.env.TELEGRAM_TEST_STORE ?? 'Midtown',
  telegramTestProvider: process.env.TELEGRAM_TEST_PROVIDER ?? 'openai',
  visionProvider,
  openAIApiKey: process.env.OPENAI_API_KEY ?? '',
  openAIVisionModel: process.env.OPENAI_VISION_MODEL ?? 'gpt-5.4',
  openAIVisionDetail,
  openAIVisionReasoningEffort,
  openAIVisionMaxCatalogItems: positiveIntFromEnv('OPENAI_VISION_MAX_CATALOG_ITEMS', 100),
  openAIVisionReferenceImagesPerProduct: positiveIntFromEnv('OPENAI_VISION_REFERENCE_IMAGES_PER_PRODUCT', 2),
  openAIVisionReferenceMaxDimension: positiveIntFromEnv('OPENAI_VISION_REFERENCE_MAX_DIMENSION', 768),
  openAIVisionShelfMaxDimension: Math.max(0, Number(process.env.OPENAI_VISION_SHELF_MAX_DIMENSION ?? 0) || 0),
  openAIVisionMaxOutputTokens: positiveIntFromEnv('OPENAI_VISION_MAX_OUTPUT_TOKENS', 2500),
};
