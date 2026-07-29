import type { ArchiveEvent } from '../data/events';
import type { ArchiveReference } from '../data/archiveKnowledge';
import type { ArchiveEventDraft } from './archiveDrafts';
import { inspectArchiveIntegrity, type ArchiveIntegritySeverity } from './archiveIntegrity';

const publicationStorageKey = 'jerboa-circle-publication-manifests';

export interface ArchivePublicationIssue {
  id: string;
  severity: ArchiveIntegritySeverity;
  message: string;
}

export interface ArchivePublicationManifest {
  id: string;
  recordId: string;
  title: string;
  edition: string;
  publishedAt: string;
  createdAt: string;
  contentHash: string;
  poster: {
    source: 'embedded' | 'url';
    contentHash: string;
    url?: string;
  };
  event: Omit<ArchiveEvent, 'posterImage'>;
  references: Array<Pick<ArchiveReference,
    'id' | 'kind' | 'title' | 'attribution' | 'creator' | 'date' | 'sourceUrl' | 'rights' | 'citationNote' | 'altText' | 'mediaAssetId' | 'imageUrl' | 'parentId'
  >>;
}

export type ArchivePublicationMap = Record<string, ArchivePublicationManifest[]>;

export interface ArchivePublicationChange {
  id: string;
  label: string;
  kind: 'field' | 'reference-added' | 'reference-removed' | 'reference-updated';
  before?: string;
  after?: string;
}

export interface ArchivePublicationComparison {
  isFirstPublication: boolean;
  changes: ArchivePublicationChange[];
}

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

function stableHash(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function readArchivePublications(): ArchivePublicationMap {
  if (!canUseStorage()) return {};
  try {
    const raw = window.localStorage.getItem(publicationStorageKey);
    return raw ? JSON.parse(raw) as ArchivePublicationMap : {};
  } catch {
    return {};
  }
}

export function writeArchivePublications(publications: ArchivePublicationMap) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(publicationStorageKey, JSON.stringify(publications));
}

export function publicationsWithManifest(
  publications: ArchivePublicationMap,
  manifest: ArchivePublicationManifest,
) {
  const existing = publications[manifest.recordId] ?? [];
  if (existing.some((item) => item.contentHash === manifest.contentHash)) return publications;
  return {
    ...publications,
    [manifest.recordId]: [manifest, ...existing],
  };
}

export function createPublicationManifest(
  event: ArchiveEvent,
  references: ArchiveReference[],
  createdAt = new Date().toISOString(),
): ArchivePublicationManifest {
  const { posterImage, ...eventSnapshot } = event;
  const posterHash = stableHash(posterImage);
  const poster = posterImage.startsWith('data:')
    ? { source: 'embedded' as const, contentHash: posterHash }
    : { source: 'url' as const, contentHash: posterHash, url: posterImage };
  const referenceSnapshots = event.referenceIds
    .map((id) => references.find((reference) => reference.id === id))
    .filter((reference): reference is ArchiveReference => Boolean(reference))
    .map((reference) => ({
      id: reference.id,
      kind: reference.kind,
      title: reference.title,
      attribution: reference.attribution,
      creator: reference.creator,
      date: reference.date,
      sourceUrl: reference.sourceUrl,
      rights: reference.rights,
      citationNote: reference.citationNote,
      altText: reference.altText,
      mediaAssetId: reference.mediaAssetId,
      imageUrl: reference.imageUrl,
      parentId: reference.parentId,
    }));
  const contentHash = stableHash(JSON.stringify({ event: eventSnapshot, poster, references: referenceSnapshots }));
  return {
    id: `${event.id}-${createdAt.replace(/\D/g, '').slice(0, 14)}-${contentHash}`,
    recordId: event.id,
    title: event.title,
    edition: event.edition,
    publishedAt: event.publishedAt,
    createdAt,
    contentHash,
    poster,
    event: eventSnapshot,
    references: referenceSnapshots,
  };
}

function readableValue(value: unknown) {
  if (Array.isArray(value)) return value.join(' · ') || '없음';
  if (value === undefined || value === null || value === '') return '없음';
  return String(value);
}

