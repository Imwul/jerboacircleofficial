import type { ArchiveDraftMap, ArchiveEventDraft } from './archiveDrafts';
import type { ArchiveReference } from '../data/archiveKnowledge';
import type { ArchiveReferenceDraftMap } from './archiveReferenceDrafts';
import type { ArchivePublicationManifest, ArchivePublicationMap } from './publicationLedger';
import type { SiteText } from '../data/siteText';
import type { ArchiveAuditEntry, ArchiveAuditAction } from './archiveAudit';
import type { ArchiveCollection } from '../data/events';
import type { ArchiveCollectionDraftMap } from './archiveCollectionDrafts';

const stringFields = new Set<keyof ArchiveEventDraft>([
  'seasonId', 'edition', 'title', 'subtitle', 'latinQuote', 'marginalia', 'date', 'posterImage', 'posterAlt',
  'detailImage', 'detailImageAlt', 'shortDescription', 'longDescription', 'location', 'ctaLabel', 'ctaHref', 'publishedAt', 'updatedAt', 'createdAt', 'deletedAt', 'publishAt', 'unpublishAt',
]);
const listFields = new Set<keyof ArchiveEventDraft>([
  'collectionIds', 'passage', 'materials', 'primaryThemes', 'themes', 'referenceIds', 'relatedEventIds',
]);
const enumFields: Partial<Record<keyof ArchiveEventDraft, Set<string>>> = {
  visibility: new Set(['public', 'unlisted', 'private']),
  workflowStatus: new Set(['draft', 'preview', 'published', 'archived']),
  status: new Set(['upcoming', 'past', 'current']),
};
const allowedFields = new Set<keyof ArchiveEventDraft>([
  ...stringFields,
  ...listFields,
  ...Object.keys(enumFields) as Array<keyof ArchiveEventDraft>,
  'isCustom', 'kind',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function readDraftCandidate(payload: unknown) {
  assert(isRecord(payload), '파일의 최상위 구조가 올바르지 않습니다.');
  if (typeof payload.version === 'number') assert(payload.version === 1 || payload.version === 2 || payload.version === 3, '지원하지 않는 백업 파일 버전입니다.');
  if (typeof payload.type === 'string') {
    assert(
      payload.type === 'jerboa-archive-drafts' || payload.type === 'jerboa-sync-recovery',
      'Jerboa Circle 아카이브 백업 파일이 아닙니다.',
    );
  }
  if (payload.type === 'jerboa-sync-recovery') assert(payload.scope === 'archive', '회원 장부 복구 파일은 아카이브에 적용할 수 없습니다.');
  if (isRecord(payload.drafts)) return {
    drafts: payload.drafts,
    collections: isRecord(payload.collections) ? payload.collections : {},
    references: isRecord(payload.references) ? payload.references : {},
    publications: isRecord(payload.publications) ? payload.publications : {},
    siteText: isRecord(payload.siteText) ? payload.siteText : {},
    auditLog: Array.isArray(payload.auditLog) ? payload.auditLog : [],
  };
  if (isRecord(payload.data) && isRecord(payload.data.drafts)) {
    return {
      drafts: payload.data.drafts,
      collections: isRecord(payload.data.collections) ? payload.data.collections : {},
      references: isRecord(payload.data.references) ? payload.data.references : {},
      publications: isRecord(payload.data.publications) ? payload.data.publications : {},
      siteText: isRecord(payload.data.siteText) ? payload.data.siteText : {},
      auditLog: Array.isArray(payload.data.auditLog) ? payload.data.auditLog : [],
    };
  }
  if (!('type' in payload) && !('version' in payload) && !('data' in payload)) {
    return { drafts: payload, collections: {}, references: {}, publications: {}, siteText: {}, auditLog: [] };
  }
  throw new Error('파일에서 아카이브 초안을 찾을 수 없습니다.');
}

function validateCollections(candidate: Record<string, unknown>) {
  const entries = Object.entries(candidate);
  assert(entries.length <= 1_000, '컬렉션이 1,000개를 넘어 적용할 수 없습니다.');
  const collections: ArchiveCollectionDraftMap = {};
  entries.forEach(([id, value]) => {
    assert(id.length > 0 && id.length <= 120, '컬렉션 ID 길이가 올바르지 않습니다.');
    assert(!['__proto__', 'prototype', 'constructor'].includes(id), '사용할 수 없는 컬렉션 ID가 포함되어 있습니다.');
    assert(isRecord(value), `${id}: 컬렉션 내용이 객체 형식이 아닙니다.`);
    assert(value.id === id, `${id}: 컬렉션 객체의 ID가 장부 키와 다릅니다.`);
    assert(typeof value.title === 'string' && value.title.trim().length > 0 && value.title.length <= 5_000, `${id}: 컬렉션 이름이 올바르지 않습니다.`);
    assert(typeof value.description === 'string' && value.description.length <= 25_000, `${id}: 컬렉션 설명이 올바르지 않습니다.`);
    assert(Array.isArray(value.eventIds) && value.eventIds.length <= 1_000 && value.eventIds.every((entry) => typeof entry === 'string' && entry.length <= 120), `${id}: 프로그램 목록이 올바르지 않습니다.`);
    assert(Array.isArray(value.themeIds) && value.themeIds.length <= 1_000 && value.themeIds.every((entry) => typeof entry === 'string' && entry.length <= 120), `${id}: 주제 목록이 올바르지 않습니다.`);
    assert(typeof value.visibility === 'string' && ['public', 'unlisted', 'private'].includes(value.visibility), `${id}: 공개 상태가 올바르지 않습니다.`);
    collections[id] = value as unknown as ArchiveCollection;
  });
  return collections;
}

function validateSiteText(candidate: Record<string, unknown>) {
  const entries = Object.entries(candidate);
  assert(entries.length <= 500, '문구 필드가 너무 많습니다.');
  const siteText: Partial<SiteText> = {};
  entries.forEach(([key, value]) => {
    assert(typeof value === 'string' && value.length <= 25_000, `문구 ${key} 값이 올바르지 않습니다.`);
    siteText[key as keyof SiteText] = value;
  });
  return siteText;
}

const auditActions = new Set<ArchiveAuditAction>([
  'create', 'duplicate', 'edit', 'delete', 'restore', 'import', 'publish', 'sync', 'conflict-resolved', 'backup-restored',
]);

function validateAuditLog(candidate: unknown[]) {
  assert(candidate.length <= 500, '운영 기록이 500개를 넘어 적용할 수 없습니다.');
  return candidate.map((entry, index) => {
    assert(isRecord(entry), `운영 기록 ${index + 1}의 형식이 올바르지 않습니다.`);
    assert(typeof entry.id === 'string' && entry.id.length <= 120, `운영 기록 ${index + 1}의 ID가 올바르지 않습니다.`);
    assert(typeof entry.action === 'string' && auditActions.has(entry.action as ArchiveAuditAction), `운영 기록 ${index + 1}의 동작이 올바르지 않습니다.`);
    assert(['programme', 'reference', 'site-text', 'archive'].includes(String(entry.targetType)), `운영 기록 ${index + 1}의 대상이 올바르지 않습니다.`);
    assert(typeof entry.title === 'string' && entry.title.length <= 5_000, `운영 기록 ${index + 1}의 제목이 올바르지 않습니다.`);
    assert(typeof entry.createdAt === 'string' && !Number.isNaN(new Date(entry.createdAt).getTime()), `운영 기록 ${index + 1}의 시각이 올바르지 않습니다.`);
    assert(entry.targetId === undefined || (typeof entry.targetId === 'string' && entry.targetId.length <= 120), `운영 기록 ${index + 1}의 대상 ID가 올바르지 않습니다.`);
    assert(entry.detail === undefined || (typeof entry.detail === 'string' && entry.detail.length <= 25_000), `운영 기록 ${index + 1}의 설명이 올바르지 않습니다.`);
    return entry as unknown as ArchiveAuditEntry;
  });
}

const referenceOptionalFields: Array<keyof ArchiveReference> = [
  'attribution', 'creator', 'date', 'edition', 'locator', 'sourceUrl', 'rights', 'language', 'citationNote', 'altText', 'mediaAssetId', 'parentId', 'updatedAt', 'deletedAt',
];
const referenceFields = new Set<keyof ArchiveReference>([
  'id', 'kind', 'title', 'description', 'imageUrl', ...referenceOptionalFields,
]);

function validateReferences(candidate: Record<string, unknown>) {
  const entries = Object.entries(candidate);
  assert(entries.length <= 5_000, '자료 기록이 5,000개를 넘어 적용할 수 없습니다.');
  const references: ArchiveReferenceDraftMap = {};
  entries.forEach(([id, value]) => {
    assert(id.length > 0 && id.length <= 120, '자료 ID 길이가 올바르지 않습니다.');
    assert(!['__proto__', 'prototype', 'constructor'].includes(id), '사용할 수 없는 자료 ID가 포함되어 있습니다.');
    assert(isRecord(value), `${id}: 자료 내용이 객체 형식이 아닙니다.`);
    Object.keys(value).forEach((field) => {
      assert(referenceFields.has(field as keyof ArchiveReference), `${id}: 지원하지 않는 자료 필드 “${field}”가 있습니다.`);
    });
    assert(value.id === id, `${id}: 자료 객체의 ID가 장부 키와 다릅니다.`);
    assert(typeof value.kind === 'string' && value.kind.trim().length > 0 && value.kind.length <= 120, `${id}: 자료 종류가 올바르지 않습니다.`);
    assert(typeof value.title === 'string' && value.title.length > 0 && value.title.length <= 5_000, `${id}: 자료 제목이 올바르지 않습니다.`);
    assert(typeof value.description === 'string' && value.description.length > 0 && value.description.length <= 25_000, `${id}: 자료 설명이 올바르지 않습니다.`);
    referenceOptionalFields.forEach((field) => {
      const fieldValue = value[field];
      assert(fieldValue === undefined || (typeof fieldValue === 'string' && fieldValue.length <= 25_000), `${id}: ${field} 값이 올바르지 않습니다.`);
    });
    assert(value.imageUrl === undefined || (
      typeof value.imageUrl === 'string'
      && value.imageUrl.length <= 2_500_000
      && /^(https?:\/\/|data:image\/(?:png|jpeg|webp);base64,)/i.test(value.imageUrl)
    ), `${id}: 대표 이미지 값이 올바르지 않습니다.`);
    references[id] = value as unknown as ArchiveReference;
  });
  return references;
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
    } else if (field === 'kind') {
      assert(typeof fieldValue === 'string' && fieldValue.trim().length > 0 && fieldValue.length <= 120, `${id}: kind 값이 올바르지 않습니다.`);
    } else {
      const allowed = enumFields[field as keyof ArchiveEventDraft];
      assert(typeof fieldValue === 'string' && allowed?.has(fieldValue), `${id}: ${field} 값이 허용된 항목이 아닙니다.`);
    }
    draft[field] = fieldValue;
  });
  return draft as ArchiveEventDraft;
}

