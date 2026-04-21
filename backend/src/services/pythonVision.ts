import os from 'node:os';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { rm, writeFile } from 'node:fs/promises';
import type { CatalogProductPublic, VisionStatusResponse } from '@retailflow/shared';
import type { CatalogProduct } from '../store/catalogStore.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolvePythonScript(): string {
  for (let levels = 2; levels <= 5; levels++) {
    const parts: string[] = [__dirname];
    for (let i = 0; i < levels; i++) parts.push('..');
    parts.push('vision_py', 'pipeline.py');
    const candidate = path.join(...parts);
    if (existsSync(candidate)) return candidate;
  }
  return path.join(process.cwd(), 'vision_py', 'pipeline.py');
}

function resolvePythonBin(): string {
  const candidates = [
    process.env.VISION_PYTHON,
    '/tmp/vision-venv/bin/python',
    path.join(process.cwd(), '.venv-vision', 'bin', 'python'),
    path.join(process.cwd(), '..', '.venv-vision', 'bin', 'python'),
    'python3',
    'python',
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (!candidate.includes(path.sep)) return candidate;
    if (existsSync(candidate)) return candidate;
  }

  return 'python3';
}

const PYTHON_BIN = resolvePythonBin();
const PYTHON_SCRIPT = resolvePythonScript();
const PYTHON_ENV = {
  ...process.env,
  HF_HOME: process.env.HF_HOME ?? '/tmp/hf-home',
  TORCH_HOME: process.env.TORCH_HOME ?? '/tmp/torch-home',
  XDG_CACHE_HOME: process.env.XDG_CACHE_HOME ?? '/tmp/.cache',
  PYTHONUNBUFFERED: '1',
};

export interface PythonMatchedDetection {
  catalogProductId: string;
  productCode: string;
  productName: string;
  color: string;
  description: string;
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  dotPosition?: { x: number; y: number };
  detectorConfidence: number;
  detectorClass: string;
  margin: number;
  topMatches: Array<{
    catalogProductId: string;
    productCode: string;
    productName: string;
    score: number;
  }>;
}

export interface PythonRecognizeResponse {
  imageWidth: number;
  imageHeight: number;
  processingTimeMs: number;
  scannedRegions: number;
  modelVersion: string;
  detections: PythonMatchedDetection[];
}

async function runPythonCommand<T>(command: 'status' | 'embed' | 'recognize' | 'recognize_calibrated', payload: object): Promise<T> {
  const payloadPath = path.join(os.tmpdir(), `vision-payload-${randomUUID()}.json`);
  await writeFile(payloadPath, JSON.stringify(payload), 'utf-8');

  try {
    const result = await execFileAsync(PYTHON_BIN, [PYTHON_SCRIPT, command, payloadPath], {
      env: PYTHON_ENV,
      maxBuffer: 50 * 1024 * 1024,
    });

    // Python stderr loglarını terminale yansıt
    if (result.stderr?.trim()) {
      for (const line of result.stderr.trim().split('\n')) {
        console.log(`[PY] ${line}`);
      }
    }

    const stdout = result.stdout.trim();
    if (!stdout) {
      throw new Error('Python vision command returned empty output');
    }
    return JSON.parse(stdout) as T;
  } catch (error) {
    const candidate = error as { code?: string; stdout?: string; stderr?: string; message?: string };
    if (candidate.code === 'ENOENT') {
      throw new Error(
        `Python runtime not found at ${PYTHON_BIN}. Run backend/vision_py/setup.sh or set VISION_PYTHON.`,
      );
    }

    // Hata durumunda da stderr'i logla
    if (candidate.stderr?.trim()) {
      for (const line of candidate.stderr.trim().split('\n')) {
        console.log(`[PY] ${line}`);
      }
    }

    const stdout = candidate.stdout?.trim();
    if (stdout) {
      try {
        const parsed = JSON.parse(stdout) as { error?: string };
        if (parsed.error) {
          throw new Error(parsed.error);
        }
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message) {
          throw parseError;
        }
      }
    }

    const stderr = candidate.stderr?.trim();
    throw new Error(stderr || candidate.message || 'Python vision command failed');
  } finally {
    await rm(payloadPath, { force: true });
  }
}

export async function getPythonVisionStatus(): Promise<VisionStatusResponse> {
  return runPythonCommand<VisionStatusResponse>('status', {});
}

export async function embedCatalogImages(imagePaths: string[], description = ''): Promise<{ featureVector: number[]; featureVectors: number[][] }> {
  const response = await runPythonCommand<{ featureVector: number[]; featureVectors: number[][] }>('embed', { imagePaths, description });
  return { featureVector: response.featureVector, featureVectors: response.featureVectors };
}

export async function recognizeWithPython(
  imagePath: string,
  catalog: CatalogProduct[],
): Promise<PythonRecognizeResponse> {
  // Python tanıma sadece yerel DINOv2 embedding (808-dim) ile eklenen ürünleri kullanabilir.
  // OpenAI text embedding (512-dim) ile eklenenler FAISS'te boyut uyuşmazlığı yaratır.
  const pythonCatalog = catalog.filter(
    (item) => !item.embeddingProvider || item.embeddingProvider === 'python',
  );

  if (pythonCatalog.length === 0) {
    throw new Error(
      'Katalogdaki tüm ürünler OpenAI embedding ile eklenmiş. ' +
      'Yerel AI tanıma için ürünleri "Yerel Embedding" seçeneği ile yeniden ekleyin, ya da Tanıma sekmesinde "OpenAI Vision" kullanın.',
    );
  }

  return runPythonCommand<PythonRecognizeResponse>('recognize', {
    imagePath,
    catalog: pythonCatalog.map((item) => ({
      id: item.id,
      productCode: item.productCode,
      productName: item.productName,
      color: item.color,
      description: item.description,
      featureVector: item.featureVector,
      featureVectors: item.featureVectors ?? [],
    })),
  });
}

export async function recognizeWithCalibration(
  imagePath: string,
  slots: Array<{ x: number; y: number; width: number; height: number }>,
  dots: Array<{ x: number; y: number }>,
  catalog: CatalogProduct[],
): Promise<PythonRecognizeResponse> {
  const pythonCatalog = catalog.filter(
    (item) => !item.embeddingProvider || item.embeddingProvider === 'python',
  );

  if (pythonCatalog.length === 0) {
    throw new Error(
      'Katalogdaki tüm ürünler OpenAI embedding ile eklenmiş. ' +
      'Yerel AI tanıma için ürünleri "Yerel Embedding" seçeneği ile yeniden ekleyin.',
    );
  }

  return runPythonCommand<PythonRecognizeResponse>('recognize_calibrated', {
    imagePath,
    slots,
    dots,
    catalog: pythonCatalog.map((item) => ({
      id: item.id,
      productCode: item.productCode,
      productName: item.productName,
      color: item.color,
      description: item.description,
      featureVector: item.featureVector,
      featureVectors: item.featureVectors ?? [],
    })),
  });
}

export function publicCatalogProduct(product: CatalogProduct): CatalogProductPublic {
  return {
    id: product.id,
    productCode: product.productCode,
    productName: product.productName,
    color: product.color,
    description: product.description,
    imageNames: product.imageNames,
    addedAt: product.addedAt,
  };
}

export function warmUpPythonVision(): void {
  getPythonVisionStatus().catch((error) => {
    console.error('[PYTHON_VISION] Warmup error:', error instanceof Error ? error.message : String(error));
  });
}
