import {
  archiveCollections,
  archiveSeasons,
  type ArchiveEvent,
} from '../data/events';
import {
  archiveProgrammeRelations,
  archiveReferences,
} from '../data/archiveKnowledge';

export type ArchiveIntegritySeverity = 'error' | 'warning';

export interface ArchiveIntegrityIssue {
  id: string;
  severity: ArchiveIntegritySeverity;
  recordId?: string;
  message: string;
}

export function inspectArchiveIntegrity(records: ArchiveEvent[]): ArchiveIntegrityIssue[] {
  const issues: ArchiveIntegrityIssue[] = [];
  const recordIds = new Set(records.map((record) => record.id));
  const seasonIds = new Set(archiveSeasons.map((season) => season.id));
  const collectionIds = new Set(archiveCollections.map((collection) => collection.id));
  const referenceIds = new Set(archiveReferences.map((reference) => reference.id));

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

  archiveProgrammeRelations.forEach((relation) => {
    if (!recordIds.has(relation.fromEventId) || !recordIds.has(relation.toEventId)) {
      issues.push({ id: `programme-relation-${relation.id}`, severity: 'error', message: `프로그램 관계 ${relation.id}가 없는 기록을 가리킵니다.` });
    }
    relation.referenceIds?.forEach((id) => {
      if (!referenceIds.has(id)) issues.push({ id: `relation-reference-${relation.id}-${id}`, severity: 'error', message: `프로그램 관계 ${relation.id}의 참조 노드 ${id}가 없습니다.` });
    });
  });

  archiveReferences.forEach((reference) => {
    if (reference.parentId && !referenceIds.has(reference.parentId)) {
      issues.push({ id: `reference-parent-${reference.id}`, severity: 'error', message: `참조 노드 ${reference.id}의 상위 노드 ${reference.parentId}가 없습니다.` });
    }
  });

  return issues;
}