function validatePublications(candidate: Record<string, unknown>) {
  const entries = Object.entries(candidate);
  assert(entries.length <= 1_000, '발행 이력이 1,000개 기록을 넘어 적용할 수 없습니다.');
  const publications: ArchivePublicationMap = {};
  let publicationCount = 0;
  entries.forEach(([recordId, value]) => {
    assert(recordId.length > 0 && recordId.length <= 120, '발행 기록 ID 길이가 올바르지 않습니다.');
    assert(Array.isArray(value) && value.length <= 200, `${recordId}: 발행 이력이 목록 형식이 아닙니다.`);
    publications[recordId] = value.map((manifest) => {
      assert(isRecord(manifest), `${recordId}: 발행본 정보가 객체 형식이 아닙니다.`);
      assert(manifest.recordId === recordId, `${recordId}: 발행본의 기록 ID가 장부 키와 다릅니다.`);
      ['id', 'recordId', 'title', 'edition', 'publishedAt', 'createdAt', 'contentHash'].forEach((field) => {
        assert(typeof manifest[field] === 'string' && manifest[field].length > 0 && manifest[field].length <= 5_000, `${recordId}: 발행본 ${field} 값이 올바르지 않습니다.`);
      });
      assert(isRecord(manifest.event), `${recordId}: 발행본 프로그램 기록이 없습니다.`);
      assert(isRecord(manifest.poster), `${recordId}: 발행본 포스터 지문이 없습니다.`);
      assert(Array.isArray(manifest.references), `${recordId}: 발행본 자료 목록이 없습니다.`);
      publicationCount += 1;
      return manifest as unknown as ArchivePublicationManifest;
    });
  });
  return { publications, publicationCount };
}

export function parseArchiveDraftImport(payload: unknown) {
  const candidate = readDraftCandidate(payload);
  const entries = Object.entries(candidate.drafts);
  const collections = validateCollections(candidate.collections);
  const references = validateReferences(candidate.references);
  const { publications, publicationCount } = validatePublications(candidate.publications);
  const siteText = validateSiteText(candidate.siteText);
  const auditLog = validateAuditLog(candidate.auditLog);
  assert(entries.length > 0 || Object.keys(collections).length > 0 || Object.keys(references).length > 0 || publicationCount > 0 || Object.keys(siteText).length > 0, '비어 있는 초안 파일은 적용할 수 없습니다.');
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

  return {
    drafts,
    collections,
    references,
    publications,
    siteText,
    auditLog,
    recordCount: entries.length,
    collectionCount: Object.keys(collections).length,
    referenceCount: Object.keys(references).length,
    publicationCount,
    fieldCount,
  };
}
