import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { appConfig } from '../config.js';

const require = createRequire(import.meta.url);
function getSharp(): typeof import('sharp') {
  return require('sharp') as typeof import('sharp');
}
import type { CatalogProduct } from '../store/catalogStore.js';
import type { PythonRecognizeResponse } from './pythonVision.js';


interface OpenAIMatchBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

interface OpenAIMatch {
  catalogIndex: number;
  found: boolean;
  boxes: OpenAIMatchBox[];
}

interface OpenAIRecognitionPayload {
  matches: OpenAIMatch[];
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function iou(a: OpenAIMatchBox, b: OpenAIMatchBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (intersection <= 0) return 0;
  const union = a.width * a.height + b.width * b.height - intersection;
  return union > 0 ? intersection / union : 0;
}

function dedupeBoxes(boxes: OpenAIMatchBox[]): OpenAIMatchBox[] {
  const ordered = [...boxes].sort((a, b) => b.confidence - a.confidence);
  const selected: OpenAIMatchBox[] = [];
  for (const box of ordered) {
    if (selected.some((existing) => iou(existing, box) >= 0.55)) continue;
    selected.push(box);
  }
  return selected;
}

async function encodeImageAsDataUrl(filePath: string, maxDimension: number): Promise<{ dataUrl: string; width: number; height: number }> {
  let pipeline = getSharp()(filePath, { limitInputPixels: false }).rotate();
  if (maxDimension > 0) {
    pipeline = pipeline.resize({
      width: maxDimension,
      height: maxDimension,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  const { data, info } = await pipeline
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  return {
    dataUrl: `data:image/jpeg;base64,${data.toString('base64')}`,
    width: info.width,
    height: info.height,
  };
}

function buildSchema(catalogLength: number): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['matches'],
    properties: {
      matches: {
        type: 'array',
        maxItems: catalogLength,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['catalogIndex', 'found', 'boxes'],
          properties: {
            catalogIndex: {
              type: 'integer',
              enum: Array.from({ length: catalogLength }, (_, index) => index + 1),
            },
            found: { type: 'boolean' },
            boxes: {
              type: 'array',
              maxItems: 3,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['x', 'y', 'width', 'height', 'confidence'],
                properties: {
                  x: { type: 'integer' },
                  y: { type: 'integer' },
                  width: { type: 'integer' },
                  height: { type: 'integer' },
                  confidence: { type: 'integer', minimum: 0, maximum: 100 },
                },
              },
            },
          },
        },
      },
    },
  };
}

function buildInstructions(width: number, height: number, catalog: CatalogProduct[]): string {
  const lines = catalog.map((item, index) => {
    const color = item.color?.trim() || 'unspecified';
    const desc = item.description?.trim();
    return `- Item ${index + 1}: code=${item.productCode}; name="${item.productName}"; dominant color="${color}"${desc ? `; notes="${desc}"` : ''}`;
  });

  return [
    'You are a retail shelf analyst. Your task: find which catalog products appear in a shelf photo.',
    '',
    `Shelf image: width=${width}px, height=${height}px. The FIRST image sent is the shelf photo.`,
    'After the shelf image, reference photos follow — grouped by catalog item number.',
    '',
    'RULES:',
    '1. Dominant background/fabric color MUST match. A blue garment cannot match a red one.',
    '2. Pattern type MUST match (stripes, animals, geometric, plain, etc.).',
    '3. Products may appear folded or stacked — match the visible portion of the print.',
    '4. If confidence < 45%, set found=false.',
    '5. Bounding boxes must be pixel-tight around the garment, not the whole shelf section.',
    '6. Return at most 3 boxes per item (the clearest visible instances).',
    '7. Return JSON only, exactly matching the schema.',
    '',
    'CATALOG:',
    ...lines,
  ].join('\n');
}

function extractOutputText(responseJson: Record<string, unknown>): string {
  const output = Array.isArray(responseJson.output) ? responseJson.output : [];
  const parts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = Array.isArray((item).content) ? (item).content : [];
    for (const part of content) {
      if (!part || typeof part !== 'object') continue;
      if ((part).type === 'output_text' && typeof (part).text === 'string') {
        parts.push((part).text);
      }
    }
  }
  return parts.join('').trim();
}