export function comparePublicationManifest(
  event: ArchiveEvent,
  references: ArchiveReference[],
  previous?: ArchivePublicationManifest,
): ArchivePublicationComparison {
  if (!previous) return { isFirstPublication: true, changes: [] };

  const current = createPublicationManifest(event, references, previous.createdAt);
  const fields: Array<{
    key: keyof ArchivePublicationManifest['event'];
    label: string;
  }> = [
    { key: 'kind', label: '기록 종류' },
    { key: 'visibility', label: '공개 범위' },
    { key: 'workflowStatus', label: '발행 단계' },
    { key: 'seasonId', label: '시즌' },
    { key: 'collectionIds', label: '컬렉션' },
    { key: 'edition', label: '판본명' },
    { key: 'title', label: '제목' },
    { key: 'subtitle', label: '부제' },
    { key: 'latinQuote', label: '인용문' },
    { key: 'marginalia', label: '여백 문장' },
    { key: 'date', label: '표시 일자' },
    { key: 'posterAlt', label: '포스터 대체 설명' },
    { key: 'detailImage', label: '상세 본문 이미지' },
    { key: 'detailImageAlt', label: '상세 본문 이미지 대체 설명' },
    { key: 'publishAt', label: '공개 시작 시각' },
    { key: 'unpublishAt', label: '공개 종료 시각' },
    { key: 'status', label: '프로그램 상태' },
    { key: 'shortDescription', label: '짧은 설명' },
    { key: 'longDescription', label: '긴 설명' },
    { key: 'passage', label: '여정 단계' },
    { key: 'materials', label: '자료 묶음' },
    { key: 'primaryThemes', label: '메인 주제' },
    { key: 'themes', label: '전체 주제' },
    { key: 'relatedEventIds', label: '이어지는 프로그램' },
    { key: 'location', label: '형식' },
    { key: 'ctaLabel', label: '버튼 문구' },
    { key: 'ctaHref', label: '버튼 주소' },
  ];
  const changes: ArchivePublicationChange[] = [];

  fields.forEach(({ key, label }) => {
    const before = readableValue(previous.event[key]);
    const after = readableValue(current.event[key]);
    if (before !== after) {
      changes.push({ id: `field-${String(key)}`, label, kind: 'field', before, after });
    }
  });

  if (previous.poster.contentHash !== current.poster.contentHash) {
    changes.push({
      id: 'field-poster',
      label: '포스터 이미지',
      kind: 'field',
      before: previous.poster.contentHash,
      after: current.poster.contentHash,
    });
  }

  const previousReferences = new Map(previous.references.map((reference) => [reference.id, reference]));
  const currentReferences = new Map(current.references.map((reference) => [reference.id, reference]));
  currentReferences.forEach((reference, id) => {
    if (!previousReferences.has(id)) {
      changes.push({ id: `reference-added-${id}`, label: reference.title, kind: 'reference-added', after: id });
    } else if (JSON.stringify(previousReferences.get(id)) !== JSON.stringify(reference)) {
      changes.push({ id: `reference-updated-${id}`, label: reference.title, kind: 'reference-updated', before: id, after: id });
    }
  });
  previousReferences.forEach((reference, id) => {
    if (!currentReferences.has(id)) {
      changes.push({ id: `reference-removed-${id}`, label: reference.title, kind: 'reference-removed', before: id });
    }
  });

  return { isFirstPublication: false, changes };
}

export function draftFromPublication(
  publication: ArchivePublicationManifest,
  currentPosterImage: string,
): ArchiveEventDraft {
  const { id: _recordId, ...eventSnapshot } = publication.event;
  return {
    ...eventSnapshot,
    posterImage: publication.poster.source === 'url' && publication.poster.url
      ? publication.poster.url
      : currentPosterImage,
    visibility: 'unlisted',
    workflowStatus: 'preview',
    publishedAt: publication.publishedAt,
    updatedAt: new Date().toISOString().slice(0, 10),
  };
}

