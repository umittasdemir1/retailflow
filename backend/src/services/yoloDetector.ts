import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DETECTION_SCORE_THRESHOLD = 0.35;
const RAW_HEAD_SCORE_THRESHOLD = 0.2;
const NMS_IOU_THRESHOLD = 0.45;
const MAX_DETECTIONS = 64;
const YOLO_V7_ANCHORS = [
  [[12, 16], [19, 36], [40, 28]],
  [[36, 75], [76, 55], [72, 146]],
  [[142, 110], [192, 243], [459, 401]],
] as const;

export interface DetectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  classId: number;
}

interface PreparedTensor {
  tensor: Float32Array;
  scale: number;
  padX: number;
  padY: number;
}

interface DetectorRuntime {
  session: import('onnxruntime-node').InferenceSession;
  modelPath: string;
  inputSize: number;
  mode: 'single-output' | 'raw-multihead';
}

function getCandidateModelPaths(): string[] {
  const candidateNames = ['yolo-products.onnx', 'yolov8n.onnx'];
  const candidates: string[] = [];

  for (let levels = 2; levels <= 5; levels++) {
    const baseParts: string[] = [__dirname];
    for (let i = 0; i < levels; i++) baseParts.push('..');

    for (const fileName of candidateNames) {
      const candidate = path.join(...baseParts, 'models', fileName);
      if (fs.existsSync(candidate) && !candidates.includes(candidate)) candidates.push(candidate);
    }
  }

  for (const fileName of candidateNames) {
    const candidate = path.join(process.cwd(), 'models', fileName);
    if (fs.existsSync(candidate) && !candidates.includes(candidate)) candidates.push(candidate);
  }

  return candidates;
}

let runtimePromise: Promise<DetectorRuntime> | null = null;
let loadMs: number | null = null;
let selectedModelPath: string | null = null;

export function isDetectorAvailable(): boolean {
  return getCandidateModelPaths().length > 0;
}

export function getDetectorLoadMs(): number | null {
  return loadMs;
}

export function getDetectorModelName(): string {
  const modelPath = selectedModelPath ?? getCandidateModelPaths()[0] ?? null;
  if (!modelPath) return 'missing-yolo-model';
  return path.basename(modelPath, path.extname(modelPath));
}

export function warmUpDetector(): void {
  if (!isDetectorAvailable()) {
    console.warn('[YOLO] Model not found');
    return;
  }

  getRuntime().catch((error) => {
    console.error('[YOLO] Load error:', error instanceof Error ? error.message : String(error));
  });
}

function getInputSize(session: import('onnxruntime-node').InferenceSession): number {
  const inputMeta = session.inputMetadata[0] as { shape?: Array<number | string | null> } | undefined;
  const shape = inputMeta?.shape;
  const size = typeof shape?.[2] === 'number' ? shape[2] : null;
  if (!size || typeof shape?.[3] !== 'number' || shape[3] !== size) {
    throw new Error(`Unsupported YOLO input shape: ${JSON.stringify(shape)}`);
  }
  return size;
}

function resolveMode(session: import('onnxruntime-node').InferenceSession): DetectorRuntime['mode'] {
  if (session.outputNames.length === 1) return 'single-output';

  const multiHeadShapes = session.outputMetadata.map((meta) => {
    const candidate = meta as { shape?: Array<number | string | null> };
    return candidate.shape ?? [];
  });
  const isRawMultiHead =
    session.outputNames.length === 3 &&
    multiHeadShapes.every((shape) => shape.length === 5 && shape[1] === 3);

  if (isRawMultiHead) return 'raw-multihead';

  throw new Error(
    `Model ${path.basename(session.outputNames[0] ?? 'unknown')} unsupported output layout: ${JSON.stringify(multiHeadShapes)}`,
  );
}

