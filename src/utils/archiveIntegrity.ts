import {
  archiveCollections,
  archiveSeasons,
  type ArchiveEvent,
} from '../data/events';
import {
  archiveReferences,
  type ArchiveReference,
} from '../data/archiveKnowledge';
import { getArchiveMediaAsset } from '../data/mediaAssets';

export type ArchiveIntegritySeverity = 'error' | 'warning';

export interface ArchiveIntegrityIssue {
  id: string;
  severity: ArchiveIntegritySeverity;
  recordId?: string;
  referenceId?: string;
  message: string;
}

export function inspectArchiveIntegrity(
  records: ArchiveEvent[],
  references: ArchiveReference[] = archiveReferences,
): ArchiveIntegrityIssue[] {
  const issues: ArchiveIntegrityIssue[] = [];
  const recordIds = new Set(records.map((record) => record.id));
  const seasonIds = new Set(archiveSeasons.map((season) => season.id));
  const collectionIds = new Set(archiveCollections.map((collection) => collection.id));
  const referenceIds = new Set(references.map((reference) => reference.id));

  records.forEach((record, index) => {
    if (records.findIndex((candidate) => candidate.id === record.id) !== index) {
      issues.push({ id: `duplicate-record-${record.id}`, severity: 'error', recordId: record.id, message: `중복 기록 ID: ${record.id}` });
    }
    if (!seasonIds.has(record.seasonId)) {
      issues.push({ id: `season-${record.id}`, severity: 'error', recordId: record.id, message: `없는 시즌 ID: ${record.seasonId}` });
    }
    record.collectionIds.forEach((id) => {
      if (!collectionIds.has(id)) issues.push({ id: `collection-${record.id}-${id}`, severity: 'error', recordId: record.id, message: `없는 컬렉션 ID: ${id}` });
    });
    record.referenceIds.forEach((id) => {
      if (!referenceIds.has(id)) issues.push({ id: `reference-${record.id}-${id}`, severity: 'error', recordId: record.id, message: `없는 참조 노드 ID: ${id}` });
    });
    record.relatedEventIds.forEach((id) => {
      if (id === record.id) issues.push({ id: `self-relation-${record.id}`, severity: 'error', recordId: record.id, message: '기록이 자기 자신을 연결 프로그램으로 가리킵니다.' });
      else if (!recordIds.has(id)) issues.push({ id: `relation-${record.id}-${id}`, severity: 'error', recordId: record.id, message: `없는 연결 프로그램 ID: ${id}` });
    });
    if (record.workflowStatus === 'published' && record.visibility !== 'public') {
      issues.push({ id: `published-hidden-${record.id}`, severity: 'warning', recordId: record.id, message: '발행됨 상태이지만 공개 상태가 아닙니다.' });
    }
    if (record.workflowStatus === 'published' && record.referenceIds.length === 0) {
      issues.push({ id: `published-unreferenced-${record.id}`, severity: 'warning', recordId: record.id, message: '발행 기록에 연결된 책·작품·인용·도판이 없습니다.' });
    }
  });

  references.forEach((reference, index) => {
    if (references.findIndex((candidate) => candidate.id === reference.id) !== index) {
      issues.push({ id: `duplicate-reference-${reference.id}`, severity: 'error', referenceId: reference.id, message: `중복 자료 ID: ${reference.id}` });
    }
    if (reference.parentId && !referenceIds.has(reference.parentId)) {
      issues.push({ id: `reference-parent-${reference.id}`, severity: 'error', referenceId: reference.id, message: `참조 노드 ${reference.id}의 상위 노드 ${reference.parentId}가 없습니다.` });
    }
    if (reference.parentId === reference.id) {
      issues.push({ id: `reference-self-parent-${reference.id}`, severity: 'error', referenceId: reference.id, message: `자료 ${reference.id}가 자기 자신을 상위 원전으로 가리킵니다.` });
    }
    if (reference.parentId && reference.parentId !== reference.id) {
      const visited = new Set([reference.id]);
      let nextId: string | undefined = reference.parentId;
      while (nextId && referenceIds.has(nextId)) {
        if (visited.has(nextId)) {
          issues.push({ id: `reference-cycle-${reference.id}`, severity: 'error', referenceId: reference.id, message: `자료 ${reference.title}의 상위 원전 연결이 순환합니다.` });
          break;
        }
        visited.add(nextId);
        nextId = references.find((candidate) => candidate.id === nextId)?.parentId;
      }
    }
    if ((reference.kind === 'image' || reference.kind === 'artwork') && !reference.sourceUrl) {
      issues.push({ id: `reference-source-${reference.id}`, severity: 'warning', referenceId: reference.id, message: `${reference.title}: 원문 출처 URL 없이 발행됩니다.` });
    }
    if ((reference.kind === 'image' || reference.kind === 'artwork') && !reference.rights) {
      issues.push({ id: `reference-rights-${reference.id}`, severity: 'error', referenceId: reference.id, message: `${reference.title}: 권리와 재사용 조건이 없습니다.` });
    }
    if ((reference.kind === 'image' || reference.kind === 'artwork' || reference.imageUrl) && !reference.altText) {
      issues.push({ id: `reference-alt-${reference.id}`, severity: 'error', referenceId: reference.id, message: `${reference.title}: 이미지 대체 텍스트가 없습니다.` });
    }
    if (reference.kind === 'image' && !reference.mediaAssetId && !reference.imageUrl) {
      issues.push({ id: `reference-media-${reference.id}`, severity: 'warning', referenceId: reference.id, message: `${reference.title}: 대표 이미지가 연결되지 않았습니다.` });
    }
    if (reference.mediaAssetId) {
      const asset = getArchiveMediaAsset(reference.mediaAssetId);
      if (!asset) {
        issues.push({ id: `reference-media-missing-${reference.id}`, severity: 'error', referenceId: reference.id, message: `${reference.title}: 등록되지 않은 도판 파일 ID입니다.` });
      } else {
        if (reference.sourceUrl !== asset.sourceUrl) {
          issues.push({ id: `reference-media-source-${reference.id}`, severity: 'error', referenceId: reference.id, message: `${reference.title}: 도판 파일과 소장기관 출처가 일치하지 않습니다.` });
        }
        if (reference.title !== asset.title) {
          issues.push({ id: `reference-media-title-${reference.id}`, severity: 'warning', referenceId: reference.id, message: `${reference.title}: 소장기관 작품명과 자료 제목이 다릅니다.` });
        }
      }
    }
    if (reference.kind === 'quotation' && !reference.parentId) {
      issues.push({ id: `reference-quotation-parent-${reference.id}`, severity: 'warning', referenceId: reference.id, message: `${reference.title}: 인용문의 상위 원전이 연결되지 않았습니다.` });
    }
  });

  return issues;
}