export async function recognizeWithOpenAI(
  imagePath: string,
  catalog: CatalogProduct[],
): Promise<PythonRecognizeResponse> {
  if (!appConfig.openAIApiKey) {
    throw new Error('OPENAI_API_KEY tanımlı değil. backend/.env içine ekleyin.');
  }
  if (catalog.length === 0) {
    throw new Error('OpenAI vision için katalog boş olamaz.');
  }
  if (catalog.length > appConfig.openAIVisionMaxCatalogItems) {
    throw new Error(
      `Katalog sınırı aşıldı (${catalog.length} > ${appConfig.openAIVisionMaxCatalogItems}). OPENAI_VISION_MAX_CATALOG_ITEMS değerini .env içinde artırın.`,
    );
  }

  const started = Date.now();
  const shelfImage = await encodeImageAsDataUrl(imagePath, appConfig.openAIVisionShelfMaxDimension);

  const content = [
    {
      type: 'input_text',
      text: buildInstructions(shelfImage.width, shelfImage.height, catalog),
    },
    {
      type: 'input_image',
      image_url: shelfImage.dataUrl,
      detail: appConfig.openAIVisionDetail,
    },
  ];

  for (const [index, item] of catalog.entries()) {
    content.push({
      type: 'input_text',
      text: `Catalog item ${index + 1}: code=${item.productCode}; name=${item.productName}; color=${item.color || 'unspecified'}; description=${item.description || 'none'}`,
    });

    const referenceNames = item.imageNames.slice(0, appConfig.openAIVisionReferenceImagesPerProduct);
    for (const imageName of referenceNames) {
      const referencePath = path.join(process.cwd(), 'catalog', imageName);
      const referenceImage = await encodeImageAsDataUrl(referencePath, appConfig.openAIVisionReferenceMaxDimension);
      content.push({
        type: 'input_image',
        image_url: referenceImage.dataUrl,
        detail: 'high',
      });
    }
  }

  // Sadece o-serisi modeller (o1, o3, o4-mini vb.) reasoning parametresi destekler
  const isReasoningModel = /^o\d/i.test(appConfig.openAIVisionModel);

  const requestBody: Record<string, unknown> = {
    model: appConfig.openAIVisionModel,
    store: false,
    input: [{ role: 'user', content }],
    max_output_tokens: appConfig.openAIVisionMaxOutputTokens,
    text: {
      format: {
        type: 'json_schema',
        name: 'retail_shelf_matches',
        strict: true,
        schema: buildSchema(catalog.length),
      },
    },
  };

  if (isReasoningModel && appConfig.openAIVisionReasoningEffort) {
    requestBody.reasoning = { effort: appConfig.openAIVisionReasoningEffort };
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${appConfig.openAIApiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  const rawText = await response.text();
  let responseJson: Record<string, unknown>;
  try {
    responseJson = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    throw new Error('OpenAI vision yanıtı JSON olarak çözülemedi.');
  }

  if (!response.ok) {
    const apiError = responseJson.error as { message?: string } | undefined;
    const message = apiError?.message || 'OpenAI vision isteği başarısız oldu.';
    throw new Error(message);
  }

  // Yanıt durumunu kontrol et
  const responseStatus = responseJson.status as string | undefined;
  if (responseStatus && responseStatus !== 'completed') {
    console.error(`[OPENAI] Yanıt durumu: ${responseStatus}`, JSON.stringify(responseJson).slice(0, 500));
    throw new Error(`OpenAI vision tamamlanamadı (status: ${responseStatus}). Token limiti artırılabilir.`);
  }

  let outputText = extractOutputText(responseJson);

  // Fallback: chat completions formatı (choices[].message.content)
  if (!outputText) {
    const choices = Array.isArray(responseJson.choices) ? responseJson.choices : [];
    for (const choice of choices) {
      const content = (choice as Record<string, unknown>)?.message as Record<string, unknown> | undefined;
      if (typeof content?.content === 'string') {
        outputText = content.content.trim();
        break;
      }
    }
  }

  if (!outputText) {
    // Debug için yanıt yapısını logla (içerik olmadan)
    const debugKeys = JSON.stringify(Object.keys(responseJson));
    const outputArr = Array.isArray(responseJson.output) ? responseJson.output : [];
    console.error(`[OPENAI] Boş yanıt — üst anahtarlar: ${debugKeys}, output uzunluğu: ${outputArr.length}`);
    if (outputArr.length > 0) {
      console.error(`[OPENAI] İlk output item türü:`, JSON.stringify(outputArr[0]).slice(0, 300));
    }
    throw new Error('OpenAI vision boş yanıt döndürdü. Model adını ve token limitini kontrol edin.');
  }

  let parsed: OpenAIRecognitionPayload;
  try {
    parsed = JSON.parse(outputText) as OpenAIRecognitionPayload;
  } catch {
    throw new Error('OpenAI vision yapılandırılmış JSON üretmedi.');
  }

  const matchMap = new Map<number, OpenAIMatch>();
  for (const match of parsed.matches ?? []) {
    if (!Number.isInteger(match.catalogIndex)) continue;
    if (match.catalogIndex < 1 || match.catalogIndex > catalog.length) continue;
    const current = matchMap.get(match.catalogIndex) ?? {
      catalogIndex: match.catalogIndex,
      found: false,
      boxes: [],
    };
    current.found = current.found || match.found;
    current.boxes.push(...(match.boxes ?? []));
    matchMap.set(match.catalogIndex, current);
  }

  // Performance log: tüm ürünlerin sonuçlarını göster
  console.log('[OPENAI] ── Tanıma özeti ──────────────────────────────');
  for (let i = 0; i < catalog.length; i++) {
    const item = catalog[i];
    const match = matchMap.get(i + 1);
    if (!match) {
      console.log(`[OPENAI]  ${i + 1}. ${item.productCode} "${item.productName}" → MODEL SONUÇ DÖNDÜRMEDI`);
    } else if (!match.found) {
      const maxConf = match.boxes.length > 0 ? Math.max(...match.boxes.map((b) => b.confidence)) : 0;
      console.log(`[OPENAI]  ${i + 1}. ${item.productCode} "${item.productName}" → BULUNAMADI (en yüksek güven: ${maxConf}%)`);
    } else {
      const confs = match.boxes.map((b) => b.confidence).join(', ');
      console.log(`[OPENAI]  ${i + 1}. ${item.productCode} "${item.productName}" → BULUNDU (güven: ${confs}%)`);
    }
  }
  console.log('[OPENAI] ─────────────────────────────────────────────');

  const detections: PythonRecognizeResponse['detections'] = [];
  for (const [catalogIndex, match] of matchMap.entries()) {
    if (!match.found) continue;
    const item = catalog[catalogIndex - 1];
    const boxes = dedupeBoxes(match.boxes).slice(0, 3);
    for (const box of boxes) {
      const x = clampInt(box.x, 0, Math.max(0, shelfImage.width - 1));
      const y = clampInt(box.y, 0, Math.max(0, shelfImage.height - 1));
      const width = clampInt(box.width, 1, Math.max(1, shelfImage.width - x));
      const height = clampInt(box.height, 1, Math.max(1, shelfImage.height - y));
      const confidence = clampInt(box.confidence, 0, 100);
      detections.push({
        catalogProductId: item.id,
        productCode: item.productCode,
        productName: item.productName,
        color: item.color,
        description: item.description,
        confidence,
        boundingBox: { x, y, width, height },
        detectorConfidence: confidence / 100,
        detectorClass: 'openai-vision',
        margin: confidence / 100,
        topMatches: [{
          catalogProductId: item.id,
          productCode: item.productCode,
          productName: item.productName,
          score: confidence / 100,
        }],
      });
    }
  }

  return {
    imageWidth: shelfImage.width,
    imageHeight: shelfImage.height,
    processingTimeMs: Date.now() - started,
    scannedRegions: detections.length,
    modelVersion: `openai:${appConfig.openAIVisionModel}:${appConfig.openAIVisionDetail}`,
    detections,
  };
}

// ─── Calibrated Recognition ──────────────────────────────────────────────────

interface CalibratedSlot {
  x: number; y: number; width: number; height: number;
}
interface CalibratedDot {
  x: number; y: number;
}
// ─── Kalibrasyonlu tanıma ─────────────────────────────────────────────────────

interface OpenAISlotResult {
  slotIndex: number;
  catalogIndex: number;
  found: boolean;
  confidence: number;
}
interface OpenAISlotPayload {
  slots: OpenAISlotResult[];
}

function buildCalibratedSchema(slotCount: number, catalogLength: number): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['slots'],
    properties: {
      slots: {
        type: 'array',
        minItems: slotCount,
        maxItems: slotCount,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['slotIndex', 'catalogIndex', 'found', 'confidence'],
          properties: {
            slotIndex:    { type: 'integer', minimum: 1, maximum: slotCount },
            catalogIndex: { type: 'integer', minimum: 0, maximum: catalogLength },
            found:        { type: 'boolean' },
            confidence:   { type: 'integer', minimum: 0, maximum: 100 },
          },
        },
      },
    },
  };
}

