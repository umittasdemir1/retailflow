/**
 * CLIP ViT-B/32 visual encoder wrapper.
 *
 * Model: Xenova/clip-vit-base-patch32 (visual encoder only, ~336 MB ONNX)
 * Input : Float32[1, 3, 224, 224] — CHW, normalized with CLIP mean/std
 * Output: Float32[1, 512]         — L2-normalized image embedding
 *
 * Two L2-normalized vectors a,b:  cosine_similarity = dot(a, b)
 * For matching printed textile patterns, CLIP gives ~0.92+ for same product,
 * ~0.75–0.85 for similar-category different products.
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Works in both dev (src/services/) and prod (dist/src/services/)
// We look for 'models/' relative to the package root (backend/).
// Go up until we find a directory that contains 'models/'.
function resolveModelPath(): string {
  // Try up to 4 levels from __dirname
  for (let levels = 2; levels <= 5; levels++) {
    const parts: string[] = [__dirname];
    for (let i = 0; i < levels; i++) parts.push('..');
    parts.push('models', 'clip-vision.onnx');
    const candidate = path.join(...parts);
    if (fs.existsSync(candidate)) return candidate;
  }
  // Fallback: relative to cwd (used when started from backend/ dir)
  return path.join(process.cwd(), 'models', 'clip-vision.onnx');
}

const MODEL_PATH = resolveModelPath();

const CLIP_SIZE = 224;
const CLIP_MEAN = [0.48145466, 0.4578275,  0.40821073];
const CLIP_STD  = [0.26862954, 0.26130258, 0.27577711];

// Singleton session
let sessionPromise: Promise<import('onnxruntime-node').InferenceSession> | null = null;
let loadMs: number | null = null;

function getSession(): Promise<import('onnxruntime-node').InferenceSession> {
  if (sessionPromise) return sessionPromise;
  sessionPromise = (async () => {
    const ort = await import('onnxruntime-node');
    const t0 = Date.now();
    const session = await ort.InferenceSession.create(MODEL_PATH, {
      executionProviders: ['cpu'],
    });
    loadMs = Date.now() - t0;
    console.log(`[CLIP] model loaded in ${loadMs}ms`);
    return session;
  })();
  return sessionPromise;
}

export function isModelAvailable(): boolean {
  return fs.existsSync(MODEL_PATH);
}

export function getLoadMs(): number | null {
  return loadMs;
}

/** Start loading the model in the background on server start */
export function warmUp(): void {
  if (!isModelAvailable()) {
    console.warn('[CLIP] Model not found at', MODEL_PATH);
    return;
  }
  getSession().catch((e) => console.error('[CLIP] Load error:', e.message));
}

/** Preprocess: resize → float32 CHW → CLIP normalize */
async function preprocess(
  imagePath: string,
  crop?: { left: number; top: number; width: number; height: number },
): Promise<Float32Array> {
  let pipeline = sharp(imagePath);
  if (crop) {
    pipeline = pipeline.extract({
      left:   Math.max(0, Math.round(crop.left)),
      top:    Math.max(0, Math.round(crop.top)),
      width:  Math.max(8, Math.round(crop.width)),
      height: Math.max(8, Math.round(crop.height)),
    });
  }

  const { data } = await pipeline
    .resize(CLIP_SIZE, CLIP_SIZE, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const tensor = new Float32Array(3 * CLIP_SIZE * CLIP_SIZE);
  const npx    = CLIP_SIZE * CLIP_SIZE;

  for (let i = 0; i < npx; i++) {
    tensor[i]           = (data[i * 3]     / 255 - CLIP_MEAN[0]) / CLIP_STD[0];
    tensor[npx + i]     = (data[i * 3 + 1] / 255 - CLIP_MEAN[1]) / CLIP_STD[1];
    tensor[npx * 2 + i] = (data[i * 3 + 2] / 255 - CLIP_MEAN[2]) / CLIP_STD[2];
  }
  return tensor;
}

/**
 * Extract a 512-dim L2-normalized CLIP embedding from an image (or crop).
 * Returns a plain number[] for JSON serialisation.
 */
export async function embed(
  imagePath: string,
  crop?: { left: number; top: number; width: number; height: number },
): Promise<number[]> {
  const ort     = await import('onnxruntime-node');
  const session = await getSession();
  const tensor  = await preprocess(imagePath, crop);

  const input  = new ort.Tensor('float32', tensor, [1, 3, CLIP_SIZE, CLIP_SIZE]);
  const feeds  = { [session.inputNames[0]]: input };
  const output = await session.run(feeds);

  // The visual encoder output is the last output (pooled / projected)
  const raw = output[session.outputNames[session.outputNames.length - 1]].data as Float32Array;

  // L2 normalize
  let norm = 0;
  for (const v of raw) norm += v * v;
  norm = Math.sqrt(norm);
  return Array.from(raw).map((v) => v / norm);
}

/** Cosine similarity — for L2-normalized vectors this is just dot product */
export function similarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
