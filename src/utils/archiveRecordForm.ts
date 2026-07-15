import {
  archiveCollections,
  archiveSeasons,
  type ArchiveContentKind,
  type ArchiveEvent,
  type ArchiveVisibility,
  type ArchiveWorkflowStatus,
  type EventStatus,
} from '../data/events';
import { archiveReferences } from '../data/archiveKnowledge';
import type { ArchiveEventDraft } from './archiveDrafts';

export interface ArchiveRecordFormState {
  kind: ArchiveContentKind;
  visibility: ArchiveVisibility;
  workflowStatus: ArchiveWorkflowStatus;
  seasonId: string;
  collectionIdsText: string;
  edition: string;
  title: string;
  subtitle: string;
  latinQuote: string;
  marginalia: string;
  date: string;
  status: EventStatus;
  posterImage: string;
  shortDescription: string;
  longDescription: string;
  passageText: string;
  materialsText: string;
  themesText: string;
  referenceIdsText: string;
  relatedEventIdsText: string;
  location: string;
  ctaLabel: string;
}

export function splitArchiveFormList(value: string) {
  return value.split(/\n|\//).map((item) => item.trim()).filter(Boolean);
}

export function toArchiveRecordForm(event: ArchiveEvent): ArchiveRecordFormState {
  return {
    kind: event.kind,
    visibility: event.visibility,
    workflowStatus: event.workflowStatus,
    seasonId: event.seasonId,
    collectionIdsText: event.collectionIds.join(' / '),
    edition: event.edition,
    title: event.title,
    subtitle: event.subtitle,
    latinQuote: event.latinQuote,
    marginalia: event.marginalia,
    date: event.date,
    status: event.status,
    posterImage: event.posterImage,
    shortDescription: event.shortDescription,
    longDescription: event.longDescription,
    passageText: event.passage.join(' / '),
    materialsText: event.materials.join(' / '),
    themesText: event.themes.join(' / '),
    referenceIdsText: event.referenceIds.join(' / '),
    relatedEventIdsText: event.relatedEventIds.join(' / '),
    location: event.location,
    ctaLabel: event.ctaLabel,
  };
}

export function toArchiveEventDraft(form: ArchiveRecordFormState, event?: ArchiveEvent): ArchiveEventDraft {
  return {
    kind: form.kind,
    visibility: form.visibility,
    workflowStatus: form.workflowStatus,
    seasonId: form.seasonId,
    collectionIds: splitArchiveFormList(form.collectionIdsText),
    edition: form.edition,
    title: form.title,
    subtitle: form.subtitle,
    latinQuote: form.latinQuote,
    marginalia: form.marginalia,
    date: form.date,
    status: form.status,
    posterImage: form.posterImage,
    shortDescription: form.shortDescription,
    longDescription: form.longDescription,
    passage: splitArchiveFormList(form.passageText),
    materials: splitArchiveFormList(form.materialsText),
    themes: splitArchiveFormList(form.themesText),
    referenceIds: splitArchiveFormList(form.referenceIdsText),
    relatedEventIds: splitArchiveFormList(form.relatedEventIdsText),
    location: form.location,
    ctaLabel: form.ctaLabel,
    ...(event ? { ctaHref: event.ctaHref || `./archive/${event.id}/` } : {}),
  };
}

export function validateArchiveRecordForm(form: ArchiveRecordFormState, records: ArchiveEvent[]) {
  const requiredFields: Array<[keyof ArchiveRecordFormState, string]> = [
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

  const emptyField = requiredFields.find(([key]) => !String(form[key]).trim());
  if (emptyField) return `${emptyField[1]}을 입력하세요`;
  if (!archiveSeasons.some((season) => season.id === form.seasonId)) return '시즌을 선택하세요';

  const collectionIds = splitArchiveFormList(form.collectionIdsText);
  if (collectionIds.length === 0) return '컬렉션을 하나 이상 선택하세요';
  const missingCollection = collectionIds.find((id) => !archiveCollections.some((collection) => collection.id === id));
  if (missingCollection) return `없는 컬렉션 ID입니다: ${missingCollection}`;
  if (splitArchiveFormList(form.passageText).length === 0) return '여정 단계를 하나 이상 입력하세요';
  if (splitArchiveFormList(form.materialsText).length === 0) return '자료 묶음을 하나 이상 입력하세요';
  if (splitArchiveFormList(form.themesText).length === 0) return '주제를 하나 이상 입력하세요';

  const knownReferenceIds = new Set(archiveReferences.map((reference) => reference.id));
  const missingReference = splitArchiveFormList(form.referenceIdsText).find((id) => !knownReferenceIds.has(id));
  if (missingReference) return `없는 참조 노드 ID입니다: ${missingReference}`;
  const knownRecordIds = new Set(records.map((record) => record.id));
  const missingRelatedRecord = splitArchiveFormList(form.relatedEventIdsText).find((id) => !knownRecordIds.has(id));
  if (missingRelatedRecord) return `없는 연결 프로그램 ID입니다: ${missingRelatedRecord}`;
  return '';
}