function buildCalibratedInstructions(
  slots: CalibratedSlot[],
  catalog: CatalogProduct[],
): string {
  const extraProducts = catalog.length - slots.length;
  const mismatchNote = extraProducts > 0
    ? `\nIMPORTANT: The catalog has ${catalog.length} products but only ${slots.length} slots are on this shelf. ` +
      `At least ${extraProducts} catalog product(s) are NOT displayed here. DO NOT force-match uncertain items.`
    : '';

  const catalogLines = catalog.map((item, i) => {
    const desc = item.description?.trim();
    return `  [${i + 1}] ${item.productCode} | "${item.productName}" | color: ${item.color || '?'}${desc ? ` | visual: ${desc}` : ''}`;
  });

  return [
    'You are a retail shelf vision system. The image shows a shelf with numbered yellow-bordered rectangles.',
    'After the shelf image, reference product photos follow in the same order as the catalog list below.',
    mismatchNote,
    '',
    `CATALOG (${catalog.length} products, reference images follow in order):`,
    ...catalogLines,
    '',
    'TASK: For each numbered slot (1–' + slots.length + '), identify which catalog product is inside it.',
    '',
    'RULES — read carefully:',
    '1. Compare the garment INSIDE the yellow rectangle against the catalog reference photos.',
    '2. Match by dominant color + pattern type + key visual elements (shapes, motifs, printed text).',
    '3. Each catalog product can appear in AT MOST ONE slot.',
    '4. Many catalog products will NOT be on this shelf — do not force-match.',
    '5. If the slot is empty or you cannot clearly identify the product → found=false, catalogIndex=0.',
    '6. If two catalog items look similar and you are not sure which one → found=false, catalogIndex=0.',
    '7. Minimum confidence to report found=true: 70.',
    '8. Return exactly ' + slots.length + ' results, one per slot.',
  ].filter(Boolean).join('\n');
}


