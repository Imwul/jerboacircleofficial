export type ProductAnalyticsEventName =
  | 'archive_search'
  | 'archive_filter_change'
  | 'archive_record_open'
  | 'archive_bookmark_toggle'
  | 'member_event_join'
  | 'member_event_cancel'
  | 'habit_status_update'
  | 'sync_failure'
  | 'sync_conflict';

type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

interface ProductAnalyticsEvent {
  name: ProductAnalyticsEventName;
  anonymousId: string;
  createdAt: string;
  path: string;
  properties: AnalyticsProperties;
}

const analyticsQueueStorageKey = 'jerboa-product-analytics-queue';
const anonymousIdStorageKey = 'jerboa-product-analytics-id';
const maxQueueSize = 80;

function canUseBrowserStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

function readQueue(): ProductAnalyticsEvent[] {
  if (!canUseBrowserStorage()) return [];

  try {
    const raw = window.localStorage.getItem(analyticsQueueStorageKey);
    return raw ? (JSON.parse(raw) as ProductAnalyticsEvent[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(events: ProductAnalyticsEvent[]) {
  if (!canUseBrowserStorage()) return;
  window.localStorage.setItem(analyticsQueueStorageKey, JSON.stringify(events.slice(-maxQueueSize)));
}

function anonymousId() {
  if (!canUseBrowserStorage()) return 'anonymous';

  const existing = window.localStorage.getItem(anonymousIdStorageKey);
  if (existing) return existing;

  const next = globalThis.crypto?.randomUUID?.() ?? `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(anonymousIdStorageKey, next);
  return next;
}

function sanitizeProperties(properties: AnalyticsProperties) {
  return Object.fromEntries(
    Object.entries(properties)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [
        key,
        typeof value === 'string' ? value.slice(0, 120) : value,
      ]),
  ) as AnalyticsProperties;
}

async function flushAnalyticsQueue() {
  const queuedEvents = readQueue();
  if (queuedEvents.length === 0) return;

  try {
    const response = await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ events: queuedEvents.slice(0, 20) }),
      keepalive: true,
    });

    if (!response.ok) return;
    writeQueue(queuedEvents.slice(20));
  } catch {
    // Analytics must never interrupt the product experience.
  }
}

export function trackProductEvent(name: ProductAnalyticsEventName, properties: AnalyticsProperties = {}) {
  if (typeof window === 'undefined') return;

  const event: ProductAnalyticsEvent = {
    name,
    anonymousId: anonymousId(),
    createdAt: new Date().toISOString(),
    path: window.location.pathname,
    properties: sanitizeProperties(properties),
  };

  writeQueue([...readQueue(), event]);
  void flushAnalyticsQueue();
}

export function normalizeSearchTerm(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase().slice(0, 80);
}
