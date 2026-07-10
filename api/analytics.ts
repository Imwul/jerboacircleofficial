import { get, put } from '@vercel/blob';
import crypto from 'node:crypto';

const analyticsPathname = 'jerboa-analytics/events.json';
const maxAnalyticsBodyBytes = 24_000;
const maxStoredEvents = 2_000;
const maxBatchSize = 20;

const allowedEvents = new Set([
  'archive_search',
  'archive_filter_change',
  'archive_record_open',
  'archive_bookmark_toggle',
  'member_event_join',
  'member_event_cancel',
  'habit_status_update',
  'sync_failure',
  'sync_conflict',
]);

function sendJson(response: any, statusCode: number, body: unknown) {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.end(JSON.stringify(body));
}

async function readJsonBody(request: any) {
  const contentLength = Number(request.headers['content-length'] || 0);
  if (contentLength > maxAnalyticsBodyBytes) {
    throw new Error('payload_too_large');
  }

  if (request.body && typeof request.body === 'object') {
    return request.body;
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maxAnalyticsBodyBytes) {
      throw new Error('payload_too_large');
    }
    chunks.push(buffer);
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? JSON.parse(rawBody) : {};
}

async function readStoredEvents() {
  const blob = await get(analyticsPathname, { access: 'private' });
  if (!blob || blob.statusCode !== 200) return [];
  const text = await new Response(blob.stream).text();
  const parsed = JSON.parse(text);
  return Array.isArray(parsed.events) ? parsed.events : [];
}

function sanitizePrimitive(value: unknown) {
  if (typeof value === 'string') return value.slice(0, 120);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value;
  if (value === null) return null;
  return undefined;
}

function sanitizeProperties(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, 18)
      .map(([key, propertyValue]) => [key.slice(0, 48), sanitizePrimitive(propertyValue)])
      .filter((entry): entry is [string, string | number | boolean | null] => entry[1] !== undefined),
  );
}

function sanitizeEvent(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const event = value as Record<string, unknown>;
  const name = typeof event.name === 'string' ? event.name : '';
  if (!allowedEvents.has(name)) return null;

  return {
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    name,
    anonymousId: typeof event.anonymousId === 'string' ? event.anonymousId.slice(0, 80) : 'anonymous',
    createdAt: typeof event.createdAt === 'string' ? event.createdAt.slice(0, 40) : undefined,
    path: typeof event.path === 'string' ? event.path.slice(0, 160) : undefined,
    properties: sanitizeProperties(event.properties),
  };
}

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    response.setHeader('allow', 'POST');
    return sendJson(response, 405, {
      ok: false,
      error: 'method_not_allowed',
    });
  }

  if (process.env.JERBOA_ANALYTICS_DISABLED === 'true') {
    return sendJson(response, 200, {
      ok: true,
      stored: 0,
    });
  }

  try {
    const body = await readJsonBody(request);
    const rawEvents = Array.isArray(body?.events) ? body.events : [body];
    const events = rawEvents.slice(0, maxBatchSize).map(sanitizeEvent).filter(Boolean);

    if (events.length === 0) {
      return sendJson(response, 400, {
        ok: false,
        error: 'invalid_analytics_payload',
      });
    }

    const existingEvents = await readStoredEvents();
    const nextEvents = [...existingEvents, ...events].slice(-maxStoredEvents);

    await put(analyticsPathname, JSON.stringify({
      savedAt: new Date().toISOString(),
      events: nextEvents,
    }), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    });

    return sendJson(response, 200, {
      ok: true,
      stored: events.length,
    });
  } catch (error) {
    return sendJson(response, 400, {
      ok: false,
      error: error instanceof Error ? error.message : 'analytics_failed',
    });
  }
}