async function drawAnnotatedSlots(
  imagePath: string,
  slots: CalibratedSlot[],
  maxDimension: number,
): Promise<{ dataUrl: string; width: number; height: number; scaleX: number; scaleY: number }> {
  // Önce görseli yükle ve boyutlarını al
  const meta = await getSharp()(imagePath, { limitInputPixels: false }).rotate().metadata();
  const origW = meta.width ?? 1;
  const origH = meta.height ?? 1;

  // Hedef boyut
  let targetW = origW;
  let targetH = origH;
  if (maxDimension > 0 && (origW > maxDimension || origH > maxDimension)) {
    const scale = maxDimension / Math.max(origW, origH);
    targetW = Math.round(origW * scale);
    targetH = Math.round(origH * scale);
  }
  const scaleX = targetW / origW;
  const scaleY = targetH / origH;

  // Slotları hedef boyuta ölçekle
  const scaledSlots = slots.map((s) => ({
    x: Math.round(s.x * scaleX),
    y: Math.round(s.y * scaleY),
    width:  Math.round(s.width  * scaleX),
    height: Math.round(s.height * scaleY),
  }));

  // SVG overlay: her slot için sarı dikdörtgen + numara
  const fontSize = Math.max(14, Math.round(Math.min(targetW, targetH) * 0.025));
  const badgeSize = Math.round(fontSize * 1.5);
  const svgRects = scaledSlots.map((s, i) => `
    <rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}"
      fill="rgba(255,220,0,0.12)" stroke="#FFD700" stroke-width="3" rx="3"/>
    <rect x="${s.x}" y="${s.y}" width="${badgeSize}" height="${badgeSize}"
      fill="#FFD700" rx="3"/>
    <text x="${s.x + badgeSize / 2}" y="${s.y + badgeSize * 0.72}"
      font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="bold"
      text-anchor="middle" fill="#000">${i + 1}</text>
  `).join('');

  const svgOverlay = Buffer.from(
    `<svg width="${targetW}" height="${targetH}" xmlns="http://www.w3.org/2000/svg">${svgRects}</svg>`,
  );

  const pipeline = getSharp()(imagePath, { limitInputPixels: false }).rotate();
  if (maxDimension > 0) {
    pipeline.resize({ width: targetW, height: targetH, fit: 'fill' });
  }

  const { data, info } = await pipeline
    .composite([{ input: svgOverlay, blend: 'over' }])
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  return {
    dataUrl: `data:image/jpeg;base64,${data.toString('base64')}`,
    width: info.width,
    height: info.height,
    scaleX,
    scaleY,
  };
}


