import type { ArchiveDraftMap, ArchiveEventDraft } from './archiveDrafts';

const stringFields = new Set<keyof ArchiveEventDraft>([
  'seasonId', 'edition', 'title', 'subtitle', 'latinQuote', 'marginalia', 'date', 'posterImage',
  'shortDescription', 'longDescription', 'location', 'ctaLabel', 'ctaHref', 'publishedAt', 'updatedAt', 'createdAt',
]);
const listFields = new Set<keyof ArchiveEventDraft>([
  'collectionIds', 'passage', 'materials', 'themes', 'referenceIds', 'relatedEventIds',
]);
const enumFields: Partial<Record<keyof ArchiveEventDraft, Set<string>>> = {
  kind: new Set(['workshop', 'essay', 'exhibition', 'project', 'archive-record']),
  visibility: new Set(['public', 'unlisted', 'private']),
  workflowStatus: new Set(['draft', 'preview', 'published', 'archived']),
  status: new Set(['upcoming', 'past', 'current']),
};
const allowedFields = new Set<keyof ArchiveEventDraft>([
  ...stringFields,
  ...listFields,
  ...Object.keys(enumFields) as Array<keyof ArchiveEventDraft>,
  'isCustom',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function readDraftCandidate(payload: unknown) {
  assert(isRecord(payload), '파일의 최상위 구조가 올바르지 않습니다.');
  if (typeof payload.version === 'number') assert(payload.version === 1, '지원하지 않는 백업 파일 버전입니다.');
  if (typeof payload.type === 'string') {
    assert(
      payload.type === 'jerboa-archive-drafts' || payload.type === 'jerboa-sync-recovery',
      'Jerboa Circle 아카이브 백업 파일이 아닙니다.',
    );
  }
  if (payload.type === 'jerboa-sync-recovery') assert(payload.scope === 'archive', '회원 장부 복구 파일은 아카이브에 적용할 수 없습니다.');
  if (isRecord(payload.drafts)) return payload.drafts;
  if (isRecord(payload.data) && isRecord(payload.data.drafts)) return payload.data.drafts;
  if (!('type' in payload) && !('version' in payload) && !('data' in payload)) return payload;
  throw new Error('파일에서 아카이브 초안을 찾을 수 없습니다.');
}

function validateDraft(id: string, value: unknown) {
  assert(isRecord(value), `${id}: 초안 내용이 객체 형식이 아닙니다.`);
  const draft: Record<string, unknown> = {};
  Object.entries(value).forEach(([field, fieldValue]) => {
    assert(allowedFields.has(field as keyof ArchiveEventDraft), `${id}: 지원하지 않는 필드 “${field}”가 있습니다.`);
    if (fieldValue === undefined) return;
    if (stringFields.has(field as keyof ArchiveEventDraft)) {
      assert(typeof fieldValue === 'string' && fieldValue.length <= 250_000, `${id}: ${field} 값이 올바른 문자열이 아닙니다.`);
    } else if (listFields.has(field as keyof ArchiveEventDraft)) {
      assert(Array.isArray(fieldValue) && fieldValue.length <= 500, `${id}: ${field} 값이 목록 형식이 아닙니다.`);
      assert(fieldValue.every((item) => typeof item === 'string' && item.length <= 2_000), `${id}: ${field} 목록에 올바르지 않은 항목이 있습니다.`);
    } else if (field === 'isCustom') {
      assert(typeof fieldValue === 'boolean', `${id}: isCustom 값이 참/거짓 형식이 아닙니다.`);
    } else {
      const allowed = enumFields[field as keyof ArchiveEventDraft];
      assert(typeof fieldValue === 'string' && allowed?.has(fieldValue), `${id}: ${field} 값이 허용된 항목이 아닙니다.`);
    }
    draft[field] = fieldValue;
  });
  return draft as ArchiveEventDraft;
}

export function parseArchiveDraftImport(payload: unknown) {
  const candidate = readDraftCandidate(payload);
  const entries = Object.entries(candidate);
  assert(entries.length > 0, '비어 있는 초안 파일은 적용할 수 없습니다.');
  assert(entries.length <= 1_000, '초안 기록이 1,000개를 넘어 적용할 수 없습니다.');

  const drafts: ArchiveDraftMap = {};
  let fieldCount = 0;
  entries.forEach(([id, value]) => {
    assert(id.length > 0 && id.length <= 120, '기록 ID 길이가 올바르지 않습니다.');
    assert(!['__proto__', 'prototype', 'constructor'].includes(id), '사용할 수 없는 기록 ID가 포함되어 있습니다.');
    const draft = validateDraft(id, value);
    drafts[id] = draft;
    fieldCount += Object.keys(draft).length;
  });

  return { drafts, recordCount: entries.length, fieldCount };
}