export function inspectPublicationReadiness(
  event: ArchiveEvent,
  records: ArchiveEvent[],
  references: ArchiveReference[],
): ArchivePublicationIssue[] {
  const issues: ArchivePublicationIssue[] = [];
  const requiredText: Array<[keyof ArchiveEvent, string]> = [
    ['edition', '판본'],
    ['title', '제목'],
    ['subtitle', '부제'],
    ['date', '일자'],
    ['posterImage', '포스터 이미지'],
    ['shortDescription', '짧은 설명'],
    ['longDescription', '긴 설명'],
    ['location', '형식'],
    ['ctaLabel', '버튼 문구'],
  ];
  requiredText.forEach(([key, label]) => {
    if (!String(event[key]).trim()) issues.push({ id: `required-${String(key)}`, severity: 'error', message: `${label}이 비어 있습니다.` });
  });
  if (event.posterImage.startsWith('data:')) {
    issues.push({ id: 'embedded-poster', severity: 'error', message: '포스터를 공동 이미지 저장소로 옮긴 뒤 발행하세요.' });
  }
  if (!event.posterAlt?.trim()) {
    issues.push({ id: 'poster-alt', severity: 'warning', message: '포스터 대체 텍스트를 입력하면 화면 읽기 도구에서도 기록을 이해할 수 있습니다.' });
  }
  if (event.detailImage?.startsWith('data:')) {
    issues.push({ id: 'embedded-detail-image', severity: 'error', message: '상세 본문 이미지를 공동 이미지 저장소로 옮긴 뒤 발행하세요.' });
  }
  if (event.detailImage && !event.detailImageAlt?.trim()) {
    issues.push({ id: 'detail-image-alt', severity: 'warning', message: '상세 본문 이미지 대체 텍스트를 입력하세요.' });
  }
  if (event.visibility !== 'public') issues.push({ id: 'visibility', severity: 'error', message: '공개 상태가 public이어야 발행할 수 있습니다.' });
  if (event.workflowStatus !== 'published') issues.push({ id: 'workflow', severity: 'error', message: '발행 단계가 published여야 합니다.' });
  if (event.collectionIds.length === 0) issues.push({ id: 'collections', severity: 'error', message: '공개 컬렉션을 하나 이상 연결해야 합니다.' });
  if (event.passage.length === 0) issues.push({ id: 'passage', severity: 'error', message: '여정 단계를 하나 이상 기록해야 합니다.' });
  if (event.primaryThemes.length === 0) issues.push({ id: 'primary-themes', severity: 'error', message: '메인 주제를 하나 이상 기록해야 합니다.' });
  if (event.referenceIds.length === 0) issues.push({ id: 'references', severity: 'warning', message: '연결된 원전 없이 발행됩니다. 필요할 때 나중에 덧붙일 수 있습니다.' });
  if (event.publishAt) {
    const publishAt = new Date(event.publishAt).getTime();
    if (Number.isNaN(publishAt)) issues.push({ id: 'publish-at-invalid', severity: 'error', message: '예약 공개 시작 시각을 확인하세요.' });
    if (publishAt > Date.now()) issues.push({ id: 'publish-at-future', severity: 'warning', message: `${new Date(publishAt).toLocaleString('ko-KR')}에 자동 공개됩니다.` });
  }
  if (event.unpublishAt) {
    const unpublishAt = new Date(event.unpublishAt).getTime();
    if (Number.isNaN(unpublishAt)) issues.push({ id: 'unpublish-at-invalid', severity: 'error', message: '예약 공개 종료 시각을 확인하세요.' });
    if (event.publishAt && unpublishAt <= new Date(event.publishAt).getTime()) {
      issues.push({ id: 'schedule-order', severity: 'error', message: '공개 종료 시각은 공개 시작 시각보다 뒤여야 합니다.' });
    }
  }

  const candidateRecords = records.map((record) => record.id === event.id ? event : record);
  const referenceIds = new Set(event.referenceIds);
  inspectArchiveIntegrity(candidateRecords, references).forEach((issue) => {
    if (issue.id.startsWith('published-hidden-') || issue.id.startsWith('published-unreferenced-')) return;
    if (issue.recordId && issue.recordId !== event.id) return;
    if (issue.referenceId && !referenceIds.has(issue.referenceId)) return;
    if (!issues.some((candidate) => candidate.id === issue.id)) {
      issues.push({ id: issue.id, severity: issue.severity, message: issue.message });
    }
  });

  return issues;
}