export async function recognizeWithOpenAICalibrated(
  imagePath: string,
  slots: CalibratedSlot[],
  dots: CalibratedDot[],
  catalog: CatalogProduct[],
): Promise<PythonRecognizeResponse> {
  if (!appConfig.openAIApiKey) {
    throw new Error('OPENAI_API_KEY tanımlı değil. backend/.env içine ekleyin.');
  }
  if (slots.length === 0) throw new Error('Kalibrasyon slotu bulunamadı.');
  if (catalog.length === 0) throw new Error('Katalog boş.');

  const started = Date.now();
  console.log(`[OPENAI-CAL] Başlatılıyor — ${slots.length} slot, ${catalog.length} katalog ürünü`);

  // 1. Anotasyonlu raf görseli hazırla
  const annotated = await drawAnnotatedSlots(imagePath, slots, appConfig.openAIVisionShelfMaxDimension);

  // 2. İstek içeriği: talimat + raf görseli + referans görseller
  const content: Record<string, unknown>[] = [
    { type: 'input_text', text: buildCalibratedInstructions(slots, catalog) },
    { type: 'input_image', image_url: annotated.dataUrl, detail: appConfig.openAIVisionDetail },
  ];

  for (const [index, item] of catalog.entries()) {
    content.push({
      type: 'input_text',
      text: `[${index + 1}] ${item.productCode} | ${item.productName} | ${item.color || '?'}${item.description ? ` | ${item.description}` : ''}`,
    });
    const refNames = item.imageNames.slice(0, appConfig.openAIVisionReferenceImagesPerProduct);
    for (const name of refNames) {
      const refPath = path.join(process.cwd(), 'catalog', name);
      const encoded = await encodeImageAsDataUrl(refPath, appConfig.openAIVisionReferenceMaxDimension);
      content.push({ type: 'input_image', image_url: encoded.dataUrl, detail: 'high' });
    }
  }

  // 3. OpenAI isteği
  const isReasoningModel = /^o\d/i.test(appConfig.openAIVisionModel);
  const requestBody: Record<string, unknown> = {
    model: appConfig.openAIVisionModel,
    store: false,
    input: [{ role: 'user', content }],
    max_output_tokens: appConfig.openAIVisionMaxOutputTokens,
    text: {
      format: {
        type: 'json_schema',
        name: 'calibrated_shelf_slots',
        strict: true,
        schema: buildCalibratedSchema(slots.length, catalog.length),
      },
    },
  };
  if (isReasoningModel && appConfig.openAIVisionReasoningEffort) {
    requestBody.reasoning = { effort: appConfig.openAIVisionReasoningEffort };
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${appConfig.openAIApiKey}` },
    body: JSON.stringify(requestBody),
  });

  const rawText = await response.text();
  let responseJson: Record<string, unknown>;
  try { responseJson = JSON.parse(rawText) as Record<string, unknown>; }
  catch { throw new Error('OpenAI yanıtı parse edilemedi.'); }

  if (!response.ok) {
    const msg = (responseJson.error as { message?: string } | undefined)?.message;
    throw new Error(msg || 'OpenAI isteği başarısız.');
  }
  const status = responseJson.status as string | undefined;
  if (status && status !== 'completed') throw new Error(`OpenAI tamamlanamadı (${status}).`);

  const outputText = extractOutputText(responseJson);
  if (!outputText) throw new Error('OpenAI boş yanıt döndürdü.');

  let parsed: OpenAISlotPayload;
  try { parsed = JSON.parse(outputText) as OpenAISlotPayload; }
  catch { throw new Error('OpenAI JSON üretemedi.'); }

  // 4. Logla
  console.log('[OPENAI-CAL] ── Tanıma sonuçları ──────────────────────────────');
  for (const s of parsed.slots ?? []) {
    const item = s.found && s.catalogIndex > 0 ? catalog[s.catalogIndex - 1] : null;
    const label = item ? `${item.productCode} "${item.productName}" (%${s.confidence})` : 'BULUNAMADI';
    console.log(`[OPENAI-CAL]  Slot ${s.slotIndex}: ${label}`);
  }
  console.log('[OPENAI-CAL] ────────────────────────────────────────────────');

  // 5. Detection formatına dönüştür
  const detections: PythonRecognizeResponse['detections'] = [];
  for (const s of parsed.slots ?? []) {
    if (!s.found || s.catalogIndex < 1) continue;
    const item = catalog[s.catalogIndex - 1];
    if (!item) continue;
    const slotIdx = s.slotIndex - 1;
    const slot = slots[slotIdx];
    if (!slot) continue;
    const dot = dots[slotIdx];
    const dotPosition = dot
      ? { x: Math.round(dot.x), y: Math.round(dot.y) }
      : { x: Math.round(slot.x + slot.width / 2), y: Math.round(slot.y + slot.height / 2) };

    detections.push({
      catalogProductId:   item.id,
      productCode:        item.productCode,
      productName:        item.productName,
      color:              item.color,
      description:        item.description,
      confidence:         clampInt(s.confidence, 0, 100),
      boundingBox:        { x: slot.x, y: slot.y, width: slot.width, height: slot.height },
      dotPosition,
      detectorConfidence: s.confidence / 100,
      detectorClass:      'openai-calibrated',
      margin:             s.confidence / 100,
      topMatches: [{ catalogProductId: item.id, productCode: item.productCode, productName: item.productName, score: s.confidence / 100 }],
    });
  }

  return {
    imageWidth:       annotated.width,
    imageHeight:      annotated.height,
    processingTimeMs: Date.now() - started,
    scannedRegions:   slots.length,
    modelVersion:     `openai-calibrated:${appConfig.openAIVisionModel}`,
    detections,
  };
}

/**
 * Referans görsellerden ürünün ayırt edici görsel özelliklerini çıkarır.
 * Kalibrasyon tanımasında OpenAI'nın görselde "ne arayacağını" belirler.
 * Oluşturulan açıklama catalog.json'a kaydedilir ve buildCalibratedInstructions'da kullanılır.
 */
export async function generateVisualDescription(imagePaths: string[]): Promise<string> {
  if (!appConfig.openAIApiKey) return '';
  if (imagePaths.length === 0) return '';

  const refImages = imagePaths.slice(0, 3); // İlk 3 görsel yeterli
  const content: Record<string, unknown>[] = [
    {
      type: 'input_text',
      text: [
        'You are a retail product analyst. Examine these reference images of a single garment product.',
        '',
        'Write a CONCISE visual description (max 3 sentences) focused on what makes this product',
        'visually DISTINCTIVE and DISTINGUISHABLE from other similar garments on a store shelf.',
        '',
        'Focus strictly on:',
        '1. Background/base color (dominant fabric color)',
        '2. Pattern type (e.g. island maps, postal stamps, flamingos, stripes, animals, geometric)',
        '3. Key distinguishing visual elements (specific colors of patterns, text/words printed on it,',
        '   unique shapes, silhouettes)',
        '',
        'Format: Plain text, no bullet points. Be specific and visual, not generic.',
        'Example: "White background with red-outlined island map shapes, turquoise sea wave lines,',
        'small sailboats, and printed text BLUEMINT ISLAND / SEA / ALOHA."',
        '',
        'Do NOT mention: brand, price, fabric composition, care instructions, size.',
      ].join('\n'),
    },
  ];

  for (const imgPath of refImages) {
    try {
      const encoded = await encodeImageAsDataUrl(imgPath, 512);
      content.push({ type: 'input_image', image_url: encoded.dataUrl, detail: 'high' });
    } catch { /* görsel okunamazsa atla */ }
  }

  const isReasoningModel = /^o\d/i.test(appConfig.openAIVisionModel);
  const requestBody: Record<string, unknown> = {
    model: appConfig.openAIVisionModel,
    store: false,
    input: [{ role: 'user', content }],
    max_output_tokens: 200,
  };
  if (isReasoningModel && appConfig.openAIVisionReasoningEffort) {
    requestBody.reasoning = { effort: appConfig.openAIVisionReasoningEffort };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${appConfig.openAIApiKey}` },
      body: JSON.stringify(requestBody),
    });
    const json = (await response.json()) as Record<string, unknown>;
    const text = extractOutputText(json).trim();
    if (text) console.log(`[OPENAI] Görsel açıklama üretildi: "${text.slice(0, 80)}..."`);
    return text;
  } catch (err) {
    console.error('[OPENAI] Görsel açıklama üretme hatası:', err);
    return '';
  }
}