async function getRuntime(): Promise<DetectorRuntime> {
  if (runtimePromise) return runtimePromise;

  runtimePromise = (async () => {
    const ort = await import('onnxruntime-node');
    const candidates = getCandidateModelPaths();
    if (candidates.length === 0) {
      throw new Error('YOLO detection modeli bulunamadı. backend/models altına yolo-products.onnx veya yolov8n.onnx ekleyin.');
    }

    const errors: string[] = [];

    for (const modelPath of candidates) {
      try {
        const t0 = Date.now();
        const session = await ort.InferenceSession.create(modelPath, {
          executionProviders: ['cpu'],
        });
        const runtime: DetectorRuntime = {
          session,
          modelPath,
          inputSize: getInputSize(session),
          mode: resolveMode(session),
        };
        selectedModelPath = modelPath;
        loadMs = Date.now() - t0;
        console.log(`[YOLO] model loaded in ${loadMs}ms from ${path.basename(modelPath)} (${runtime.mode})`);
        return runtime;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${path.basename(modelPath)}: ${message}`);
      }
    }

    throw new Error(`No usable YOLO detector model found. ${errors.join(' | ')}`);
  })();

  return runtimePromise;
}

async function prepareImage(imagePath: string, inputSize: number): Promise<PreparedTensor> {
  const metadata = await sharp(imagePath).metadata();
  const width = metadata.width ?? inputSize;
  const height = metadata.height ?? inputSize;

  const scale = Math.min(inputSize / width, inputSize / height);
  const resizedWidth = Math.max(1, Math.round(width * scale));
  const resizedHeight = Math.max(1, Math.round(height * scale));
  const padX = Math.floor((inputSize - resizedWidth) / 2);
  const padY = Math.floor((inputSize - resizedHeight) / 2);

  const { data } = await sharp(imagePath)
    .resize(resizedWidth, resizedHeight, { fit: 'fill' })
    .extend({
      top: padY,
      bottom: inputSize - resizedHeight - padY,
      left: padX,
      right: inputSize - resizedWidth - padX,
      background: { r: 114, g: 114, b: 114 },
    })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const tensor = new Float32Array(3 * inputSize * inputSize);
  const pixels = inputSize * inputSize;

  for (let i = 0; i < pixels; i++) {
    tensor[i] = data[i * 3] / 255;
    tensor[pixels + i] = data[i * 3 + 1] / 255;
    tensor[pixels * 2 + i] = data[i * 3 + 2] / 255;
  }

  return { tensor, scale, padX, padY };
}

function clampBox(
  left: number,
  top: number,
  width: number,
  height: number,
  imageWidth: number,
  imageHeight: number,
): DetectionBox | null {
  const x = Math.max(0, Math.round(left));
  const y = Math.max(0, Math.round(top));
  const w = Math.min(imageWidth - x, Math.round(width));
  const h = Math.min(imageHeight - y, Math.round(height));
  if (w < 24 || h < 24) return null;
  return { x, y, width: w, height: h, confidence: 0, classId: -1 };
}

function iou(left: DetectionBox, right: DetectionBox): number {
  const x1 = Math.max(left.x, right.x);
  const y1 = Math.max(left.y, right.y);
  const x2 = Math.min(left.x + left.width, right.x + right.width);
  const y2 = Math.min(left.y + left.height, right.y + right.height);

  const interW = Math.max(0, x2 - x1);
  const interH = Math.max(0, y2 - y1);
  const intersection = interW * interH;
  if (intersection <= 0) return 0;

  const union = left.width * left.height + right.width * right.height - intersection;
  return union > 0 ? intersection / union : 0;
}

function nonMaxSuppression(candidates: DetectionBox[]): DetectionBox[] {
  const sorted = [...candidates].sort((left, right) => right.confidence - left.confidence);
  const selected: DetectionBox[] = [];

  for (const candidate of sorted) {
    if (selected.length >= MAX_DETECTIONS) break;
    const overlaps = selected.some((current) => iou(candidate, current) >= NMS_IOU_THRESHOLD);
    if (!overlaps) selected.push(candidate);
  }

  return selected;
}

function decodeSingleOutput(
  output: Float32Array,
  dims: readonly number[],
  imageWidth: number,
  imageHeight: number,
  scale: number,
  padX: number,
  padY: number,
): DetectionBox[] {
  if (dims.length !== 3) {
    throw new Error(`Unexpected YOLO output shape: ${dims.join('x')}`);
  }

  const [, dim1, dim2] = dims;
  let features = dim1;
  let boxes = dim2;
  let featureMajor = true;

  if (dim1 > dim2) {
    features = dim2;
    boxes = dim1;
    featureMajor = false;
  }

  const candidates: DetectionBox[] = [];

  for (let boxIndex = 0; boxIndex < boxes; boxIndex++) {
    const read = (featureIndex: number): number => {
      if (featureMajor) return output[featureIndex * boxes + boxIndex];
      return output[boxIndex * features + featureIndex];
    };

    const cx = read(0);
    const cy = read(1);
    const width = read(2);
    const height = read(3);

    let bestClassId = -1;
    let bestScore = 0;

    for (let featureIndex = 4; featureIndex < features; featureIndex++) {
      const score = read(featureIndex);
      if (score > bestScore) {
        bestScore = score;
        bestClassId = featureIndex - 4;
      }
    }

    if (bestScore < DETECTION_SCORE_THRESHOLD) continue;

    const box = clampBox(
      (cx - width / 2 - padX) / scale,
      (cy - height / 2 - padY) / scale,
      width / scale,
      height / scale,
      imageWidth,
      imageHeight,
    );

    if (!box) continue;
    box.confidence = bestScore;
    box.classId = bestClassId;
    candidates.push(box);
  }

  return nonMaxSuppression(candidates);
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function decodeRawMultiHead(
  outputs: Record<string, import('onnxruntime-common').OnnxValue>,
  outputNames: readonly string[],
  inputSize: number,
  imageWidth: number,
  imageHeight: number,
  scale: number,
  padX: number,
  padY: number,
): DetectionBox[] {
  const candidates: DetectionBox[] = [];

  outputNames.forEach((name, headIndex) => {
    const output = outputs[name] as import('onnxruntime-node').Tensor;
    const [batch, anchors, rows, cols, features] = output.dims;
    if (batch !== 1 || anchors !== 3 || features < 6) return;

    const values = output.data as Float32Array;
    const stride = inputSize / cols;

    for (let anchorIndex = 0; anchorIndex < anchors; anchorIndex++) {
      const [anchorW, anchorH] = YOLO_V7_ANCHORS[headIndex][anchorIndex];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const base = ((((anchorIndex * rows) + row) * cols) + col) * features;
          const objectness = sigmoid(values[base + 4]);
          if (objectness < RAW_HEAD_SCORE_THRESHOLD) continue;

          let bestClassId = -1;
          let bestClassScore = 0;
          for (let featureIndex = 5; featureIndex < features; featureIndex++) {
            const classScore = sigmoid(values[base + featureIndex]);
            if (classScore > bestClassScore) {
              bestClassScore = classScore;
              bestClassId = featureIndex - 5;
            }
          }

          const score = objectness * bestClassScore;
          if (score < RAW_HEAD_SCORE_THRESHOLD) continue;

          const sx = sigmoid(values[base]);
          const sy = sigmoid(values[base + 1]);
          const sw = sigmoid(values[base + 2]);
          const sh = sigmoid(values[base + 3]);

          const cx = ((sx * 2 - 0.5) + col) * stride;
          const cy = ((sy * 2 - 0.5) + row) * stride;
          const width = ((sw * 2) ** 2) * anchorW;
          const height = ((sh * 2) ** 2) * anchorH;

          const box = clampBox(
            (cx - width / 2 - padX) / scale,
            (cy - height / 2 - padY) / scale,
            width / scale,
            height / scale,
            imageWidth,
            imageHeight,
          );

          if (!box) continue;
          box.confidence = score;
          box.classId = bestClassId;
          candidates.push(box);
        }
      }
    }
  });

  return nonMaxSuppression(candidates);
}

export async function detectProducts(
  imagePath: string,
  imageWidth: number,
  imageHeight: number,
): Promise<DetectionBox[]> {
  const ort = await import('onnxruntime-node');
  const runtime = await getRuntime();
  const { tensor, scale, padX, padY } = await prepareImage(imagePath, runtime.inputSize);
  const inputTensor = new ort.Tensor('float32', tensor, [1, 3, runtime.inputSize, runtime.inputSize]);
  const feeds = { [runtime.session.inputNames[0]]: inputTensor };
  const outputs = await runtime.session.run(feeds);

  if (runtime.mode === 'raw-multihead') {
    return decodeRawMultiHead(
      outputs,
      runtime.session.outputNames,
      runtime.inputSize,
      imageWidth,
      imageHeight,
      scale,
      padX,
      padY,
    );
  }

  const outputName = runtime.session.outputNames[0];
  const outputTensor = outputs[outputName];
  if (!outputTensor) {
    throw new Error('YOLO output tensor is missing');
  }

  return decodeSingleOutput(
    (outputTensor as import('onnxruntime-node').Tensor).data as Float32Array,
    (outputTensor as import('onnxruntime-node').Tensor).dims,
    imageWidth,
    imageHeight,
    scale,
    padX,
    padY,
  );
}
