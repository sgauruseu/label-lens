/**
 * Reads a photograph of a label into the same domain model a barcode lookup produces.
 *
 * This is the escape hatch for the roughly one product in three that has no usable Open Food
 * Facts entry — a local brand, a new line, a supermarket own-label. The model's only job is
 * transcription: it turns the printed panel into structured fields. It is never asked to
 * judge the product, because the scoring rules live in `core/` where they are testable and
 * where the user can see every one of them.
 *
 * The key is the user's own and is kept in `localStorage`. That is an honest trade for a
 * static site with no backend, and the settings screen says so plainly.
 */

import { normalizeProduct, type OffProduct } from '../core/normalize.js';
import type { Product } from '../core/types.js';
import type { Settings } from './storage.js';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
// Model IDs are retired on a schedule, and a retired one fails with a 400 that reads exactly
// like a billing problem. If the photo feature starts returning 400 for everyone at once, this
// line is the first thing to check against the provider's current model list.
const ANTHROPIC_MODEL = 'claude-sonnet-5';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';

const PROMPT = `You are transcribing a photograph of a packaged food label.

Return ONLY a JSON object, no prose and no code fence, with these keys:
{
  "product_name": string,
  "brands": string,
  "quantity": string,
  "ingredients_text": string,
  "additives_tags": string[],          // E-numbers found, lowercase, e.g. ["en:e322","en:e471"]
  "allergens_tags": string[],          // e.g. ["en:milk","en:gluten"]
  "categories_tags": string[],         // include "en:beverages" only if it is a drink
  "ingredients_analysis_tags": string[], // any of: en:palm-oil, en:palm-oil-free, en:vegan, en:non-vegan, en:vegetarian, en:non-vegetarian
  "nova_group": 1 | 2 | 3 | 4,
  "nutriments": {
    "energy-kcal_100g": number, "fat_100g": number, "saturated-fat_100g": number,
    "carbohydrates_100g": number, "sugars_100g": number, "fiber_100g": number,
    "proteins_100g": number, "salt_100g": number
  }
}

Rules:
- Transcribe only. Do not judge the product and do not add commentary.
- Omit any key you cannot read from the photo. Never guess a number.
- If values are given per serving, convert to per 100 g or 100 ml and say nothing about it.
- If salt is given as sodium, multiply by 2.5.
- Assign nova_group only if the ingredient list makes it obvious.`;

export class AiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiError';
  }
}

/**
 * Turns a failed provider response into a message that names the actual problem.
 *
 * Both providers put a usable sentence in the error body — "credit balance is too low",
 * "invalid x-api-key", "model not found". Replacing all of them with "check your API key" sends
 * the user to look at the one thing that is usually fine, so the body is shown as it came.
 */
async function providerError(response: Response): Promise<AiError> {
  const detail = await response
    .text()
    .then((body) => {
      const parsed: unknown = JSON.parse(body);
      const message =
        typeof parsed === 'object' && parsed !== null
          ? (parsed as { error?: { message?: unknown } }).error?.message
          : undefined;
      return typeof message === 'string' ? message : body.slice(0, 200);
    })
    .catch(() => '');

  const hint =
    response.status === 401
      ? ' The key is wrong, or was copied with a space.'
      : response.status === 429
        ? ' You have hit the rate limit — wait a moment and try again.'
        : '';

  return new AiError(`The provider refused the request (${response.status}). ${detail}${hint}`);
}

/** Strips a code fence if the model added one anyway, then parses. */
function parseModelJson(text: string): OffProduct {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new AiError('The model did not return a product. Try a sharper photo of the label.');
  }
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as OffProduct;
  } catch {
    throw new AiError('The model returned something that was not valid JSON. Try again.');
  }
}

/** Splits a data URL into the media type and the bare base64 payload both APIs expect. */
function splitDataUrl(dataUrl: string): { mediaType: string; base64: string } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match?.[1] || !match[2]) throw new AiError('The image could not be read.');
  return { mediaType: match[1], base64: match[2] };
}

async function callAnthropic(dataUrl: string, apiKey: string): Promise<string> {
  const { mediaType, base64 } = splitDataUrl(dataUrl);
  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // Required for browser-originated requests; without it the API refuses the call.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    }),
  });

  if (!response.ok) throw await providerError(response);
  const json = (await response.json()) as { content?: { type: string; text?: string }[] };
  const text = json.content?.find((block) => block.type === 'text')?.text;
  if (!text) throw new AiError('The model returned an empty response.');
  return text;
}

async function callOpenAi(dataUrl: string, apiKey: string): Promise<string> {
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) throw await providerError(response);
  const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new AiError('The model returned an empty response.');
  return text;
}

/**
 * Turns a photo of a label into a scored-ready `Product`.
 *
 * The result goes through exactly the same `normalizeProduct` path as an API response, so a
 * photo-sourced product is scored by the same audited rules — only `source` differs.
 */
export async function readLabelPhoto(dataUrl: string, settings: Settings): Promise<Product> {
  if (!settings.apiKey) {
    throw new AiError('Add your own API key in Settings to read labels from a photo.');
  }
  const text =
    settings.provider === 'openai'
      ? await callOpenAi(dataUrl, settings.apiKey)
      : await callAnthropic(dataUrl, settings.apiKey);

  const off = parseModelJson(text);
  const product = normalizeProduct(off, 'ai-photo');
  if (!product.barcode) product.barcode = `photo-${Date.now()}`;
  return product;
}

/** Reads a `File` from an input element into a data URL, downscaled to keep the request small. */
export function fileToDataUrl(file: File, maxEdge = 1400): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new AiError('The image could not be read.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new AiError('The image could not be decoded.'));
      image.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext('2d');
        if (!context) return reject(new AiError('The image could not be processed.'));
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