/**
 * OpenAI Vision ile görseli analiz edip (betimleyip) sonra metin embedding'ine çevirerek
 * katalog ürünü için özellik vektörü üretir.
 */
export async function embedCatalogImagesWithOpenAI(
  imagePaths: string[],
): Promise<{ featureVector: number[]; featureVectors: number[][] }> {
  if (!appConfig.openAIApiKey) {
    throw new Error('OPENAI_API_KEY tanımlı değil. backend/.env içine ekleyin.');
  }

  const featureVectors: number[][] = [];
  for (const imgPath of imagePaths) {
    // 1. Görseli Vision ile betimle
    const shelfImage = await encodeImageAsDataUrl(imgPath, 768);
    const visionResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${appConfig.openAIApiKey}`,
      },
      body: JSON.stringify({
        model: appConfig.openAIVisionModel,
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: 'Describe this retail product in detail: focus on color, pattern, fabric type, and specific visual features. Be concise.' },
            { type: 'input_image', image_url: shelfImage.dataUrl, detail: 'low' },
          ],
        }],
        max_output_tokens: 200,
      }),
    });

    const visionResult = (await visionResponse.json()) as Record<string, unknown>;
    const description = extractOutputText(visionResult) || 'retail product';

    // 2. Betimlemeyi vektöre çevir
    const embedResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${appConfig.openAIApiKey}`,
      },
      body: JSON.stringify({
        input: description,
        model: 'text-embedding-3-small',
        dimensions: 512, // Yerel pipeline ile uyumlu olması için (genelde 512 veya 1024)
      }),
    });

    const embedResult = (await embedResponse.json()) as { data: Array<{ embedding: number[] }> };
    if (embedResult.data?.[0]?.embedding) {
      featureVectors.push(embedResult.data[0].embedding);
    } else {
      // Fallback: 512 boyutlu boş vektör
      featureVectors.push(new Array(512).fill(0));
    }
  }

  // Ortalama vektör hesapla
  const featureVector = featureVectors[0].map((_, i) =>
    featureVectors.reduce((sum, v) => sum + v[i], 0) / featureVectors.length
  );

  return { featureVector, featureVectors };
}
