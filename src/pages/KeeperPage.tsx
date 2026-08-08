import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  archiveCollections,
  archiveSeasons,
  defaultArchiveContentKinds,
  defaultArchivePrimaryThemes,
  defaultArchiveCollectionId,
  defaultArchiveSeasonId,
  events,
  type ArchiveContentKind,
  type ArchiveCollection,
  type ArchiveEvent,
  type ArchiveVisibility,
  type ArchiveWorkflowStatus,
  type EventStatus,
} from '../data/events';
import { type SiteText } from '../data/siteText';
import {
  applyArchiveDrafts,
  clearAllArchiveDrafts,
  readArchiveDrafts,
  readArchiveDraftRevisions,
  restoreDeletedArchiveDraft,
  restoreArchiveDraftRevision,
  writeArchiveDraft,
  writeArchiveDrafts,
  type ArchiveEventDraft,
  type ArchiveDraftMap,
} from '../utils/archiveDrafts';
import {
  applyArchiveCollectionDrafts,
  clearArchiveCollectionDrafts,
  readArchiveCollectionDrafts,
  writeArchiveCollectionDraft,
  writeArchiveCollectionDrafts,
  type ArchiveCollectionDraftMap,
} from '../utils/archiveCollectionDrafts';
import { loadServerSync, saveServerSync, ServerSyncError } from '../utils/serverSync';
import {
  getSiteText,
  mergeSiteText,
  writeSiteTextDraft,
} from '../utils/siteTextDrafts';
import { resizeImage } from '../utils/imageUtils';
import { discardUploadedMedia, uploadArchiveImage } from '../utils/cabinetMedia';
import { editorialPlates } from '../data/manuscriptPlates';
import { usePageMetadata } from '../utils/pageMetadata';
import { downloadLatestSyncRecovery, readSyncRecovery, writeSyncRecovery } from '../utils/syncRecovery';
import { authenticateRole, clearRoleSession, readRoleSession, roleSessionToken } from '../utils/roleAuth';
import {
  archiveReferenceKindLabel,
  archiveReferences,
  defaultArchiveReferenceKinds,
  type ArchiveReference,
  type ArchiveReferenceKind,
} from '../data/archiveKnowledge';
import {
  applyArchiveReferenceDrafts,
  clearAllArchiveReferenceDrafts,
  readArchiveReferenceDrafts,
  restoreDeletedArchiveReferenceDraft,
  writeArchiveReferenceDraft,
  writeArchiveReferenceDrafts,
  type ArchiveReferenceDraftMap,
} from '../utils/archiveReferenceDrafts';
import { inspectArchiveIntegrity } from '../utils/archiveIntegrity';
import { getArchiveMediaAsset } from '../data/mediaAssets';
import RelationshipPicker from '../components/archive/RelationshipPicker';
import ConnectivityNotice from '../components/ui/ConnectivityNotice';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import KeeperEditorActionBar, { type KeeperOperation } from '../components/keeper/KeeperEditorActionBar';
import { parseArchiveDraftImport } from '../utils/archiveImport';
import {
  archiveEventFromForm,
  splitArchiveFormList as splitDraftList,
  toArchiveEventDraft as toDraft,
  toArchiveRecordForm as toFormState,
  validateArchiveRecordForm as validateKeeperForm,
  type ArchiveRecordFormState as KeeperFormState,
} from '../utils/archiveRecordForm';
import {
  comparePublicationManifest,
  createPublicationManifest,
  draftFromPublication,
  inspectPublicationReadiness,
  publicationsWithManifest,
  readArchivePublications,
  writeArchivePublications,
  type ArchivePublicationMap,
} from '../utils/publicationLedger';
import {
  readArchiveAuditLog,
  recordArchiveAudit,
  writeArchiveAuditLog,
  type ArchiveAuditEntry,
} from '../utils/archiveAudit';
import {
  checkArchiveLinks,
  loadArchiveOperationalStatus,
  restoreArchiveBackup,
  type ArchiveOperationalStatus,
} from '../utils/archiveOps';
import {
  readKeeperPreferences,
  withRecentItem,
  writeKeeperPreferences,
  type KeeperItemKind,
  type KeeperSavedView,
} from '../utils/keeperPreferences';
import { suggestReferenceMetadata } from '../utils/referenceMetadata';
import { useDialogFocus } from '../utils/useDialogFocus';
import {
  clearKeeperProgrammeWorkingCopies,
  readKeeperProgrammeWorkingCopies,
  removeKeeperProgrammeWorkingCopy,
  writeKeeperProgrammeWorkingCopy,
  type KeeperProgrammeWorkingCopy,
} from '../utils/keeperWorkingCopies';
import './HomePage.css';
import './EditorialStability.css';
import '../JerboaCondoRefine.css';

interface ArchiveSyncPayload {
  schemaVersion?: 1 | 2 | 3;
  drafts?: ArchiveDraftMap;
  collections?: ArchiveCollectionDraftMap;
  siteText?: Partial<SiteText>;
  references?: ArchiveReferenceDraftMap;
  publications?: ArchivePublicationMap;
  auditLog?: ArchiveAuditEntry[];
}

type ReferenceFormState = Omit<ArchiveReference, 'id'> & { id: string };

type KeeperListView = 'register' | 'timeline';
type KeeperEditorSection = 'identity' | 'artwork' | 'content' | 'connections' | 'publication';

interface InlineReferenceForm {
  id: string;
  kind: ArchiveReferenceKind;
  title: string;
  sourceUrl: string;
  description: string;
  creator: string;
  attribution: string;
  date: string;
  rights: string;
  altText: string;
}

const emptyInlineReference: InlineReferenceForm = {
  id: '',
  kind: 'book',
  title: '',
  sourceUrl: '',
  description: '',
  creator: '',
  attribution: '',
  date: '',
  rights: '',
  altText: '',
};

const editorSectionLabels: Array<{ id: KeeperEditorSection; label: string }> = [
  { id: 'identity', label: '기본 정보' },
  { id: 'artwork', label: '도판' },
  { id: 'content', label: '내용' },
  { id: 'connections', label: '연결' },
  { id: 'publication', label: '발행' },
];

function toReferenceForm(reference: ArchiveReference): ReferenceFormState {
  return { ...reference };
}

function validateReferenceForm(form: ReferenceFormState, references: ArchiveReference[], originalId = form.id) {
  if (!form.id.trim()) return '자료 ID를 입력하세요';
  if (!/^[a-z0-9가-힣-]+$/.test(form.id)) return '자료 ID는 영문 소문자, 숫자, 한글과 하이픈만 사용할 수 있습니다';
  if (!form.kind.trim()) return '자료 종류를 입력하세요';
  if (form.kind.trim().length > 120) return '자료 종류는 120자 이내로 입력하세요';
  if (form.id !== originalId && (
    references.some((reference) => reference.id === form.id)
    || Boolean(readArchiveReferenceDrafts()[form.id])
  )) return `이미 사용 중인 자료 ID입니다: ${form.id}`;
  if (!form.title.trim()) return '자료 제목을 입력하세요';
  if (!form.description.trim()) return '자료 설명을 입력하세요';
  if ((form.kind === 'image' || form.kind === 'artwork') && !form.rights?.trim()) return '도판과 작품은 권리와 재사용 조건이 필요합니다';
  if ((form.kind === 'image' || form.kind === 'artwork' || form.imageUrl) && !form.altText?.trim()) return '이미지가 있는 자료는 이미지 대체 텍스트가 필요합니다';
  if (form.imageUrl && !/^(https?:\/\/|data:image\/(?:png|jpeg|webp);base64,)/i.test(form.imageUrl)) return '대표 이미지 주소 형식이 올바르지 않습니다';
  if (form.mediaAssetId) {
    const mediaAsset = getArchiveMediaAsset(form.mediaAssetId);
    if (!mediaAsset) return `등록되지 않은 도판 파일 ID입니다: ${form.mediaAssetId}`;
    if (form.sourceUrl !== mediaAsset.sourceUrl) return '도판 파일과 소장기관 원문 출처가 일치하지 않습니다';
    if (form.title !== mediaAsset.title) return '검증된 도판의 작품명은 소장기관 기록과 같아야 합니다';
  }
  if (form.parentId && !references.some((reference) => reference.id === form.parentId)) return `없는 상위 자료 ID입니다: ${form.parentId}`;
  if (form.parentId === form.id) return '자료가 자기 자신을 상위 원전으로 가리킬 수 없습니다';
  if (form.parentId) {
    const parentById = new Map(references.map((reference) => [reference.id, reference]));
    const visited = new Set([form.id]);
    let nextId: string | undefined = form.parentId;
    while (nextId) {
      if (visited.has(nextId)) return '상위 원전 연결이 순환 구조를 만듭니다';
      visited.add(nextId);
      nextId = parentById.get(nextId)?.parentId;
    }
  }
  return '';
}

type KeeperPendingAction =
  | { kind: 'import'; drafts: ArchiveDraftMap; collections: ArchiveCollectionDraftMap; references: ArchiveReferenceDraftMap; publications: ArchivePublicationMap; siteText: Partial<SiteText>; auditLog: ArchiveAuditEntry[]; recordCount: number; collectionCount: number; referenceCount: number; publicationCount: number; fieldCount: number; diffSummary: string }
  | { kind: 'clear' }
  | { kind: 'restore'; revisionId: string; title: string }
  | { kind: 'restore-publication'; publicationId: string; title: string; contentHash: string }
  | { kind: 'publish'; title: string; warningCount: number }
  | { kind: 'unpublish'; title: string }
  | { kind: 'delete-record'; id: string; title: string; impactSummary: string }
  | { kind: 'delete-records'; ids: string[]; titles: string[]; impactSummary: string }
  | { kind: 'delete-reference'; id: string; title: string; impactSummary: string }
  | { kind: 'delete-references'; ids: string[]; titles: string[]; impactSummary: string }
  | { kind: 'restore-backup'; pathname: string; title: string }
  | null;

interface ArchiveConflictState {
  remote: ArchiveSyncPayload;
  remoteSavedAt: string;
  local: ArchiveSyncPayload;
}

const siteTextFields: Array<{
  key: keyof SiteText;
  label: string;
  area?: boolean;
}> = [
  { key: 'wordmarkSmall', label: '헤더 작은 문구' },
  { key: 'navFeaturedEn', label: '탭 1 영어' },
  { key: 'navFeaturedKo', label: '탭 1 한글' },
  { key: 'navArchiveEn', label: '탭 2 영어' },
  { key: 'navArchiveKo', label: '탭 2 한글' },
  { key: 'navManifestoEn', label: '탭 3 영어' },
  { key: 'navManifestoKo', label: '탭 3 한글' },
  { key: 'navJoinEn', label: '탭 4 영어' },
  { key: 'navJoinKo', label: '탭 4 한글' },
  { key: 'navMembersEn', label: '탭 5 영어' },
  { key: 'navMembersKo', label: '탭 5 한글' },
  { key: 'mastheadIntroEn', label: '대문 영어 문장', area: true },
  { key: 'mastheadIntroKo', label: '대문 한글 설명', area: true },
  { key: 'orientationKickerEn', label: '첫 안내 영어 표제' },
  { key: 'orientationKickerKo', label: '첫 안내 한글 표제' },
  { key: 'orientationStatementKo', label: '첫 안내 핵심 설명', area: true },
  { key: 'orientationCurrentKo', label: '첫 안내 / 현재 프로그램' },
  { key: 'orientationArchiveKo', label: '첫 안내 / 지난 기록' },
  { key: 'orientationPrivateKo', label: '첫 안내 / 회원 장부' },
  { key: 'ritualOne', label: '의식 1' },
  { key: 'ritualTwo', label: '의식 2' },
  { key: 'ritualThree', label: '의식 3' },
  { key: 'ritualFour', label: '의식 4' },
  { key: 'featuredKickerEn', label: '현재 프로그램 영어 표제' },
  { key: 'featuredKickerKo', label: '현재 프로그램 한글 표제' },
  { key: 'journeyLabel', label: '여정 표 제목' },
  { key: 'materialsLabel', label: '자료 표 제목' },
  { key: 'metaEdition', label: '메타 / 판본' },
  { key: 'metaDate', label: '메타 / 일자' },
  { key: 'metaFormat', label: '메타 / 형식' },
  { key: 'statusCurrent', label: '상태 / 현재' },
  { key: 'statusUpcoming', label: '상태 / 예정' },
  { key: 'statusPast', label: '상태 / 지난 기록' },
  { key: 'archiveKickerEn', label: '아카이브 영어 표제' },
  { key: 'archiveKickerKo', label: '아카이브 한글 표제' },
  { key: 'archiveHeading', label: '아카이브 큰 문장', area: true },
  { key: 'manifestoKickerEn', label: '소개 영어 표제' },
  { key: 'manifestoKickerKo', label: '소개 한글 표제' },
  { key: 'manifestoBody', label: '소개 본문', area: true },
  { key: 'joinKickerEn', label: '문의 영어 표제' },
  { key: 'joinKickerKo', label: '문의 한글 표제' },
  { key: 'joinHeading', label: '문의 큰 문장', area: true },
  { key: 'joinCtaLabel', label: '문의 버튼 문구' },
  { key: 'joinCtaHref', label: '문의 버튼 링크' },
  { key: 'footerLeft', label: '푸터 왼쪽' },
  { key: 'footerRight', label: '푸터 오른쪽' },
  { key: 'detailNavArchiveEn', label: '상세 / 기록벽 영어' },
  { key: 'detailNavArchiveKo', label: '상세 / 기록벽 한글' },
  { key: 'detailNavMembersEn', label: '상세 / 회원실 영어' },
  { key: 'detailNavMembersKo', label: '상세 / 회원실 한글' },
  { key: 'detailBackLabel', label: '상세 / 돌아가기 버튼' },
  { key: 'missingKicker', label: '없는 기록 / 표제' },
  { key: 'missingTitle', label: '없는 기록 / 제목' },
];

function makeRecordId(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42);
  return `${slug || 'new-programme'}-${Date.now().toString(36)}`;
}

function makeCollectionId(title: string, collections: ArchiveCollection[]) {
  const slug = title
    .toLocaleLowerCase('ko-KR')
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'new-collection';
  if (!collections.some((collection) => collection.id === slug)) return slug;
  return `${slug}-${Date.now().toString(36)}`;
}

function nextEditionLabel(records: ArchiveEvent[]) {
  const highestEdition = records.reduce((highest, record) => {
    const editionNumber = Number(record.edition.match(/\d+/)?.[0] ?? 0);
    return Number.isFinite(editionNumber) ? Math.max(highest, editionNumber) : highest;
  }, 0);
  return `Edition ${String(highestEdition + 1).padStart(3, '0')}`;
}

function changedMapCount(left: Record<string, unknown> = {}, right: Record<string, unknown> = {}) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].filter((key) => JSON.stringify(left[key]) !== JSON.stringify(right[key])).length;
}

function changedMapEntries(left: Record<string, any> = {}, right: Record<string, any> = {}) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys]
    .filter((key) => JSON.stringify(left[key]) !== JSON.stringify(right[key]))
    .slice(0, 30)
    .map((key) => ({
      key,
      local: left[key]?.title ?? left[key]?.label ?? (left[key] === undefined ? '없음' : '수정됨'),
      remote: right[key]?.title ?? right[key]?.label ?? (right[key] === undefined ? '없음' : '수정됨'),
    }));
}

function archivePayloadChangeCount(left: ArchiveSyncPayload | null, right: ArchiveSyncPayload) {
  if (!left) return 0;
  return changedMapCount(left.drafts, right.drafts)
    + changedMapCount(left.collections, right.collections)
    + changedMapCount(left.references, right.references)
    + changedMapCount(left.siteText as Record<string, unknown>, right.siteText as Record<string, unknown>)
    + changedMapCount(left.publications, right.publications)
    + (JSON.stringify(left.auditLog ?? []) === JSON.stringify(right.auditLog ?? []) ? 0 : 1);
}

function importDiffSummary(current: ArchiveSyncPayload, incoming: ArchiveSyncPayload) {
  const describe = (label: string, left: Record<string, unknown> = {}, right: Record<string, unknown> = {}) => {
    const leftKeys = new Set(Object.keys(left));
    const rightKeys = new Set(Object.keys(right));
    const added = [...rightKeys].filter((key) => !leftKeys.has(key)).length;
    const removed = [...leftKeys].filter((key) => !rightKeys.has(key)).length;
    const changed = [...rightKeys].filter((key) => leftKeys.has(key) && JSON.stringify(left[key]) !== JSON.stringify(right[key])).length;
    return `${label} 추가 ${added} · 수정 ${changed} · 제외 ${removed}`;
  };
  return [
    describe('프로그램', current.drafts, incoming.drafts),
    describe('컬렉션', current.collections, incoming.collections),
    describe('자료', current.references, incoming.references),
    describe('공개 문구', current.siteText as Record<string, unknown>, incoming.siteText as Record<string, unknown>),
    describe('발행본', current.publications, incoming.publications),
  ].join(' / ');
}

function mergePublicationMaps(remote: ArchivePublicationMap = {}, local: ArchivePublicationMap = {}) {
  const merged: ArchivePublicationMap = { ...remote };
  Object.entries(local).forEach(([recordId, publications]) => {
    const existing = merged[recordId] ?? [];
    merged[recordId] = [...publications, ...existing.filter((item) => !publications.some((localItem) => localItem.id === item.id))];
  });
  return merged;
}

function formatBytes(bytes: number) {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(2)} MB`;
}

function timeLabel(date = new Date()) {
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function journeyStepsFromText(value: string) {
  if (value.includes('\n')) return value.split('\n');
  const steps = splitDraftList(value);
  return steps.length > 0 ? steps : [''];
}

function validateSiteTextForm(siteText: SiteText) {
  const requiredKeys: Array<[keyof SiteText, string]> = [
    ['wordmarkSmall', '헤더 작은 문구'],
    ['navFeaturedEn', '탭 1 영어'],
    ['navArchiveEn', '탭 2 영어'],
    ['navManifestoEn', '탭 3 영어'],
    ['navJoinEn', '탭 4 영어'],
    ['navMembersEn', '탭 5 영어'],
    ['mastheadIntroKo', '대문 한글 설명'],
    ['archiveHeading', '아카이브 큰 문장'],
    ['manifestoBody', '소개 본문'],
    ['joinHeading', '문의 큰 문장'],
    ['joinCtaLabel', '문의 버튼 문구'],
    ['joinCtaHref', '문의 버튼 링크'],
    ['missingTitle', '없는 기록 제목'],
  ];

  const emptyField = requiredKeys.find(([key]) => !siteText[key].trim());
  return emptyField ? `${emptyField[1]}을 입력하세요` : '';
}

function posterUploadMessage(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  if (code.includes('media_auth_required')) return 'Keeper 입장 시간이 끝났습니다 / 다시 입장한 뒤 포스터를 보존하세요';
  if (code.includes('image_too_large') || code.includes('payload_too_large') || code.includes('media_http_413')) return '포스터 용량을 줄이지 못했습니다 / 더 작은 PNG 파일로 다시 시도하세요';
  if (code.includes('invalid_image') || code.includes('image_decode_failed')) return 'PNG, JPG 또는 WebP 이미지인지 확인하세요';
  if (code.includes('media_store_access_mismatch')) return '공동 이미지 저장소의 공개 설정이 맞지 않습니다 / 배포 설정을 확인하세요';
  if (code.includes('blob')) return '공동 이미지 저장소가 잠시 닫혔습니다 / 잠시 뒤 다시 시도하세요';
  return '포스터를 보존하지 못했습니다 / 연결을 확인하고 다시 시도하세요';
}

function referenceImageUploadMessage(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  if (code.includes('media_auth_required') || code.includes('session_required')) return 'Keeper 입장 시간이 끝났습니다 / 다시 입장한 뒤 이미지를 올리세요';
  if (code.includes('image_too_large') || code.includes('payload_too_large') || code.includes('media_http_413')) return '이미지 용량을 줄이지 못했습니다 / 더 작은 파일로 다시 시도하세요';
  if (code.includes('invalid_image') || code.includes('image_decode_failed')) return 'PNG, JPG 또는 WebP 이미지인지 확인하세요';
  if (code.includes('media_store_access_mismatch')) return '공동 이미지 저장소의 공개 설정이 맞지 않습니다 / 배포 설정을 확인하세요';
  if (code.includes('blob')) return '공동 이미지 저장소가 잠시 닫혔습니다 / 잠시 뒤 다시 시도하세요';
  return '대표 이미지를 올리지 못했습니다 / 연결을 확인하고 다시 시도하세요';
}

export default function KeeperPage() {
  const [isAccessGranted, setIsAccessGranted] = useState(() => Boolean(readRoleSession('archive-editor')));
  const [accessStatus, setAccessStatus] = useState('Keeper pass key를 입력하면 이 기기에서 7일 동안 다시 묻지 않습니다.');
  const [mode, setMode] = useState<'events' | 'references' | 'text'>(() => (
    window.location.pathname.replace(/\/+$/, '').endsWith('/godmode') ? 'text' : 'events'
  ));
  const [version, setVersion] = useState(0);
  const archiveEvents = useMemo(() => applyArchiveDrafts(events), [version]);
  const collectionRecords = useMemo(() => applyArchiveCollectionDrafts(archiveCollections), [version]);
  const referenceRecords = useMemo(() => applyArchiveReferenceDrafts(archiveReferences), [version]);
  const [selectedId, setSelectedId] = useState(() => {
    const requestedId = new URLSearchParams(window.location.search).get('record');
    return requestedId || archiveEvents[0].id;
  });
  const selectedEvent = archiveEvents.find((event) => event.id === selectedId) ?? archiveEvents[0];
  const [form, setForm] = useState(() => toFormState(selectedEvent));
  const [selectedReferenceId, setSelectedReferenceId] = useState(referenceRecords[0].id);
  const selectedReference = referenceRecords.find((reference) => reference.id === selectedReferenceId) ?? referenceRecords[0];
  const [referenceForm, setReferenceForm] = useState<ReferenceFormState>(() => toReferenceForm(selectedReference));
  const [siteTextForm, setSiteTextForm] = useState<SiteText>(() => getSiteText());
  const draftCount = useMemo(() => Object.keys(readArchiveDrafts()).length, [version]);
  const [serverKey, setServerKey] = useState('');
  const [syncStatus, setSyncStatus] = useState('공개본 확인 대기');
  const [archiveSavedAt, setArchiveSavedAt] = useState<string | null>(null);
  const [hasArchiveConflict, setHasArchiveConflict] = useState(false);
  const [hasArchiveRecovery, setHasArchiveRecovery] = useState(() => Boolean(readSyncRecovery<ArchiveSyncPayload>('archive')));
  const [pendingAction, setPendingAction] = useState<KeeperPendingAction>(null);
  const [listQuery, setListQuery] = useState('');
  const [workflowFilter, setWorkflowFilter] = useState<ArchiveWorkflowStatus | 'all'>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<ArchiveVisibility | 'all'>('all');
  const [kindFilter, setKindFilter] = useState<string>('all');
  const [sharedSnapshot, setSharedSnapshot] = useState<ArchiveSyncPayload | null>(null);
  const [lastLocalSavedAt, setLastLocalSavedAt] = useState<string | null>(null);
  const [activeOperation, setActiveOperation] = useState<KeeperOperation>('idle');
  const [operationError, setOperationError] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [conflictState, setConflictState] = useState<ArchiveConflictState | null>(null);
  const [conflictChoices, setConflictChoices] = useState<{
    drafts: 'local' | 'remote';
    collections: 'local' | 'remote';
    references: 'local' | 'remote';
    siteText: 'local' | 'remote';
  }>({ drafts: 'local', collections: 'local', references: 'local', siteText: 'local' });
  const [showOperations, setShowOperations] = useState(false);
  const [operationsStatus, setOperationsStatus] = useState<ArchiveOperationalStatus | null>(null);
  const [operationsBusy, setOperationsBusy] = useState(false);
  const [linkCheckResults, setLinkCheckResults] = useState<Array<{ url: string; ok: boolean; status?: number; error?: string }>>([]);
  const [preferences, setPreferences] = useState(readKeeperPreferences);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [listView, setListView] = useState<KeeperListView>('register');
  const [templateId, setTemplateId] = useState('blank');
  const [savedViewName, setSavedViewName] = useState('');
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [selectedReferenceBatchIds, setSelectedReferenceBatchIds] = useState<string[]>([]);
  const [batchWorkflow, setBatchWorkflow] = useState<ArchiveWorkflowStatus | ''>('');
  const [batchVisibility, setBatchVisibility] = useState<ArchiveVisibility | ''>('');
  const [batchKind, setBatchKind] = useState('');
  const [livePreviewOpen, setLivePreviewOpen] = useState(false);
  const [livePreviewViewport, setLivePreviewViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [previewRevision, setPreviewRevision] = useState(0);
  const [collapsedSections, setCollapsedSections] = useState<KeeperEditorSection[]>([]);
  const [inlineReferenceOpen, setInlineReferenceOpen] = useState(false);
  const [inlineReferenceForm, setInlineReferenceForm] = useState<InlineReferenceForm>(emptyInlineReference);
  const [metadataBusy, setMetadataBusy] = useState(false);
  const [posterUploadStatus, setPosterUploadStatus] = useState<{
    state: 'idle' | 'busy' | 'success' | 'error';
    message: string;
  }>({ state: 'idle', message: '' });
  const [detailImageUploadStatus, setDetailImageUploadStatus] = useState<{
    state: 'idle' | 'busy' | 'success' | 'error';
    message: string;
  }>({ state: 'idle', message: '' });
  const [referenceImageUploadStatus, setReferenceImageUploadStatus] = useState<{
    state: 'idle' | 'busy' | 'success' | 'error';
    message: string;
  }>({ state: 'idle', message: '' });
  const [workingCopyVersion, setWorkingCopyVersion] = useState(0);
  const [newPrimaryTheme, setNewPrimaryTheme] = useState('');
  const [inlineCollectionOpen, setInlineCollectionOpen] = useState(false);
  const [inlineCollectionTitle, setInlineCollectionTitle] = useState('');
  const [inlineCollectionDescription, setInlineCollectionDescription] = useState('');
  const [inlineCollectionVisibility, setInlineCollectionVisibility] = useState<ArchiveVisibility>('public');
  const activeOperationRef = useRef<KeeperOperation>('idle');
  const commandDialogRef = useDialogFocus<HTMLElement>(commandOpen, () => setCommandOpen(false));
  const detailImageInputRef = useRef<HTMLInputElement>(null);
  const referenceImageInputRef = useRef<HTMLInputElement>(null);
  const pendingPosterUploadRef = useRef<string | null>(null);
  const pendingDetailUploadRef = useRef<string | null>(null);
  const pendingReferenceUploadRef = useRef<string | null>(null);
  const formRef = useRef(form);
  formRef.current = form;
  const programmeUndo = useRef<KeeperFormState[]>([]);
  const programmeRedo = useRef<KeeperFormState[]>([]);
  const referenceUndo = useRef<ReferenceFormState[]>([]);
  const referenceRedo = useRef<ReferenceFormState[]>([]);
  const textUndo = useRef<SiteText[]>([]);
  const textRedo = useRef<SiteText[]>([]);
  const editorRef = useRef<HTMLElement>(null);
  const isDirty = JSON.stringify(form) !== JSON.stringify(toFormState(selectedEvent));
  const isReferenceDirty = JSON.stringify(referenceForm) !== JSON.stringify(toReferenceForm(selectedReference));
  const isTextDirty = JSON.stringify(siteTextForm) !== JSON.stringify(getSiteText());
  const selectedRevisions = useMemo(() => readArchiveDraftRevisions(selectedEvent.id), [selectedEvent.id, version]);
  const selectedPublications = useMemo(() => readArchivePublications()[selectedEvent.id] ?? [], [selectedEvent.id, version]);
  const integrityIssues = useMemo(
    () => inspectArchiveIntegrity(archiveEvents, referenceRecords, collectionRecords),
    [archiveEvents, collectionRecords, referenceRecords],
  );
  const publicationCandidate = useMemo(() => ({
    ...archiveEventFromForm(
      selectedEvent.id,
      form,
      selectedEvent,
      selectedEvent.publishedAt || new Date().toISOString().slice(0, 10),
    ),
    visibility: 'public' as const,
    workflowStatus: 'published' as const,
  }), [form, selectedEvent]);
  const publicationIssues = useMemo(
    () => inspectPublicationReadiness(publicationCandidate, archiveEvents, referenceRecords),
    [publicationCandidate, archiveEvents, referenceRecords],
  );
  const publicationErrorCount = publicationIssues.filter((issue) => issue.severity === 'error').length;
  const publicationWarningCount = publicationIssues.filter((issue) => issue.severity === 'warning').length;
  const publicationComparison = useMemo(
    () => comparePublicationManifest(publicationCandidate, referenceRecords, selectedPublications[0]),
    [publicationCandidate, referenceRecords, selectedPublications],
  );
  const selectedIntegrityIssues = integrityIssues.filter((issue) => {
    if (mode === 'references') return !issue.referenceId || issue.referenceId === selectedReference.id;
    return !issue.recordId || issue.recordId === selectedEvent.id;
  });
  const currentPayload = useMemo<ArchiveSyncPayload>(() => ({
    schemaVersion: 3,
    drafts: {
      ...readArchiveDrafts(),
      ...(isDirty ? { [selectedEvent.id]: toDraft(form) } : {}),
    },
    collections: readArchiveCollectionDrafts(),
    siteText: siteTextForm,
    references: {
      ...readArchiveReferenceDrafts(),
      ...(isReferenceDirty ? { [referenceForm.id]: referenceForm } : {}),
    },
    publications: readArchivePublications(),
    auditLog: readArchiveAuditLog(),
  }), [form, isDirty, isReferenceDirty, referenceForm, siteTextForm, version]);
  const unsyncedChangeCount = useMemo(
    () => archivePayloadChangeCount(sharedSnapshot, currentPayload),
    [currentPayload, sharedSnapshot],
  );
  const duplicateReference = useMemo(() => {
    const sourceUrl = referenceForm.sourceUrl?.trim().replace(/\/$/, '');
    if (!sourceUrl) return null;
    return referenceRecords.find((reference) => (
      reference.id !== selectedReference.id
      && reference.sourceUrl?.trim().replace(/\/$/, '') === sourceUrl
    )) ?? null;
  }, [referenceForm.sourceUrl, referenceRecords, selectedReference.id]);
  const deletedRecordDrafts = useMemo(() => Object.entries(readArchiveDrafts())
    .filter(([, draft]) => Boolean(draft.deletedAt))
    .map(([id, draft]) => ({
      id,
      title: draft.title ?? events.find((event) => event.id === id)?.title ?? id,
    })), [version]);
  const deletedReferenceDrafts = useMemo(() => Object.values(readArchiveReferenceDrafts())
    .filter((reference) => Boolean(reference.deletedAt))
    .map((reference) => ({ id: reference.id, title: reference.title })), [version]);
  const programmeKinds = useMemo(() => Array.from(new Set([
    ...defaultArchiveContentKinds,
    ...archiveEvents.map((event) => event.kind),
  ])), [archiveEvents]);
  const primaryThemeOptions = useMemo(() => Array.from(new Set([
    ...defaultArchivePrimaryThemes,
    ...archiveEvents.flatMap((event) => event.primaryThemes),
    ...splitDraftList(form.primaryThemesText),
  ])), [archiveEvents, form.primaryThemesText]);
  const referenceKinds = useMemo(() => Array.from(new Set([
    ...defaultArchiveReferenceKinds,
    ...referenceRecords.map((reference) => reference.kind),
    referenceForm.kind,
  ].filter(Boolean))), [referenceForm.kind, referenceRecords]);
  const referenceMediaAsset = referenceForm.mediaAssetId ? getArchiveMediaAsset(referenceForm.mediaAssetId) : undefined;
  const referenceImagePreview = referenceForm.imageUrl ?? referenceMediaAsset?.src;
  const programmeWorkingCopies = useMemo(() => Object.values(readKeeperProgrammeWorkingCopies())
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt)), [workingCopyVersion]);
  const visibleArchiveEvents = useMemo(() => {
    const query = listQuery.trim().toLocaleLowerCase('ko-KR');
    return archiveEvents.filter((event) => (
      (!query || `${event.edition} ${event.title} ${event.kind}`.toLocaleLowerCase('ko-KR').includes(query))
      && (workflowFilter === 'all' || event.workflowStatus === workflowFilter)
      && (visibilityFilter === 'all' || event.visibility === visibilityFilter)
      && (kindFilter === 'all' || event.kind === kindFilter)
    )).sort((left, right) => {
      const favouriteDelta = Number(preferences.favouriteProgrammes.includes(right.id)) - Number(preferences.favouriteProgrammes.includes(left.id));
      if (favouriteDelta) return favouriteDelta;
      return right.updatedAt.localeCompare(left.updatedAt);
    });
  }, [archiveEvents, kindFilter, listQuery, preferences.favouriteProgrammes, visibilityFilter, workflowFilter]);
  const visibleReferenceRecords = useMemo(() => {
    const query = listQuery.trim().toLocaleLowerCase('ko-KR');
    return referenceRecords.filter((reference) => (
      !query ||
      `${reference.title} ${reference.creator ?? ''} ${archiveReferenceKindLabel(reference.kind)}`
        .toLocaleLowerCase('ko-KR')
        .includes(query)
    )).sort((left, right) => {
      const favouriteDelta = Number(preferences.favouriteReferences.includes(right.id)) - Number(preferences.favouriteReferences.includes(left.id));
      if (favouriteDelta) return favouriteDelta;
      return (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '') || right.title.localeCompare(left.title, 'ko');
    });
  }, [listQuery, preferences.favouriteReferences, referenceRecords]);
  const timelineEvents = useMemo(() => [...visibleArchiveEvents].sort((left, right) => {
    const leftDate = left.publishAt ?? left.publishedAt ?? left.updatedAt;
    const rightDate = right.publishAt ?? right.publishedAt ?? right.updatedAt;
    return rightDate.localeCompare(leftDate);
  }), [visibleArchiveEvents]);
  const recentItems = useMemo(() => preferences.recentItems.flatMap((item) => {
    if (item.kind === 'programme') {
      const record = archiveEvents.find((event) => event.id === item.id);
      return record ? [{ ...item, title: record.title, meta: record.edition }] : [];
    }
    const reference = referenceRecords.find((entry) => entry.id === item.id);
    return reference ? [{ ...item, title: reference.title, meta: archiveReferenceKindLabel(reference.kind) }] : [];
  }).slice(0, 6), [archiveEvents, preferences.recentItems, referenceRecords]);
  const commandResults = useMemo(() => {
    const query = commandQuery.trim().toLocaleLowerCase('ko-KR');
    if (!query) return [
      ...archiveEvents.slice(0, 5).map((event) => ({ id: event.id, kind: 'programme' as const, title: event.title, meta: event.edition })),
      ...referenceRecords.slice(0, 5).map((reference) => ({ id: reference.id, kind: 'reference' as const, title: reference.title, meta: archiveReferenceKindLabel(reference.kind) })),
    ];
    return [
      ...archiveEvents.filter((event) => `${event.title} ${event.edition} ${event.kind}`.toLocaleLowerCase('ko-KR').includes(query))
        .map((event) => ({ id: event.id, kind: 'programme' as const, title: event.title, meta: event.edition })),
      ...referenceRecords.filter((reference) => `${reference.title} ${reference.creator ?? ''} ${reference.kind}`.toLocaleLowerCase('ko-KR').includes(query))
        .map((reference) => ({ id: reference.id, kind: 'reference' as const, title: reference.title, meta: archiveReferenceKindLabel(reference.kind) })),
    ].slice(0, 12);
  }, [archiveEvents, commandQuery, referenceRecords]);
  const formWarnings = useMemo(() => [
    ...(!form.posterAlt.trim() ? [{ section: 'artwork' as const, message: '포스터 대체 텍스트가 비어 있습니다.' }] : []),
    ...(form.title.length > 60 ? [{ section: 'identity' as const, message: '제목이 60자를 넘어 작은 화면에서 잘릴 수 있습니다.' }] : []),
    ...(form.subtitle.length > 120 ? [{ section: 'identity' as const, message: '부제가 120자를 넘습니다.' }] : []),
    ...(form.shortDescription.length > 220 ? [{ section: 'content' as const, message: '짧은 설명이 220자를 넘습니다.' }] : []),
    ...(form.longDescription.length > 1500 ? [{ section: 'content' as const, message: '긴 설명이 1,500자를 넘습니다.' }] : []),
    ...(splitDraftList(form.referenceIdsText).length === 0 ? [{ section: 'connections' as const, message: '연결된 자료 없이도 발행할 수 있지만 읽기 목록은 비어 보입니다.' }] : []),
  ], [form]);
  const selectedRelations = useMemo(() => ({
    references: splitDraftList(form.referenceIdsText).flatMap((id) => {
      const reference = referenceRecords.find((entry) => entry.id === id);
      return reference ? [reference] : [];
    }),
    programmes: splitDraftList(form.relatedEventIdsText).flatMap((id) => {
      const record = archiveEvents.find((entry) => entry.id === id);
      return record ? [record] : [];
    }),
  }), [archiveEvents, form.referenceIdsText, form.relatedEventIdsText, referenceRecords]);
  const initialArchiveLoad = useRef(false);

  usePageMetadata({
    title: mode === 'text'
      ? 'Text Register | Jerboa Circle Keeper'
      : mode === 'references'
        ? 'Reference Register | Jerboa Circle Keeper'
        : 'Register of Passages | Jerboa Circle Keeper',
    description: 'Jerboa Circle keeper desk for archive records, site text, drafts, and shared publication.',
    canonicalPath: mode === 'text' ? '/godmode/' : '/keeper/',
    noIndex: true,
  });

  useEffect(() => {
    writeKeeperPreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (mode === 'events') url.searchParams.set('record', selectedId);
    else url.searchParams.delete('record');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, [mode, selectedId]);

  useEffect(() => {
    setPosterUploadStatus({ state: 'idle', message: '' });
    setDetailImageUploadStatus({ state: 'idle', message: '' });
  }, [selectedId]);

  useEffect(() => {
    setReferenceImageUploadStatus({ state: 'idle', message: '' });
  }, [selectedReferenceId]);

  useEffect(() => {
    if (!isAccessGranted || !livePreviewOpen || mode !== 'events') return;
    const timer = window.setTimeout(() => {
      writeArchiveDraft(selectedEvent.id, toDraft(form), { label: 'live preview', recordRevision: false });
      setPreviewRevision((current) => current + 1);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [form, isAccessGranted, livePreviewOpen, mode, selectedEvent.id]);

  useEffect(() => {
    if (!isAccessGranted) return;
    function handleKeyboard(event: KeyboardEvent) {
      const commandKey = event.metaKey || event.ctrlKey;
      if (commandKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
        return;
      }
      if (event.key === 'Escape') {
        setCommandOpen(false);
        return;
      }
      if (!commandKey) return;
      if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveCurrentDraft();
      } else if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redoCurrent();
        else undoCurrent();
      } else if (event.shiftKey && event.key.toLowerCase() === 'p' && mode === 'events') {
        event.preventDefault();
        setLivePreviewOpen((current) => !current);
      }
    }
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [form, isAccessGranted, mode, referenceForm, siteTextForm]);

  useEffect(() => {
    if (!isAccessGranted || initialArchiveLoad.current) return;
    initialArchiveLoad.current = true;
    void loadArchiveFromServer();
  }, [isAccessGranted]);

  useEffect(() => {
    if (!isAccessGranted || !isDirty) return;
    const timer = window.setTimeout(() => {
      const saved = writeKeeperProgrammeWorkingCopy({
        recordId: selectedEvent.id,
        title: form.title.trim() || selectedEvent.title || selectedEvent.id,
        savedAt: new Date().toISOString(),
        isCustom: !events.some((event) => event.id === selectedEvent.id),
        form,
      });
      if (saved) setWorkingCopyVersion((current) => current + 1);
      else setSyncStatus('자동 복구본을 남길 공간이 부족합니다 / 파일 백업을 받아두세요');
    }, 320);
    return () => window.clearTimeout(timer);
  }, [form, isAccessGranted, isDirty, selectedEvent.id, selectedEvent.title]);

  useEffect(() => {
    if (!isAccessGranted || !isDirty || isComposing) return;
    const timer = window.setTimeout(() => {
      writeArchiveDraft(selectedEvent.id, toDraft(form), { label: 'automatic local draft', recordRevision: false });
      setVersion((current) => current + 1);
      setLastLocalSavedAt(new Date().toISOString());
      setSyncStatus(`프로그램 수정 자동 보관됨 / ${timeLabel()}`);
    }, 1_800);
    return () => window.clearTimeout(timer);
  }, [form, isAccessGranted, isComposing, isDirty, selectedEvent.id]);

  useEffect(() => {
    if (!isAccessGranted || !isReferenceDirty || isComposing || referenceForm.id !== selectedReference.id) return;
    const timer = window.setTimeout(() => {
      const savedReference = writeArchiveReferenceDraft(referenceForm);
      setReferenceForm(savedReference);
      setVersion((current) => current + 1);
      setLastLocalSavedAt(new Date().toISOString());
      setSyncStatus(`자료 수정 자동 보관됨 / ${timeLabel()}`);
    }, 1_800);
    return () => window.clearTimeout(timer);
  }, [isAccessGranted, isComposing, isReferenceDirty, referenceForm, selectedReference.id]);

  useEffect(() => {
    if (!isAccessGranted || !isTextDirty || isComposing) return;
    const timer = window.setTimeout(() => {
      writeSiteTextDraft(siteTextForm);
      setLastLocalSavedAt(new Date().toISOString());
      setSyncStatus(`문구 수정 자동 보관됨 / ${timeLabel()}`);
    }, 1_800);
    return () => window.clearTimeout(timer);
  }, [isAccessGranted, isComposing, isTextDirty, siteTextForm]);

  useEffect(() => {
    if (!isAccessGranted) return;
    const preserveLastChanges = () => {
      if (isDirty) {
        writeArchiveDraft(selectedEvent.id, toDraft(form), { label: 'automatic local draft', recordRevision: false });
      }
      if (isReferenceDirty && referenceForm.id === selectedReference.id) writeArchiveReferenceDraft(referenceForm);
      if (isTextDirty) writeSiteTextDraft(siteTextForm);
    };
    window.addEventListener('pagehide', preserveLastChanges);
    return () => window.removeEventListener('pagehide', preserveLastChanges);
  }, [form, isAccessGranted, isDirty, isReferenceDirty, isTextDirty, referenceForm, selectedEvent.id, selectedReference.id, siteTextForm]);

  useEffect(() => {
    if (!isAccessGranted || (!isDirty && !isReferenceDirty && !isTextDirty)) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [isAccessGranted, isDirty, isReferenceDirty, isTextDirty]);

  async function enterKeeperDesk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!serverKey.trim()) {
      setAccessStatus('Keeper pass key를 입력하세요.');
      return;
    }
    try {
      setAccessStatus('입장 인장을 확인하는 중');
      await authenticateRole('archive-editor', serverKey.trim());
      setServerKey('');
      setIsAccessGranted(true);
      setAccessStatus('Keeper Desk 입장이 확인되었습니다.');
    } catch (error) {
      if (import.meta.env.DEV) {
        setServerKey('');
        setIsAccessGranted(true);
        setAccessStatus('로컬 미리보기 입장 / 공동 장부 기능은 배포 환경에서 확인합니다.');
        return;
      }
      const message = error instanceof Error ? error.message : '';
      setAccessStatus(message === 'role_key_required' || message === 'sync_auth_required'
        ? 'pass key가 맞지 않습니다.'
        : '입장 인장을 확인할 수 없습니다. 잠시 뒤 다시 시도하세요.');
    }
  }

  function leaveKeeperDesk() {
    clearRoleSession('archive-editor');
    setIsAccessGranted(false);
    initialArchiveLoad.current = false;
    setAccessStatus('Keeper Desk에서 나왔습니다. 다시 들어오려면 pass key가 필요합니다.');
  }

  function persistReferenceForm(nextForm: ReferenceFormState = referenceForm) {
    const normalizedReference: ArchiveReference = {
      ...nextForm,
      id: nextForm.id.trim(),
      kind: nextForm.kind.trim(),
      title: nextForm.title.trim(),
      description: nextForm.description.trim(),
      updatedAt: new Date().toISOString(),
      deletedAt: undefined,
    };
    const originalId = selectedReference.id;
    const validation = validateReferenceForm(normalizedReference, referenceRecords, originalId);
    if (validation) {
      setSyncStatus(`입력 확인 / ${validation}`);
      return null;
    }

    if (normalizedReference.id === originalId) {
      const savedReference = writeArchiveReferenceDraft(normalizedReference);
      setReferenceForm(savedReference);
      return savedReference;
    }

    const now = new Date().toISOString();
    const nextReferences = readArchiveReferenceDrafts();
    delete nextReferences[originalId];
    if (archiveReferences.some((reference) => reference.id === originalId)) {
      nextReferences[originalId] = {
        ...selectedReference,
        id: originalId,
        deletedAt: now,
        updatedAt: now,
      };
    }
    referenceRecords.forEach((reference) => {
      if (reference.id === originalId || reference.parentId !== originalId) return;
      nextReferences[reference.id] = {
        ...reference,
        parentId: normalizedReference.id,
        updatedAt: now,
      };
    });
    nextReferences[normalizedReference.id] = normalizedReference;
    writeArchiveReferenceDrafts(nextReferences);

    const nextDrafts = readArchiveDrafts();
    archiveEvents.forEach((record) => {
      if (!record.referenceIds.includes(originalId)) return;
      nextDrafts[record.id] = {
        ...nextDrafts[record.id],
        referenceIds: Array.from(new Set(record.referenceIds.map((id) => (
          id === originalId ? normalizedReference.id : id
        )))),
        updatedAt: now,
      };
    });
    writeArchiveDrafts(nextDrafts);

    setForm((current) => ({
      ...current,
      referenceIdsText: splitDraftList(current.referenceIdsText).map((id) => (
        id === originalId ? normalizedReference.id : id
      )).join(' / '),
    }));
    setPreferences((current) => ({
      ...current,
      favouriteReferences: Array.from(new Set(current.favouriteReferences.map((id) => (
        id === originalId ? normalizedReference.id : id
      )))),
      recentItems: current.recentItems.map((item) => (
        item.kind === 'reference' && item.id === originalId
          ? { ...item, id: normalizedReference.id }
          : item
      )),
    }));
    setSelectedReferenceBatchIds((current) => current.map((id) => (
      id === originalId ? normalizedReference.id : id
    )));
    setSelectedReferenceId(normalizedReference.id);
    setReferenceForm(normalizedReference);
    recordArchiveAudit({
      action: 'edit',
      targetType: 'reference',
      targetId: normalizedReference.id,
      title: normalizedReference.title,
      detail: `자료 ID 변경: ${originalId} → ${normalizedReference.id}`,
    });
    return normalizedReference;
  }

  function selectEvent(event: ArchiveEvent) {
    if (isDirty) {
      writeArchiveDraft(selectedEvent.id, toDraft(form), { label: 'automatic local draft', recordRevision: false });
      setVersion((current) => current + 1);
    }
    setSelectedId(event.id);
    setForm(toFormState(event));
    setOperationError('');
    programmeUndo.current = [];
    programmeRedo.current = [];
    setPreferences((current) => withRecentItem(current, 'programme', event.id));
    window.requestAnimationFrame(() => editorRef.current?.scrollIntoView({ block: 'start' }));
  }

  function selectReference(reference: ArchiveReference) {
    if (isReferenceDirty) {
      const saved = persistReferenceForm();
      if (!saved) return;
      setVersion((current) => current + 1);
    }
    setSelectedReferenceId(reference.id);
    setReferenceForm(toReferenceForm(reference));
    setOperationError('');
    referenceUndo.current = [];
    referenceRedo.current = [];
    setPreferences((current) => withRecentItem(current, 'reference', reference.id));
    window.requestAnimationFrame(() => editorRef.current?.scrollIntoView({ block: 'start' }));
  }

  function openKeeperItem(kind: KeeperItemKind, id: string) {
    if (kind === 'programme') {
      const record = archiveEvents.find((event) => event.id === id);
      if (!record) return;
      changeMode('events');
      selectEvent(record);
    } else {
      const reference = referenceRecords.find((entry) => entry.id === id);
      if (!reference) return;
      changeMode('references');
      selectReference(reference);
    }
    setCommandOpen(false);
    setCommandQuery('');
  }

  function toggleFavourite(kind: KeeperItemKind, id: string) {
    setPreferences((current) => {
      const key = kind === 'programme' ? 'favouriteProgrammes' : 'favouriteReferences';
      const values = current[key];
      return { ...current, [key]: values.includes(id) ? values.filter((value) => value !== id) : [...values, id] };
    });
  }

  function changeMode(nextMode: 'events' | 'references' | 'text') {
    if (mode === 'events' && isDirty) {
      writeArchiveDraft(selectedEvent.id, toDraft(form), { label: 'automatic local draft', recordRevision: false });
    }
    if (mode === 'references' && isReferenceDirty && !persistReferenceForm()) return;
    if (mode === 'text' && isTextDirty) writeSiteTextDraft(siteTextForm);
    setMode(nextMode);
    setListQuery('');
    setWorkflowFilter('all');
    setVisibilityFilter('all');
    setKindFilter('all');
    setVersion((current) => current + 1);
  }

  function updateReferenceField<Key extends keyof ReferenceFormState>(key: Key, value: ReferenceFormState[Key]) {
    setOperationError('');
    setReferenceForm((current) => {
      referenceUndo.current = [...referenceUndo.current.slice(-49), current];
      referenceRedo.current = [];
      return { ...current, [key]: value };
    });
  }

  function saveReferenceDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveCurrentDraft();
  }

  function createNewReference() {
    const nextId = makeRecordId('new-reference');
    const nextReference: ArchiveReference = {
      id: nextId,
      kind: 'book',
      title: '아직 이름 붙지 않은 자료',
      description: '이 자료가 프로그램과 어떻게 연결되는지 기록하세요.',
    };
    const savedReference = writeArchiveReferenceDraft(nextReference);
    setSelectedReferenceId(nextId);
    setReferenceForm(toReferenceForm(savedReference));
    recordArchiveAudit({ action: 'create', targetType: 'reference', targetId: nextId, title: savedReference.title });
    setLastLocalSavedAt(new Date().toISOString());
    setVersion((current) => current + 1);
    setSyncStatus('새 자료를 이 기기에 임시 저장했습니다');
  }

  function duplicateReferenceRecord(reference: ArchiveReference) {
    const nextId = makeRecordId(`${reference.title}-copy`);
    const savedReference = writeArchiveReferenceDraft({
      ...reference,
      id: nextId,
      title: `${reference.title} 복제본`,
      updatedAt: new Date().toISOString(),
      deletedAt: undefined,
    });
    setSelectedReferenceId(nextId);
    setReferenceForm(toReferenceForm(savedReference));
    setPreferences((current) => withRecentItem(current, 'reference', nextId));
    recordArchiveAudit({ action: 'duplicate', targetType: 'reference', targetId: nextId, title: savedReference.title, detail: `원본 ${reference.title}` });
    setVersion((current) => current + 1);
    setLastLocalSavedAt(new Date().toISOString());
    setSyncStatus('자료 복제본을 만들었습니다');
  }

  function discardReferenceChanges() {
    setReferenceForm(toReferenceForm(selectedReference));
    referenceUndo.current = [];
    referenceRedo.current = [];
    setSyncStatus('저장하지 않은 자료 수정을 되돌렸습니다');
  }

  function updateField<Key extends keyof KeeperFormState>(key: Key, value: KeeperFormState[Key]) {
    setOperationError('');
    setForm((current) => {
      programmeUndo.current = [...programmeUndo.current.slice(-49), current];
      programmeRedo.current = [];
      return { ...current, [key]: value };
    });
  }

  function updateJourneyStep(index: number, value: string) {
    const steps = journeyStepsFromText(form.passageText);
    steps[index] = value;
    updateField('passageText', steps.join('\n'));
  }

  function addJourneyStep() {
    const steps = journeyStepsFromText(form.passageText);
    updateField('passageText', [...steps, `새 단계 ${steps.length + 1}`].join('\n'));
  }

  function moveJourneyStep(index: number, direction: -1 | 1) {
    const steps = journeyStepsFromText(form.passageText);
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    [steps[index], steps[target]] = [steps[target], steps[index]];
    updateField('passageText', steps.join('\n'));
  }

  function removeJourneyStep(index: number) {
    const steps = journeyStepsFromText(form.passageText);
    if (steps.length <= 1) {
      setSyncStatus('여정 단계는 하나 이상 남겨 주세요');
      return;
    }
    updateField('passageText', steps.filter((_, stepIndex) => stepIndex !== index).join('\n'));
  }

  function persistUploadedProgrammeImage(nextForm: KeeperFormState, label: string, localPreview: boolean) {
    programmeUndo.current = [...programmeUndo.current.slice(-49), formRef.current];
    programmeRedo.current = [];
    formRef.current = nextForm;
    setForm(nextForm);
    writeArchiveDraft(selectedEvent.id, toDraft(nextForm), {
      label: `${label} upload`,
      recordRevision: false,
    });
    removeKeeperProgrammeWorkingCopy(selectedEvent.id);
    setWorkingCopyVersion((current) => current + 1);
    setVersion((current) => current + 1);
    const savedAt = new Date().toISOString();
    setLastLocalSavedAt(savedAt);
    setSyncStatus(localPreview
      ? `${label} 로컬 미리보기와 프로그램 임시 저장 완료`
      : `${label} 업로드와 프로그램 임시 저장 완료 / 변경 게시하면 공개됩니다`);
  }

  async function replacePendingUpload(
    pendingRef: { current: string | null },
    nextUrl: string | null,
  ) {
    const previousUrl = pendingRef.current;
    pendingRef.current = nextUrl;
    if (!previousUrl || previousUrl === nextUrl) return;
    const authSession = roleSessionToken('archive-editor');
    if (!authSession) return;
    try {
      await discardUploadedMedia(previousUrl, '', authSession);
    } catch (error) {
      console.warn('Unshared archive image cleanup deferred:', error);
    }
  }

  async function settlePendingUploads(payload: ArchiveSyncPayload) {
    const draftRecords = Object.values(payload.drafts ?? {});
    const referenceRecords = Object.values(payload.references ?? {});
    const payloadUses = (url: string) => (
      draftRecords.some((draft) => draft.posterImage === url || draft.detailImage === url)
      || referenceRecords.some((reference) => reference.imageUrl === url)
    );
    for (const pendingRef of [pendingPosterUploadRef, pendingDetailUploadRef, pendingReferenceUploadRef]) {
      if (!pendingRef.current) continue;
      if (payloadUses(pendingRef.current)) pendingRef.current = null;
      else await replacePendingUpload(pendingRef, null);
    }
  }

  function togglePrimaryTheme(theme: string) {
    const selectedThemes = splitDraftList(form.primaryThemesText);
    const exists = selectedThemes.some((item) => item.toLocaleLowerCase('en-US') === theme.toLocaleLowerCase('en-US'));
    updateField('primaryThemesText', (exists
      ? selectedThemes.filter((item) => item.toLocaleLowerCase('en-US') !== theme.toLocaleLowerCase('en-US'))
      : [...selectedThemes, theme]
    ).join(' / '));
  }

  function addPrimaryTheme() {
    const theme = newPrimaryTheme.trim();
    if (!theme) return;
    const selectedThemes = splitDraftList(form.primaryThemesText);
    if (!selectedThemes.some((item) => item.toLocaleLowerCase('en-US') === theme.toLocaleLowerCase('en-US'))) {
      updateField('primaryThemesText', [...selectedThemes, theme].join(' / '));
    }
    setNewPrimaryTheme('');
    setSyncStatus(`메인 주제 ${theme} 추가됨 / 프로그램을 저장하면 반영됩니다`);
  }

  function createInlineCollection() {
    const title = inlineCollectionTitle.trim();
    if (!title) {
      setSyncStatus('컬렉션 이름을 입력하세요');
      return;
    }

    const existingCollection = collectionRecords.find((collection) => (
      collection.title.toLocaleLowerCase('ko-KR') === title.toLocaleLowerCase('ko-KR')
    ));
    const collection = existingCollection ?? {
      id: makeCollectionId(title, collectionRecords),
      title,
      description: inlineCollectionDescription.trim() || `${title}에 속한 프로그램`,
      eventIds: [],
      themeIds: [],
      visibility: inlineCollectionVisibility,
    };

    if (!existingCollection) writeArchiveCollectionDraft(collection);
    if (!existingCollection) {
      recordArchiveAudit({
        action: 'create',
        targetType: 'archive',
        targetId: collection.id,
        title: collection.title,
        detail: '편집 화면에서 컬렉션 즉시 추가',
      });
    }
    const selectedIds = splitDraftList(form.collectionIdsText);
    if (!selectedIds.includes(collection.id)) {
      updateField('collectionIdsText', [...selectedIds, collection.id].join(' / '));
    }
    setInlineCollectionTitle('');
    setInlineCollectionDescription('');
    setInlineCollectionVisibility('public');
    setInlineCollectionOpen(false);
    setLastLocalSavedAt(new Date().toISOString());
    setVersion((current) => current + 1);
    setSyncStatus(existingCollection
      ? `기존 컬렉션 “${collection.title}”을 선택했습니다`
      : `컬렉션 “${collection.title}”을 만들고 현재 프로그램에 연결했습니다`);
  }

  function updateSiteTextField(key: keyof SiteText, value: string) {
    setOperationError('');
    setSiteTextForm((current) => {
      textUndo.current = [...textUndo.current.slice(-49), current];
      textRedo.current = [];
      return { ...current, [key]: value };
    });
  }

  function undoCurrent() {
    if (mode === 'events') {
      const previous = programmeUndo.current.pop();
      if (!previous) return;
      programmeRedo.current.push(form);
      setForm(previous);
    } else if (mode === 'references') {
      const previous = referenceUndo.current.pop();
      if (!previous) return;
      referenceRedo.current.push(referenceForm);
      setReferenceForm(previous);
    } else {
      const previous = textUndo.current.pop();
      if (!previous) return;
      textRedo.current.push(siteTextForm);
      setSiteTextForm(previous);
    }
    setSyncStatus('한 단계 되돌렸습니다');
  }

  function redoCurrent() {
    if (mode === 'events') {
      const next = programmeRedo.current.pop();
      if (!next) return;
      programmeUndo.current.push(form);
      setForm(next);
    } else if (mode === 'references') {
      const next = referenceRedo.current.pop();
      if (!next) return;
      referenceUndo.current.push(referenceForm);
      setReferenceForm(next);
    } else {
      const next = textRedo.current.pop();
      if (!next) return;
      textUndo.current.push(siteTextForm);
      setSiteTextForm(next);
    }
    setSyncStatus('되돌린 수정을 다시 적용했습니다');
  }

  function beginOperation(operation: KeeperOperation) {
    if (activeOperationRef.current !== 'idle') return false;
    activeOperationRef.current = operation;
    setActiveOperation(operation);
    setOperationError('');
    return true;
  }

  function endOperation() {
    activeOperationRef.current = 'idle';
    setActiveOperation('idle');
  }

  function reportOperationError(message: string) {
    setOperationError(message);
    setSyncStatus(message);
  }

  async function saveCurrentDraft() {
    if (!beginOperation('saving')) return false;
    try {
      await Promise.resolve();
      if (mode === 'events') {
        writeArchiveDraft(selectedEvent.id, toDraft(form), { label: form.workflowStatus });
        removeKeeperProgrammeWorkingCopy(selectedEvent.id);
        setWorkingCopyVersion((current) => current + 1);
        recordArchiveAudit({ action: 'edit', targetType: 'programme', targetId: selectedEvent.id, title: form.title });
      } else if (mode === 'references') {
        const validation = validateReferenceForm(referenceForm, referenceRecords, selectedReference.id);
        if (validation) {
          reportOperationError(`임시 저장 실패 / ${validation}`);
          return false;
        }
        const savedReference = persistReferenceForm();
        if (!savedReference) {
          reportOperationError('임시 저장 실패 / 자료 내용을 다시 확인하세요');
          return false;
        }
        recordArchiveAudit({ action: 'edit', targetType: 'reference', targetId: savedReference.id, title: savedReference.title });
      } else {
        const validation = validateSiteTextForm(siteTextForm);
        if (validation) {
          reportOperationError(`임시 저장 실패 / ${validation}`);
          return false;
        }
        writeSiteTextDraft(siteTextForm);
        recordArchiveAudit({ action: 'edit', targetType: 'site-text', title: '공개 문구 장부' });
      }
      const savedAt = new Date().toISOString();
      setLastLocalSavedAt(savedAt);
      setVersion((current) => current + 1);
      setSyncStatus(`기기에 임시 저장됨 / ${timeLabel(new Date(savedAt))}`);
      return true;
    } catch (error) {
      console.error('Keeper local draft save failed:', error);
      reportOperationError('임시 저장 실패 / 기기 저장 공간을 확인한 뒤 다시 시도하세요');
      return false;
    } finally {
      endOperation();
    }
  }

  function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveCurrentDraft();
  }

  function saveSiteTextDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveCurrentDraft();
  }

  function discardSiteTextChanges() {
    setSiteTextForm(getSiteText());
    textUndo.current = [];
    textRedo.current = [];
    setSyncStatus('저장하지 않은 문구 수정을 되돌렸습니다');
  }

  function discardProgrammeChanges() {
    setForm(toFormState(selectedEvent));
    programmeUndo.current = [];
    programmeRedo.current = [];
    setSyncStatus('저장하지 않은 프로그램 수정을 되돌렸습니다');
  }

  function restoreProgrammeWorkingCopy(copy: KeeperProgrammeWorkingCopy) {
    const existing = archiveEvents.find((event) => event.id === copy.recordId);
    const restoredForm: KeeperFormState = {
      ...copy.form,
      posterImage: copy.form.posterImage || existing?.posterImage || events[0].posterImage,
      primaryThemesText: copy.form.primaryThemesText || existing?.primaryThemes.join(' / ') || defaultArchivePrimaryThemes[0],
    };
    writeArchiveDraft(copy.recordId, {
      ...toDraft(restoredForm, existing),
      ...(copy.isCustom ? { isCustom: true, createdAt: copy.savedAt } : {}),
    }, { label: 'automatic recovery copy' });
    setSelectedId(copy.recordId);
    setForm(restoredForm);
    setMode('events');
    setVersion((current) => current + 1);
    setSyncStatus(`자동 복구본을 불러왔습니다 / ${timeLabel(new Date(copy.savedAt))}`);
  }

  function removeProgrammeWorkingCopy(recordId: string) {
    removeKeeperProgrammeWorkingCopy(recordId);
    setWorkingCopyVersion((current) => current + 1);
    setSyncStatus('선택한 자동 복구본을 지웠습니다');
  }

  function createNewRecord() {
    const nextId = makeRecordId('Unwritten Folio');
    const template = templateId === 'blank' ? null : archiveEvents.find((event) => event.id === templateId);
    const blankDraft: ArchiveEventDraft = {
      kind: 'Lecture',
      visibility: 'private',
      workflowStatus: 'draft',
      seasonId: defaultArchiveSeasonId,
      collectionIds: [defaultArchiveCollectionId],
      edition: nextEditionLabel(archiveEvents),
      title: '아직 필사되지 않은 장',
      subtitle: 'A passage not yet named',
      latinQuote: 'Ad quaerendum',
      marginalia: '아직 이름 붙지 않은 여정의 첫 기록입니다.',
      date: '아직 필사되지 않은 장',
      status: 'upcoming',
      posterImage: events[0].posterImage,
      shortDescription: '아직 필사되지 않은 장의 짧은 설명을 입력하세요.',
      longDescription: '책, 이미지, 사물, 장소가 어떻게 하나의 여정으로 엮이는지 이곳에 기록합니다.',
      passage: ['부름', '통과', '귀환'],
      materials: ['book', 'image', 'note'],
      primaryThemes: ['Grail'],
      themes: ['Grail', 'Fragment', 'Passage'],
      referenceIds: [],
      relatedEventIds: [],
      location: '저보아 서클',
      ctaLabel: '기록 열기',
      ctaHref: `/archive/${nextId}/`,
      createdAt: new Date().toISOString(),
      isCustom: true,
    };
    const nextDraft: ArchiveEventDraft = template ? {
      ...toDraft(toFormState(template)),
      edition: nextEditionLabel(archiveEvents),
      title: `${template.title} 새 장`,
      visibility: 'private',
      workflowStatus: 'draft',
      status: 'upcoming',
      publishAt: undefined,
      unpublishAt: undefined,
      publishedAt: undefined,
      ctaHref: `/archive/${nextId}/`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isCustom: true,
    } : blankDraft;

    writeArchiveDraft(nextId, nextDraft, { label: 'new draft' });
    recordArchiveAudit({ action: 'create', targetType: 'programme', targetId: nextId, title: nextDraft.title ?? nextId });
    const nextEvents = applyArchiveDrafts(events);
    const nextEvent = nextEvents.find((event) => event.id === nextId) ?? nextEvents[0];
    setSelectedId(nextEvent.id);
    setForm(toFormState(nextEvent));
    setLastLocalSavedAt(new Date().toISOString());
    setVersion((current) => current + 1);
    setSyncStatus(template ? `“${template.title}”을 본떠 새 초안을 만들었습니다` : '새 프로그램을 임시 저장했습니다 / 모든 변경 공개 반영 전에는 공개되지 않습니다');
  }

  function duplicateRecord(record: ArchiveEvent) {
    const nextId = makeRecordId(`${record.title}-copy`);
    const nextDraft: ArchiveEventDraft = {
      ...toDraft(toFormState(record)),
      edition: nextEditionLabel(archiveEvents),
      title: `${record.title} 복제본`,
      visibility: 'private',
      workflowStatus: 'draft',
      status: 'upcoming',
      publishAt: undefined,
      unpublishAt: undefined,
      publishedAt: undefined,
      ctaHref: `/archive/${nextId}/`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isCustom: true,
    };
    writeArchiveDraft(nextId, nextDraft, { label: `duplicated from ${record.id}` });
    recordArchiveAudit({ action: 'duplicate', targetType: 'programme', targetId: nextId, title: nextDraft.title ?? nextId, detail: `원본 ${record.title}` });
    const duplicated = applyArchiveDrafts(events).find((event) => event.id === nextId);
    if (duplicated) selectEvent(duplicated);
    setLastLocalSavedAt(new Date().toISOString());
    setVersion((current) => current + 1);
    setSyncStatus('프로그램 복제본 생성됨 / 비공개 임시 저장으로 시작합니다');
  }

  function duplicateSelectedRecord() {
    const record = archiveEventFromForm(selectedEvent.id, form, selectedEvent);
    duplicateRecord(record);
  }

  function createSavedView() {
    const name = savedViewName.trim();
    if (!name) return setSyncStatus('저장할 보기의 이름을 입력하세요');
    const view: KeeperSavedView = {
      id: `${Date.now()}`,
      name,
      query: listQuery,
      workflow: workflowFilter,
      visibility: visibilityFilter,
      kind: kindFilter,
    };
    setPreferences((current) => ({ ...current, savedViews: [view, ...current.savedViews].slice(0, 12) }));
    setSavedViewName('');
    setSyncStatus(`“${name}” 보기를 저장했습니다`);
  }

  function applySavedView(view: KeeperSavedView) {
    setListQuery(view.query);
    setWorkflowFilter(view.workflow);
    setVisibilityFilter(view.visibility);
    setKindFilter(view.kind);
  }

  function deleteSavedView(id: string) {
    setPreferences((current) => ({ ...current, savedViews: current.savedViews.filter((view) => view.id !== id) }));
  }

  function toggleBatchRecord(id: string) {
    setSelectedBatchIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function toggleBatchReference(id: string) {
    setSelectedReferenceBatchIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function applyBatchEdit() {
    if (selectedBatchIds.length === 0) return;
    if (!batchWorkflow && !batchVisibility && !batchKind.trim()) return setSyncStatus('일괄 변경할 항목을 하나 이상 선택하세요');
    selectedBatchIds.forEach((id) => {
      const record = archiveEvents.find((event) => event.id === id);
      if (!record) return;
      writeArchiveDraft(id, {
        ...toDraft(toFormState(record)),
        ...(batchWorkflow ? { workflowStatus: batchWorkflow } : {}),
        ...(batchVisibility ? { visibility: batchVisibility } : {}),
        ...(batchKind.trim() ? { kind: batchKind.trim() } : {}),
        updatedAt: new Date().toISOString(),
      }, { label: 'batch edit', recordRevision: false });
      recordArchiveAudit({ action: 'edit', targetType: 'programme', targetId: id, title: record.title, detail: '일괄 편집' });
    });
    setSelectedBatchIds([]);
    setBatchWorkflow('');
    setBatchVisibility('');
    setBatchKind('');
    setVersion((current) => current + 1);
    setLastLocalSavedAt(new Date().toISOString());
    setSyncStatus(`${selectedBatchIds.length}개 프로그램을 함께 수정했습니다`);
  }

  function toggleRecordVisibility(record: ArchiveEvent) {
    const nextVisibility: ArchiveVisibility = record.visibility === 'public' ? 'private' : 'public';
    writeArchiveDraft(record.id, { ...toDraft(toFormState(record)), visibility: nextVisibility }, { label: 'quick visibility', recordRevision: false });
    if (record.id === selectedEvent.id) setForm((current) => ({ ...current, visibility: nextVisibility }));
    setVersion((current) => current + 1);
    setSyncStatus(`${record.title} / ${nextVisibility === 'public' ? '공개' : '비공개'}로 변경했습니다`);
  }

  function toggleEditorSection(section: KeeperEditorSection) {
    setCollapsedSections((current) => current.includes(section)
      ? current.filter((value) => value !== section)
      : [...current, section]);
  }

  async function applyMetadataSuggestion(target: 'reference' | 'inline') {
    const sourceUrl = target === 'reference' ? referenceForm.sourceUrl : inlineReferenceForm.sourceUrl;
    if (!sourceUrl) return setSyncStatus('먼저 원문 출처 URL을 입력하세요');
    const authSession = roleSessionToken('archive-editor');
    if (!authSession) return setSyncStatus('원문 정보 제안을 사용하려면 Keeper 입장을 다시 확인하세요');
    setMetadataBusy(true);
    try {
      const metadata = await suggestReferenceMetadata(sourceUrl, authSession);
      if (target === 'reference') {
        setReferenceForm((current) => ({
          ...current,
          sourceUrl: metadata.sourceUrl,
          title: current.title === '아직 이름 붙지 않은 자료' ? metadata.title ?? current.title : current.title,
          description: current.description === '이 자료가 프로그램과 어떻게 연결되는지 기록하세요.' ? metadata.description ?? current.description : current.description,
          creator: current.creator || metadata.creator,
          attribution: current.attribution || metadata.attribution,
          date: current.date || metadata.date,
        }));
      } else {
        setInlineReferenceForm((current) => ({
          ...current,
          sourceUrl: metadata.sourceUrl,
          title: current.title || metadata.title || '',
          description: current.description || metadata.description || '',
          creator: current.creator || metadata.creator || '',
          attribution: current.attribution || metadata.attribution || '',
          date: current.date || metadata.date || '',
        }));
      }
      setSyncStatus('원문 페이지에서 제목과 서지 정보를 가져왔습니다');
    } catch {
      setSyncStatus('원문 정보를 자동으로 읽지 못했습니다 / 직접 입력할 수 있습니다');
    } finally {
      setMetadataBusy(false);
    }
  }

  function createInlineReference() {
    if (!inlineReferenceForm.title.trim()) return setSyncStatus('새 자료의 제목을 입력하세요');
    const nextId = inlineReferenceForm.id.trim() || makeRecordId(inlineReferenceForm.title);
    const reference: ArchiveReference = {
      id: nextId,
      kind: inlineReferenceForm.kind.trim(),
      title: inlineReferenceForm.title.trim(),
      description: inlineReferenceForm.description.trim() || `${form.title}에서 함께 읽는 자료입니다.`,
      sourceUrl: inlineReferenceForm.sourceUrl.trim() || undefined,
      creator: inlineReferenceForm.creator.trim() || undefined,
      attribution: inlineReferenceForm.attribution.trim() || undefined,
      date: inlineReferenceForm.date.trim() || undefined,
      rights: inlineReferenceForm.rights.trim() || undefined,
      altText: inlineReferenceForm.altText.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };
    const validation = validateReferenceForm(reference, referenceRecords, '');
    if (validation) return setSyncStatus(`입력 확인 / ${validation}`);
    writeArchiveReferenceDraft(reference);
    updateField('referenceIdsText', [...splitDraftList(form.referenceIdsText), nextId].join(' / '));
    recordArchiveAudit({ action: 'create', targetType: 'reference', targetId: nextId, title: reference.title, detail: `프로그램 ${form.title}에서 생성` });
    setInlineReferenceForm(emptyInlineReference);
    setInlineReferenceOpen(false);
    setVersion((current) => current + 1);
    setSyncStatus('새 자료를 만들고 이 프로그램에 연결했습니다');
  }

  async function resolveArchiveAuth() {
    const existingSession = roleSessionToken('archive-editor');
    if (existingSession) {
      return { authSession: existingSession, syncKey: '' };
    }

    if (!serverKey.trim()) {
      return { authSession: null, syncKey: '' };
    }

    try {
      const session = await authenticateRole('archive-editor', serverKey);
      setSyncStatus('아카이브 편집자 역할 확인됨');
      return { authSession: session.session, syncKey: '' };
    } catch (error) {
      if (error instanceof Error && error.message === 'role_auth_not_configured') {
        setSyncStatus('역할 열쇠 미설정 / 공동 장부 열쇠로 시도');
      }
      return { authSession: null, syncKey: serverKey };
    }
  }

  function requestDeleteRecord() {
    if (archiveEvents.length <= 1) {
      setSyncStatus('마지막 프로그램은 삭제할 수 없습니다 / 먼저 새 프로그램을 만든 뒤 다시 시도하세요');
      return;
    }
    const inboundLinks = archiveEvents.filter((record) => record.id !== selectedEvent.id && record.relatedEventIds.includes(selectedEvent.id));
    const publicationCount = selectedPublications.length;
    const impactSummary = [
      inboundLinks.length > 0 ? `다른 프로그램 ${inboundLinks.length}개의 연결이 정리됩니다` : '다른 프로그램의 연결은 없습니다',
      publicationCount > 0 ? `발행 이력 ${publicationCount}개는 감사 기록으로 남습니다` : '발행 이력은 없습니다',
    ].join(' · ');
    setPendingAction({ kind: 'delete-record', id: selectedEvent.id, title: selectedEvent.title, impactSummary });
  }

  function requestDeleteReference() {
    if (referenceRecords.length <= 1) {
      setSyncStatus('마지막 자료는 삭제할 수 없습니다 / 먼저 새 자료를 만든 뒤 다시 시도하세요');
      return;
    }
    const programmes = archiveEvents.filter((record) => record.referenceIds.includes(selectedReference.id));
    const children = referenceRecords.filter((reference) => reference.parentId === selectedReference.id);
    const impactSummary = [
      programmes.length > 0 ? `프로그램 ${programmes.length}개의 자료 연결이 정리됩니다` : '프로그램 연결은 없습니다',
      children.length > 0 ? `하위 자료 ${children.length}개의 상위 원전 연결이 풀립니다` : '하위 자료 연결은 없습니다',
    ].join(' · ');
    setPendingAction({ kind: 'delete-reference', id: selectedReference.id, title: selectedReference.title, impactSummary });
  }

  function requestDeleteSelectedRecords() {
    const selectedRecords = archiveEvents.filter((record) => selectedBatchIds.includes(record.id));
    if (selectedRecords.length === 0) return;
    if (selectedRecords.length >= archiveEvents.length) {
      setSyncStatus('모든 프로그램을 한 번에 삭제할 수 없습니다 / 기록 한 장은 남겨 주세요');
      return;
    }
    const selectedIds = new Set(selectedRecords.map((record) => record.id));
    const inboundLinks = archiveEvents.filter((record) => (
      !selectedIds.has(record.id)
      && record.relatedEventIds.some((relatedId) => selectedIds.has(relatedId))
    ));
    const publications = readArchivePublications();
    const publicationCount = selectedRecords.reduce((count, record) => count + (publications[record.id]?.length ?? 0), 0);
    const impactSummary = [
      inboundLinks.length > 0 ? `남는 프로그램 ${inboundLinks.length}개의 연결이 정리됩니다` : '다른 프로그램의 연결은 없습니다',
      publicationCount > 0 ? `발행 이력 ${publicationCount}개는 감사 기록으로 남습니다` : '발행 이력은 없습니다',
    ].join(' · ');
    setPendingAction({
      kind: 'delete-records',
      ids: selectedRecords.map((record) => record.id),
      titles: selectedRecords.map((record) => record.title),
      impactSummary,
    });
  }

  function requestDeleteSelectedReferences() {
    const selectedReferences = referenceRecords.filter((reference) => selectedReferenceBatchIds.includes(reference.id));
    if (selectedReferences.length === 0) return;
    if (selectedReferences.length >= referenceRecords.length) {
      setSyncStatus('모든 자료를 한 번에 삭제할 수 없습니다 / 자료 한 장은 남겨 주세요');
      return;
    }
    const selectedIds = new Set(selectedReferences.map((reference) => reference.id));
    const programmes = archiveEvents.filter((record) => record.referenceIds.some((referenceId) => selectedIds.has(referenceId)));
    const children = referenceRecords.filter((reference) => reference.parentId && selectedIds.has(reference.parentId));
    const impactSummary = [
      programmes.length > 0 ? `프로그램 ${programmes.length}개의 자료 연결이 정리됩니다` : '프로그램 연결은 없습니다',
      children.length > 0 ? `하위 자료 ${children.length}개의 상위 원전 연결이 풀립니다` : '하위 자료 연결은 없습니다',
    ].join(' · ');
    setPendingAction({
      kind: 'delete-references',
      ids: selectedReferences.map((reference) => reference.id),
      titles: selectedReferences.map((reference) => reference.title),
      impactSummary,
    });
  }

  function performDeleteRecords(ids: string[]) {
    const targetIds = new Set(ids.filter((id) => archiveEvents.some((record) => record.id === id)));
    if (targetIds.size === 0) return;
    if (targetIds.has(selectedEvent.id) && isDirty) {
      writeArchiveDraft(selectedEvent.id, toDraft(form), { label: 'automatic local draft', recordRevision: false });
    }
    const nextDrafts = readArchiveDrafts();
    const now = new Date().toISOString();
    targetIds.forEach((id) => {
      nextDrafts[id] = {
        ...nextDrafts[id],
        deletedAt: now,
        updatedAt: now,
      };
    });
    archiveEvents.forEach((record) => {
      if (targetIds.has(record.id) || !record.relatedEventIds.some((relatedId) => targetIds.has(relatedId))) return;
      nextDrafts[record.id] = {
        ...nextDrafts[record.id],
        relatedEventIds: record.relatedEventIds.filter((relatedId) => !targetIds.has(relatedId)),
        updatedAt: now,
      };
    });
    writeArchiveDrafts(nextDrafts);
    targetIds.forEach((id) => removeKeeperProgrammeWorkingCopy(id));
    setWorkingCopyVersion((current) => current + 1);
    archiveEvents.filter((record) => targetIds.has(record.id)).forEach((record) => {
      recordArchiveAudit({ action: 'delete', targetType: 'programme', targetId: record.id, title: record.title });
    });
    const remaining = applyArchiveDrafts(events);
    const nextRecord = remaining.find((record) => record.id === selectedEvent.id) ?? remaining[0];
    if (nextRecord && targetIds.has(selectedEvent.id)) {
      setSelectedId(nextRecord.id);
      setForm(toFormState(nextRecord));
    }
    setSelectedBatchIds([]);
    setVersion((current) => current + 1);
    setLastLocalSavedAt(now);
    setSyncStatus(`${targetIds.size}개 프로그램이 삭제 보관함으로 옮겨졌습니다 / 모든 변경 공개 반영 후 메인에서도 사라집니다`);
  }

  function performDeleteRecord(id: string) {
    performDeleteRecords([id]);
  }

  function performDeleteReferences(ids: string[]) {
    let requestedIds = ids;
    if (ids.includes(selectedReference.id) && isReferenceDirty) {
      const savedReference = persistReferenceForm();
      if (!savedReference) return;
      requestedIds = ids.map((id) => id === selectedReference.id ? savedReference.id : id);
    }
    const targetIds = new Set(requestedIds.filter((id) => (
      applyArchiveReferenceDrafts(archiveReferences).some((reference) => reference.id === id)
    )));
    if (targetIds.size === 0) return;
    const currentReferences = applyArchiveReferenceDrafts(archiveReferences);
    const nextReferences = readArchiveReferenceDrafts();
    const now = new Date().toISOString();

    currentReferences.forEach((reference) => {
      if (targetIds.has(reference.id)) {
        nextReferences[reference.id] = {
          ...reference,
          ...nextReferences[reference.id],
          deletedAt: now,
          updatedAt: now,
        };
      } else if (reference.parentId && targetIds.has(reference.parentId)) {
        nextReferences[reference.id] = {
          ...reference,
          ...nextReferences[reference.id],
          parentId: undefined,
          updatedAt: now,
        };
      }
    });
    writeArchiveReferenceDrafts(nextReferences);

    const nextDrafts = readArchiveDrafts();
    archiveEvents.forEach((record) => {
      if (!record.referenceIds.some((referenceId) => targetIds.has(referenceId))) return;
      nextDrafts[record.id] = {
        ...nextDrafts[record.id],
        referenceIds: record.referenceIds.filter((referenceId) => !targetIds.has(referenceId)),
        updatedAt: now,
      };
    });
    writeArchiveDrafts(nextDrafts);
    setForm((current) => ({
      ...current,
      referenceIdsText: splitDraftList(current.referenceIdsText)
        .filter((referenceId) => !targetIds.has(referenceId))
        .join(' / '),
    }));
    currentReferences.filter((reference) => targetIds.has(reference.id)).forEach((reference) => {
      recordArchiveAudit({ action: 'delete', targetType: 'reference', targetId: reference.id, title: reference.title });
    });

    const remaining = applyArchiveReferenceDrafts(archiveReferences);
    const nextReference = remaining.find((reference) => reference.id === selectedReference.id) ?? remaining[0];
    if (nextReference && targetIds.has(selectedReference.id)) {
      setSelectedReferenceId(nextReference.id);
      setReferenceForm(toReferenceForm(nextReference));
    }
    setSelectedReferenceBatchIds([]);
    setVersion((current) => current + 1);
    setLastLocalSavedAt(now);
    setSyncStatus(`${targetIds.size}개 자료가 삭제 보관함으로 옮겨지고 프로그램 연결이 정리되었습니다 / 모든 변경 공개 반영 후 방문자에게 적용됩니다`);
  }

  function performDeleteReference(id: string) {
    performDeleteReferences([id]);
  }

  function restoreDeletedRecord(id: string) {
    restoreDeletedArchiveDraft(id);
    const restored = applyArchiveDrafts(events).find((event) => event.id === id);
    if (restored) {
      setSelectedId(restored.id);
      setForm(toFormState(restored));
    }
    recordArchiveAudit({ action: 'restore', targetType: 'programme', targetId: id, title: restored?.title ?? id });
    setVersion((current) => current + 1);
    setSyncStatus('삭제한 프로그램을 복원했습니다 / 관계 연결은 필요하면 다시 선택하세요');
  }

  function restoreDeletedReference(id: string) {
    restoreDeletedArchiveReferenceDraft(id);
    const restored = applyArchiveReferenceDrafts(archiveReferences).find((reference) => reference.id === id);
    if (restored) {
      setSelectedReferenceId(restored.id);
      setReferenceForm(toReferenceForm(restored));
    }
    recordArchiveAudit({ action: 'restore', targetType: 'reference', targetId: id, title: restored?.title ?? id });
    setVersion((current) => current + 1);
    setSyncStatus('삭제한 자료를 복원했습니다 / 프로그램 연결은 필요하면 다시 선택하세요');
  }

  function createArchiveSyncPayload(overrides: Partial<ArchiveSyncPayload> = {}): ArchiveSyncPayload {
    const drafts = overrides.drafts ?? {
      ...readArchiveDrafts(),
      ...(mode === 'events' ? { [selectedEvent.id]: toDraft(formRef.current) } : {}),
    };
    return {
      schemaVersion: 3 as const,
      drafts,
      collections: overrides.collections ?? readArchiveCollectionDrafts(),
      siteText: overrides.siteText ?? siteTextForm,
      references: overrides.references ?? {
        ...readArchiveReferenceDrafts(),
        ...(isReferenceDirty ? { [referenceForm.id]: referenceForm } : {}),
      },
      publications: overrides.publications ?? readArchivePublications(),
      auditLog: overrides.auditLog ?? readArchiveAuditLog(),
    };
  }

  function applyArchivePayload(payload: ArchiveSyncPayload, savedAt?: string | null) {
    if (payload.drafts) writeArchiveDrafts(payload.drafts);
    if (payload.collections) writeArchiveCollectionDrafts(payload.collections);
    if (payload.siteText) {
      const nextSiteText = mergeSiteText(payload.siteText);
      writeSiteTextDraft(nextSiteText);
      setSiteTextForm(nextSiteText);
    }
    if (payload.references) writeArchiveReferenceDrafts(payload.references);
    if (payload.publications) writeArchivePublications(payload.publications);
    if (payload.auditLog) writeArchiveAuditLog(payload.auditLog);

    const nextEvents = applyArchiveDrafts(events);
    const requestedRecordId = new URLSearchParams(window.location.search).get('record');
    const nextSelected = nextEvents.find((event) => event.id === requestedRecordId)
      ?? nextEvents.find((event) => event.id === selectedId)
      ?? nextEvents[0];
    if (nextSelected) {
      setSelectedId(nextSelected.id);
      setForm(toFormState(nextSelected));
    }
    const nextReferences = applyArchiveReferenceDrafts(archiveReferences);
    const nextReference = nextReferences.find((reference) => reference.id === selectedReferenceId) ?? nextReferences[0];
    if (nextReference) {
      setSelectedReferenceId(nextReference.id);
      setReferenceForm(toReferenceForm(nextReference));
    }
    setArchiveSavedAt(savedAt ?? null);
    setLastLocalSavedAt(new Date().toISOString());
    setVersion((current) => current + 1);
  }

  async function prepareArchiveConflict(local: ArchiveSyncPayload, remoteSavedAt?: string | null) {
    try {
      const auth = await resolveArchiveAuth();
      const result = await loadServerSync<ArchiveSyncPayload>('archive', auth.syncKey, { authSession: auth.authSession });
      if (result.exists && result.saved?.data) {
        setConflictState({ local, remote: result.saved.data, remoteSavedAt: result.saved.savedAt });
        setArchiveSavedAt(result.saved.savedAt);
        setSyncStatus('현재 공개본과 이 기기의 임시 저장 내용이 다릅니다 / 아래에서 남길 내용을 선택하세요');
      } else {
        setArchiveSavedAt(remoteSavedAt ?? null);
      }
    } catch (error) {
      console.error('Archive conflict comparison failed:', error);
      setSyncStatus('충돌 비교를 열 수 없음 / 로컬 복구 파일을 먼저 받아두세요');
    }
  }

  async function resolveArchiveConflict() {
    if (!conflictState) return;
    const local = conflictState.local;
    const remote = conflictState.remote;
    const mergedAudit = [...(local.auditLog ?? []), ...(remote.auditLog ?? [])]
      .filter((entry, index, entries) => entries.findIndex((candidate) => candidate.id === entry.id) === index)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const merged = createArchiveSyncPayload({
      drafts: conflictChoices.drafts === 'local' ? local.drafts : remote.drafts,
      collections: conflictChoices.collections === 'local' ? local.collections : remote.collections,
      references: conflictChoices.references === 'local' ? local.references : remote.references,
      siteText: conflictChoices.siteText === 'local' ? local.siteText : remote.siteText,
      publications: mergePublicationMaps(remote.publications, local.publications),
      auditLog: mergedAudit,
    });
    recordArchiveAudit({ action: 'conflict-resolved', targetType: 'archive', title: '공동 장부 충돌 해결' });
    merged.auditLog = readArchiveAuditLog();

    try {
      const auth = await resolveArchiveAuth();
      setSyncStatus('선택한 내용으로 공개본을 정리하는 중');
      const result = await saveServerSync<ArchiveSyncPayload>('archive', merged, auth.syncKey, {
        baseSavedAt: conflictState.remoteSavedAt,
        authSession: auth.authSession,
      });
      applyArchivePayload(merged, result.savedAt);
      setSharedSnapshot(merged);
      await settlePendingUploads(merged);
      setConflictState(null);
      setHasArchiveConflict(false);
      setSyncStatus(`충돌 해결 후 공개 반영 완료 / ${timeLabel(result.savedAt ? new Date(result.savedAt) : new Date())}`);
    } catch (error) {
      console.error('Archive conflict resolution failed:', error);
      setSyncStatus('충돌 해결 실패 / 연결 상태를 확인한 뒤 다시 시도하세요');
    }
  }

  function captureArchiveRecovery(reason: string, remoteSavedAt?: string | null, payload = createArchiveSyncPayload()) {
    writeSyncRecovery('archive', payload, {
      baseSavedAt: archiveSavedAt,
      remoteSavedAt,
      reason,
    });
    setHasArchiveRecovery(true);
  }

  async function saveArchiveToServer() {
    if (!beginOperation('syncing')) return;
    try {
      const activeForm = formRef.current;
      const currentRecordWouldBePublic = activeForm.visibility === 'public' && activeForm.workflowStatus === 'published';
      const archiveValidation = (mode === 'events' || isDirty) && currentRecordWouldBePublic
        ? validateKeeperForm(activeForm, archiveEvents, referenceRecords, collectionRecords)
        : '';
      if (archiveValidation) {
        reportOperationError(`공동 장부 반영 실패 / ${archiveValidation}`);
        return;
      }
      const textValidation = mode === 'text' || isTextDirty ? validateSiteTextForm(siteTextForm) : '';
      if (textValidation) {
        reportOperationError(`공동 장부 반영 실패 / ${textValidation}`);
        return;
      }
      const referenceValidation = mode === 'references' || isReferenceDirty
        ? validateReferenceForm(referenceForm, referenceRecords, selectedReference.id)
        : '';
      if (referenceValidation) {
        reportOperationError(`공동 장부 반영 실패 / ${referenceValidation}`);
        return;
      }
      if (mode === 'events') {
        writeArchiveDraft(selectedEvent.id, toDraft(activeForm), { label: activeForm.workflowStatus });
      }
      setSyncStatus('모든 기기 저장본을 공동 장부에 반영하는 중');
      if (mode === 'text' || isTextDirty) {
        writeSiteTextDraft(siteTextForm);
      }
      if (mode === 'references' || isReferenceDirty) {
        if (!persistReferenceForm()) return;
      }

      const auth = await resolveArchiveAuth();
      if (!auth.syncKey && !auth.authSession) {
        setSyncStatus('공동 장부 또는 아카이브 편집자 열쇠 필요');
        return;
      }

      recordArchiveAudit({ action: 'sync', targetType: 'archive', title: '공동 장부 전체 반영', detail: syncStatus });
      const payload = createArchiveSyncPayload();
      const result = await saveServerSync<ArchiveSyncPayload>('archive', payload, auth.syncKey, {
        baseSavedAt: archiveSavedAt,
        authSession: auth.authSession,
      });
      setArchiveSavedAt(result.savedAt || archiveSavedAt);
      setSharedSnapshot(payload);
      await settlePendingUploads(payload);
      setLastLocalSavedAt(new Date().toISOString());
      setHasArchiveConflict(false);
      setConflictState(null);
      clearKeeperProgrammeWorkingCopies();
      setWorkingCopyVersion((current) => current + 1);
      setVersion((current) => current + 1);
      setSyncStatus(`공동 장부 전체 반영 완료 / ${timeLabel(result.savedAt ? new Date(result.savedAt) : new Date())}`);
    } catch (error) {
      if (error instanceof ServerSyncError && error.message === 'sync_conflict') {
        const local = createArchiveSyncPayload();
        captureArchiveRecovery('archive_sync_conflict', error.savedAt, local);
        setArchiveSavedAt(error.savedAt || archiveSavedAt);
        setHasArchiveConflict(true);
        void prepareArchiveConflict(local, error.savedAt);
        return;
      }
      console.error('Archive server save failed:', error);
      reportOperationError('공동 장부 전체 반영 실패 / 연결 상태를 확인하고 다시 시도하세요');
    } finally {
      endOperation();
    }
  }

  async function loadArchiveFromServer() {
    if (!beginOperation('loading')) return;
    try {
      setSyncStatus('공동 장부를 다시 불러오는 중');
      const auth = await resolveArchiveAuth();
      const result = await loadServerSync<ArchiveSyncPayload>('archive', auth.syncKey, {
        authSession: auth.authSession,
      });
      setHasArchiveConflict(false);
      if (result.exists && result.saved?.data) {
        const localDrafts = readArchiveDrafts();
        const localReferences = readArchiveReferenceDrafts();
        const localCollections = readArchiveCollectionDrafts();
        const remoteDrafts = result.saved.data.drafts ?? {};
        const remoteReferences = result.saved.data.references ?? {};
        const remoteCollections = result.saved.data.collections ?? {};
        const localOnlyDrafts = Object.fromEntries(Object.entries(localDrafts).filter(([id]) => !remoteDrafts[id]));
        const localOnlyReferences = Object.fromEntries(Object.entries(localReferences).filter(([id]) => !remoteReferences[id]));
        const localOnlyCollections = Object.fromEntries(Object.entries(localCollections).filter(([id]) => !remoteCollections[id]));
        const preservedLocalCount = Object.keys(localOnlyDrafts).length
          + Object.keys(localOnlyReferences).length
          + Object.keys(localOnlyCollections).length;
        applyArchivePayload({
          ...result.saved.data,
          drafts: { ...remoteDrafts, ...localOnlyDrafts },
          references: { ...remoteReferences, ...localOnlyReferences },
          collections: { ...remoteCollections, ...localOnlyCollections },
        }, result.saved.savedAt);
        setSharedSnapshot(result.saved.data);
        setConflictState(null);
        setSyncStatus(preservedLocalCount > 0
          ? `공동 장부 다시 불러오기 완료 / 이 기기의 미공유 기록 ${preservedLocalCount}개 유지됨`
          : `공동 장부 다시 불러오기 완료 / ${timeLabel(new Date(result.saved.savedAt))}`);
      } else {
        setArchiveSavedAt(null);
        setSyncStatus('불러올 공동 장부가 없습니다');
      }
    } catch (error) {
      console.error('Archive server load failed:', error);
      if (import.meta.env.DEV) {
        setOperationError('');
        setSyncStatus('로컬 미리보기 / 공동 장부는 배포 화면에서 확인합니다');
      } else {
        reportOperationError('공동 장부를 불러오지 못했습니다 / 연결 상태를 확인하고 다시 시도하세요');
      }
    } finally {
      endOperation();
    }
  }

  async function refreshOperations() {
    const authSession = roleSessionToken('archive-editor');
    if (!authSession) {
      setSyncStatus('운영 상태는 배포된 Keeper Desk에서 확인할 수 있습니다');
      return;
    }
    try {
      setOperationsBusy(true);
      const status = await loadArchiveOperationalStatus(authSession);
      setOperationsStatus(status);
      setSyncStatus(`운영 상태 확인됨 / ${timeLabel(new Date(status.checkedAt))}`);
    } catch (error) {
      console.error('Archive operational status failed:', error);
      setSyncStatus('운영 상태를 불러오지 못했습니다');
    } finally {
      setOperationsBusy(false);
    }
  }

  async function toggleOperations() {
    const nextVisible = !showOperations;
    setShowOperations(nextVisible);
    if (nextVisible) await refreshOperations();
  }

  async function runLinkCheck(urls: string[]) {
    const authSession = roleSessionToken('archive-editor');
    const validUrls = Array.from(new Set(urls.map((url) => url.trim()).filter(Boolean)));
    if (!authSession || validUrls.length === 0) {
      setSyncStatus(validUrls.length === 0 ? '확인할 원문 URL이 없습니다' : '링크 검사는 배포된 Keeper Desk에서 사용할 수 있습니다');
      return;
    }
    try {
      setOperationsBusy(true);
      setSyncStatus(`원문 링크 ${validUrls.length}개 확인 중`);
      const results = await checkArchiveLinks(authSession, validUrls);
      setLinkCheckResults(results);
      const failed = results.filter((result) => !result.ok).length;
      setSyncStatus(failed > 0 ? `원문 링크 ${failed}개 확인 필요` : `원문 링크 ${results.length}개 정상`);
    } catch (error) {
      console.error('Archive link check failed:', error);
      setSyncStatus('원문 링크를 확인하지 못했습니다');
    } finally {
      setOperationsBusy(false);
    }
  }

  function requestRestoreBackup(pathname: string, savedAt: string) {
    setPendingAction({ kind: 'restore-backup', pathname, title: savedAt });
  }

  async function performRestoreBackup(pathname: string) {
    const authSession = roleSessionToken('archive-editor');
    if (!authSession) {
      setSyncStatus('백업 복원은 배포된 Keeper Desk에서 사용할 수 있습니다');
      return;
    }
    try {
      setOperationsBusy(true);
      setSyncStatus('선택한 공동 장부 백업을 복원하는 중');
      await restoreArchiveBackup(authSession, pathname);
      recordArchiveAudit({ action: 'backup-restored', targetType: 'archive', title: '공동 장부 백업 복원', detail: pathname });
      await loadArchiveFromServer();
      await refreshOperations();
      setSyncStatus('공동 장부 백업을 복원했습니다 / 현재 내용을 확인하세요');
    } catch (error) {
      console.error('Archive backup restore failed:', error);
      setSyncStatus('공동 장부 백업을 복원하지 못했습니다');
    } finally {
      setOperationsBusy(false);
    }
  }

  function downloadArchiveDrafts() {
    const payload = {
      type: 'jerboa-archive-drafts',
      version: 3,
      exportedAt: new Date().toISOString(),
      drafts: readArchiveDrafts(),
      collections: readArchiveCollectionDrafts(),
      siteText: getSiteText(),
      references: readArchiveReferenceDrafts(),
      publications: readArchivePublications(),
      auditLog: readArchiveAuditLog(),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `jerboa-archive-drafts-${new Date().toISOString().slice(0, 16).replace(':', '')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importArchiveDrafts(file: File) {
    try {
      if (file.size > 6_000_000) throw new Error('파일이 6MB를 넘어 안전하게 확인할 수 없습니다.');
      const parsed = parseArchiveDraftImport(JSON.parse(await file.text()));
      const incoming: ArchiveSyncPayload = {
        drafts: parsed.drafts,
        collections: parsed.collections,
        siteText: parsed.siteText,
        references: parsed.references,
        publications: parsed.publications,
      };
      setPendingAction({ kind: 'import', ...parsed, diffSummary: importDiffSummary(currentPayload, incoming) });
      setSyncStatus(`초안 파일 검증됨 / 기록 ${parsed.recordCount}개 · 자료 ${parsed.referenceCount}개 · 발행본 ${parsed.publicationCount}개`);
    } catch (error) {
      console.error('Archive draft import failed:', error);
      setSyncStatus(error instanceof Error ? `초안 파일 적용 보류 / ${error.message}` : '초안 파일을 읽을 수 없음');
    }
  }

  function clearEveryDraft() {
    setPendingAction({ kind: 'clear' });
  }

  function performClearEveryDraft() {
    clearAllArchiveDrafts();
    clearArchiveCollectionDrafts();
    clearAllArchiveReferenceDrafts();
    clearKeeperProgrammeWorkingCopies();
    const baseEvent = events.find((event) => event.id === selectedId) ?? events[0];
    setSelectedId(baseEvent.id);
    setForm(toFormState(baseEvent));
    setSelectedReferenceId(archiveReferences[0].id);
    setReferenceForm(toReferenceForm(archiveReferences[0]));
    setWorkingCopyVersion((current) => current + 1);
    setLastLocalSavedAt(new Date().toISOString());
    setVersion((current) => current + 1);
    setSyncStatus('이 기기의 임시 저장 내용을 모두 삭제했습니다');
  }

  function restoreRevision(revisionId: string, title: string) {
    setPendingAction({ kind: 'restore', revisionId, title });
  }

  function performRestoreRevision(revisionId: string) {
    if (!restoreArchiveDraftRevision(selectedEvent.id, revisionId)) {
      setSyncStatus('되돌릴 초안 이력을 찾을 수 없음');
      return;
    }

    const nextEvent = applyArchiveDrafts(events).find((event) => event.id === selectedEvent.id) ?? selectedEvent;
    setForm(toFormState(nextEvent));
    recordArchiveAudit({ action: 'restore', targetType: 'programme', targetId: selectedEvent.id, title: nextEvent.title, detail: '초안 이력 복원' });
    setVersion((current) => current + 1);
    setSyncStatus('선택한 임시 저장본으로 되돌림 / 확인 후 모든 변경을 공개 반영하세요');
  }

  function restorePublication(publicationId: string, title: string, contentHash: string) {
    setPendingAction({ kind: 'restore-publication', publicationId, title, contentHash });
  }

  function performRestorePublication(publicationId: string) {
    const publication = selectedPublications.find((item) => item.id === publicationId);
    if (!publication) {
      setSyncStatus('복구할 발행본을 찾을 수 없음');
      return;
    }

    const restoredDraft = draftFromPublication(publication, selectedEvent.posterImage);
    writeArchiveDraft(selectedEvent.id, restoredDraft, { label: `publication recovery / ${publication.contentHash}` });
    const restoredEvent: ArchiveEvent = {
      ...selectedEvent,
      ...restoredDraft,
      collectionIds: restoredDraft.collectionIds ?? selectedEvent.collectionIds,
      passage: restoredDraft.passage ?? selectedEvent.passage,
      materials: restoredDraft.materials ?? selectedEvent.materials,
      themes: restoredDraft.themes ?? selectedEvent.themes,
      referenceIds: restoredDraft.referenceIds ?? selectedEvent.referenceIds,
      relatedEventIds: restoredDraft.relatedEventIds ?? selectedEvent.relatedEventIds,
    };
    setForm(toFormState(restoredEvent));
    recordArchiveAudit({ action: 'restore', targetType: 'programme', targetId: selectedEvent.id, title: publication.title, detail: `발행본 ${publication.contentHash}` });
    setVersion((current) => current + 1);
    setSyncStatus(`발행본 ${publication.contentHash}에서 복구 초안을 만들었습니다 / 비공개 미리보기 상태로 검토 후 다시 발행하세요`);
  }

  function requestPublication() {
    if (publicationErrorCount > 0) {
      setSyncStatus(`발행 보류 / 필수 확인 ${publicationErrorCount}개를 먼저 고치세요`);
      return;
    }
    const candidateManifest = createPublicationManifest(publicationCandidate, referenceRecords);
    if (selectedPublications.some((publication) => publication.contentHash === candidateManifest.contentHash)) {
      setSyncStatus(`동일 판본이 이미 발행되어 있습니다 / ${candidateManifest.contentHash}`);
      return;
    }
    setPendingAction({ kind: 'publish', title: publicationCandidate.title, warningCount: publicationWarningCount });
  }

  function requestUnpublication() {
    setPendingAction({ kind: 'unpublish', title: form.title || selectedEvent.title });
  }

  async function performPublication() {
    if (!beginOperation('publishing')) return;
    try {
    const validation = validateKeeperForm(form, archiveEvents, referenceRecords, collectionRecords);
    if (validation) {
      reportOperationError(`게시 실패 / ${validation}`);
      return;
    }
    const issues = inspectPublicationReadiness(publicationCandidate, archiveEvents, referenceRecords);
    const errors = issues.filter((issue) => issue.severity === 'error');
    if (errors.length > 0) {
      reportOperationError(`게시 실패 / ${errors[0].message}`);
      return;
    }

    const auth = await resolveArchiveAuth();
    if (!auth.syncKey && !auth.authSession) {
      setSyncStatus('판본 발행에는 공동 장부 또는 아카이브 편집자 열쇠가 필요합니다');
      return;
    }

    const manifest = createPublicationManifest(publicationCandidate, referenceRecords);
    if ((readArchivePublications()[selectedEvent.id] ?? []).some((publication) => publication.contentHash === manifest.contentHash)) {
      setSyncStatus(`동일 판본이 이미 발행되어 있습니다 / ${manifest.contentHash}`);
      return;
    }
    const nextPublications = publicationsWithManifest(readArchivePublications(), manifest);
    const publishedDraft: ArchiveEventDraft = {
      ...toDraft(form),
      visibility: 'public',
      workflowStatus: 'published',
      publishedAt: publicationCandidate.publishedAt,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    const nextDrafts = { ...readArchiveDrafts(), [selectedEvent.id]: publishedDraft };
    recordArchiveAudit({ action: 'publish', targetType: 'programme', targetId: selectedEvent.id, title: publicationCandidate.title, detail: manifest.contentHash });
    const payload = createArchiveSyncPayload({ drafts: nextDrafts, publications: nextPublications });

    try {
      setSyncStatus('발행본 검증과 공개 반영 중');
      const result = await saveServerSync<ArchiveSyncPayload>('archive', payload, auth.syncKey, {
        baseSavedAt: archiveSavedAt,
        authSession: auth.authSession,
      });
      writeArchiveDraft(selectedEvent.id, publishedDraft, { label: `published / ${manifest.contentHash}` });
      writeArchivePublications(nextPublications);
      removeKeeperProgrammeWorkingCopy(selectedEvent.id);
      setWorkingCopyVersion((current) => current + 1);
      setArchiveSavedAt(result.savedAt || archiveSavedAt);
      setSharedSnapshot(payload);
      await settlePendingUploads(payload);
      setLastLocalSavedAt(new Date().toISOString());
      setHasArchiveConflict(false);
      setConflictState(null);
      setForm(toFormState(publicationCandidate));
      setVersion((current) => current + 1);
      setSyncStatus(`판본 발행 완료 / ${manifest.contentHash} / ${timeLabel(result.savedAt ? new Date(result.savedAt) : new Date())}`);
    } catch (error) {
      if (error instanceof ServerSyncError && (error.message === 'sync_conflict' || error.message === 'publication_history_conflict')) {
        captureArchiveRecovery('publication_conflict', error.savedAt, payload);
        setArchiveSavedAt(error.savedAt || archiveSavedAt);
        setHasArchiveConflict(true);
        void prepareArchiveConflict(payload, error.savedAt);
        return;
      }
      console.error('Archive publication failed:', error);
      reportOperationError('게시 실패 / 입장 상태와 연결을 확인하고 다시 시도하세요');
    }
    } finally {
      endOperation();
    }
  }

  async function performUnpublication() {
    if (!beginOperation('unpublishing')) return;
    try {
      const auth = await resolveArchiveAuth();
      if (!auth.syncKey && !auth.authSession) {
        reportOperationError('게시 취소 실패 / 공동 장부 또는 아카이브 편집자 열쇠가 필요합니다');
        return;
      }

      const now = new Date();
      const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
      const nextForm: KeeperFormState = {
        ...form,
        visibility: 'private',
        workflowStatus: 'archived',
        unpublishAt: localNow,
      };
      const unpublishedDraft: ArchiveEventDraft = {
        ...toDraft(nextForm),
        updatedAt: now.toISOString(),
      };
      const nextDrafts = { ...readArchiveDrafts(), [selectedEvent.id]: unpublishedDraft };
      recordArchiveAudit({
        action: 'unpublish',
        targetType: 'programme',
        targetId: selectedEvent.id,
        title: nextForm.title,
        detail: '공개 목록과 상세 주소에서 게시 취소',
      });
      const payload = createArchiveSyncPayload({ drafts: nextDrafts });
      setSyncStatus('공개 목록과 상세 주소에서 게시를 내리는 중');
      const result = await saveServerSync<ArchiveSyncPayload>('archive', payload, auth.syncKey, {
        baseSavedAt: archiveSavedAt,
        authSession: auth.authSession,
      });

      writeArchiveDraft(selectedEvent.id, unpublishedDraft, { label: 'unpublished' });
      removeKeeperProgrammeWorkingCopy(selectedEvent.id);
      setWorkingCopyVersion((current) => current + 1);
      setArchiveSavedAt(result.savedAt || archiveSavedAt);
      setSharedSnapshot(payload);
      await settlePendingUploads(payload);
      setLastLocalSavedAt(now.toISOString());
      setHasArchiveConflict(false);
      setConflictState(null);
      setForm(nextForm);
      setVersion((current) => current + 1);
      setSyncStatus(`게시 취소 완료 / ${timeLabel(result.savedAt ? new Date(result.savedAt) : now)}`);
    } catch (error) {
      if (error instanceof ServerSyncError && error.message === 'sync_conflict') {
        const local = createArchiveSyncPayload();
        captureArchiveRecovery('unpublication_conflict', error.savedAt, local);
        setArchiveSavedAt(error.savedAt || archiveSavedAt);
        setHasArchiveConflict(true);
        void prepareArchiveConflict(local, error.savedAt);
        return;
      }
      console.error('Archive unpublication failed:', error);
      reportOperationError('게시 취소 실패 / 입장 상태와 연결을 확인하고 다시 시도하세요');
    } finally {
      endOperation();
    }
  }

  async function confirmPendingAction() {
    if (!pendingAction) return;
    if (pendingAction.kind === 'import') {
      writeArchiveDrafts(pendingAction.drafts);
      writeArchiveCollectionDrafts(pendingAction.collections);
      const importedSiteText = mergeSiteText(pendingAction.siteText);
      writeSiteTextDraft(importedSiteText);
      setSiteTextForm(importedSiteText);
      writeArchiveReferenceDrafts(pendingAction.references);
      writeArchivePublications(pendingAction.publications);
      writeArchiveAuditLog(pendingAction.auditLog);
      recordArchiveAudit({
        action: 'import',
        targetType: 'archive',
        title: '검증된 초안 파일 적용',
        detail: pendingAction.diffSummary,
      });
      const nextEvents = applyArchiveDrafts(events);
      const nextSelected = nextEvents.find((event) => event.id === selectedId) ?? nextEvents[0];
      setForm(toFormState(nextSelected));
      setVersion((current) => current + 1);
      setSyncStatus(`검증된 초안 파일 적용됨 / 기록 ${pendingAction.recordCount}개 · 컬렉션 ${pendingAction.collectionCount}개 · 자료 ${pendingAction.referenceCount}개 · 발행본 ${pendingAction.publicationCount}개`);
    } else if (pendingAction.kind === 'clear') {
      performClearEveryDraft();
    } else if (pendingAction.kind === 'publish') {
      await performPublication();
    } else if (pendingAction.kind === 'unpublish') {
      await performUnpublication();
    } else if (pendingAction.kind === 'delete-record') {
      performDeleteRecord(pendingAction.id);
    } else if (pendingAction.kind === 'delete-records') {
      performDeleteRecords(pendingAction.ids);
    } else if (pendingAction.kind === 'delete-reference') {
      performDeleteReference(pendingAction.id);
    } else if (pendingAction.kind === 'delete-references') {
      performDeleteReferences(pendingAction.ids);
    } else if (pendingAction.kind === 'restore-publication') {
      performRestorePublication(pendingAction.publicationId);
    } else if (pendingAction.kind === 'restore-backup') {
      await performRestoreBackup(pendingAction.pathname);
    } else {
      performRestoreRevision(pendingAction.revisionId);
    }
    setPendingAction(null);
  }

  async function readPosterFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    try {
      setPosterUploadStatus({ state: 'busy', message: `${file.name} 준비 중` });
      setSyncStatus('포스터를 웹용으로 줄이는 중');
      const resizedPoster = await resizeImage(file, 1600, 2200);
      const authSession = roleSessionToken('archive-editor');
      let posterImage = resizedPoster;
      const localPreview = !authSession;
      if (!authSession) {
        if (!import.meta.env.DEV) throw new Error('archive_media_session_required');
        setPosterUploadStatus({ state: 'success', message: '로컬 미리보기 준비 완료' });
      } else {
        setPosterUploadStatus({ state: 'busy', message: `${file.name} 공동 저장소에 보존 중` });
        setSyncStatus('포스터를 공동 이미지 저장소에 붙이는 중');
        posterImage = await uploadArchiveImage(resizedPoster, file.name, authSession);
        await replacePendingUpload(pendingPosterUploadRef, posterImage);
        setPosterUploadStatus({ state: 'success', message: `${file.name} 보존 완료` });
      }
      const current = formRef.current;
      persistUploadedProgrammeImage({
        ...current,
        posterImage,
        posterAlt: current.posterAlt.trim() ? current.posterAlt : `${current.title} 프로그램 포스터`,
      }, '포스터 이미지', localPreview);
    } catch (error) {
      console.error('Poster upload failed:', error);
      const message = posterUploadMessage(error);
      setSyncStatus(message);
      setPosterUploadStatus({ state: 'error', message });
    } finally {
      input.value = '';
    }
  }

  async function readProgrammeDetailImage(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        throw new Error('invalid_image');
      }
      setDetailImageUploadStatus({ state: 'busy', message: `${file.name} 준비 중` });
      setSyncStatus('프로그램 상세 이미지를 웹용으로 줄이는 중');
      const resizedImage = await resizeImage(file, 1800, 1600);
      const authSession = roleSessionToken('archive-editor');
      let detailImage = resizedImage;
      const localPreview = !authSession;
      if (!authSession) {
        if (!import.meta.env.DEV) throw new Error('archive_media_session_required');
        setSyncStatus('로컬 상세 이미지 미리보기 준비됨 / 공개 반영은 배포된 Keeper Desk에서 업로드하세요');
        setDetailImageUploadStatus({ state: 'success', message: '로컬 미리보기 준비 완료' });
      } else {
        setDetailImageUploadStatus({ state: 'busy', message: `${file.name} 공동 저장소에 보존 중` });
        detailImage = await uploadArchiveImage(resizedImage, `${selectedEvent.id}-detail-${file.name}`, authSession);
        await replacePendingUpload(pendingDetailUploadRef, detailImage);
        setSyncStatus('프로그램 상세 이미지가 공동 저장소에 보존됨 / 프로그램을 저장하거나 게시하세요');
        setDetailImageUploadStatus({ state: 'success', message: `${file.name} 보존 완료` });
      }
      const current = formRef.current;
      persistUploadedProgrammeImage({
        ...current,
        detailImage,
        detailImageAlt: current.detailImageAlt.trim()
          ? current.detailImageAlt
          : `${current.title} 상세 본문 이미지`,
      }, '상세 본문 이미지', localPreview);
    } catch (error) {
      console.error('Programme detail image upload failed:', error);
      const message = referenceImageUploadMessage(error);
      setSyncStatus(message);
      setDetailImageUploadStatus({ state: 'error', message });
    } finally {
      input.value = '';
    }
  }

  function removeProgrammeDetailImage() {
    void replacePendingUpload(pendingDetailUploadRef, null);
    updateField('detailImage', '');
    setDetailImageUploadStatus({ state: 'idle', message: '프로그램별 상세 이미지를 제거하고 기본 이미지로 되돌렸습니다' });
    setSyncStatus('상세 이미지를 기본 이미지로 되돌렸습니다 / 프로그램을 저장하면 반영됩니다');
  }

  async function readReferenceImage(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        throw new Error('invalid_image');
      }
      setReferenceImageUploadStatus({ state: 'busy', message: `${file.name} 준비 중` });
      setSyncStatus('자료 이미지를 웹용으로 줄이는 중');
      const resizedImage = await resizeImage(file, 1800, 1800);
      const authSession = roleSessionToken('archive-editor');
      let imageUrl = resizedImage;
      if (!authSession) {
        if (!import.meta.env.DEV) throw new Error('archive_media_session_required');
        setSyncStatus('로컬 이미지 미리보기 준비됨 / 공개 반영은 배포된 Keeper Desk에서 업로드하세요');
        setReferenceImageUploadStatus({ state: 'success', message: '로컬 미리보기 준비 완료' });
      } else {
        setReferenceImageUploadStatus({ state: 'busy', message: `${file.name} 공동 저장소에 보존 중` });
        imageUrl = await uploadArchiveImage(resizedImage, file.name, authSession);
        await replacePendingUpload(pendingReferenceUploadRef, imageUrl);
        setSyncStatus('자료 이미지가 공동 이미지 저장소에 보존됨 / 자료를 임시 저장하거나 공개 반영하세요');
        setReferenceImageUploadStatus({ state: 'success', message: `${file.name} 보존 완료` });
      }
      setReferenceForm((current) => {
        referenceUndo.current = [...referenceUndo.current.slice(-49), current];
        referenceRedo.current = [];
        return {
          ...current,
          imageUrl,
          altText: current.altText?.trim() ? current.altText : `${current.title} 대표 이미지`,
        };
      });
    } catch (error) {
      console.error('Reference image upload failed:', error);
      const message = referenceImageUploadMessage(error);
      setSyncStatus(message);
      setReferenceImageUploadStatus({ state: 'error', message });
    } finally {
      input.value = '';
    }
  }

  function removeReferenceImage() {
    void replacePendingUpload(pendingReferenceUploadRef, null);
    setReferenceForm((current) => {
      referenceUndo.current = [...referenceUndo.current.slice(-49), current];
      referenceRedo.current = [];
      return { ...current, imageUrl: undefined };
    });
    setReferenceImageUploadStatus({ state: 'idle', message: '올린 대표 이미지를 이 자료에서 제거했습니다' });
    setSyncStatus('대표 이미지 연결을 제거했습니다 / 자료를 저장하면 반영됩니다');
  }

  async function migrateEmbeddedPoster() {
    if (!form.posterImage.startsWith('data:')) return;
    const authSession = roleSessionToken('archive-editor');
    if (!authSession) {
      setSyncStatus('공동 이미지 저장소 이전은 배포된 Keeper Desk에서 사용할 수 있습니다');
      return;
    }
    try {
      setPosterUploadStatus({ state: 'busy', message: '기존 포스터를 공동 저장소로 옮기는 중' });
      setSyncStatus('기존 포스터를 공동 이미지 저장소로 옮기는 중');
      const embeddedResponse = await fetch(form.posterImage);
      const embeddedBlob = await embeddedResponse.blob();
      const embeddedFile = new File([embeddedBlob], `${selectedEvent.id}-poster`, { type: embeddedBlob.type || 'image/png' });
      const rasterPoster = await resizeImage(embeddedFile, 1600, 2200);
      const posterUrl = await uploadArchiveImage(rasterPoster, `${selectedEvent.id}-poster`, authSession);
      await replacePendingUpload(pendingPosterUploadRef, posterUrl);
      updateField('posterImage', posterUrl);
      if (!form.posterAlt.trim()) updateField('posterAlt', `${form.title} 프로그램 포스터`);
      setSyncStatus('기존 포스터 이전 완료 / 이 프로그램을 임시 저장하세요');
      setPosterUploadStatus({ state: 'success', message: '기존 포스터 이전 완료' });
    } catch (error) {
      console.error('Embedded poster migration failed:', error);
      const message = posterUploadMessage(error);
      if (message.startsWith('Keeper 입장 시간이')) {
        clearRoleSession('archive-editor');
        setIsAccessGranted(false);
        setAccessStatus(message);
      }
      setSyncStatus(message);
      setPosterUploadStatus({ state: 'error', message });
    }
  }

  function openSelectedPreview() {
    writeArchiveDraft(selectedEvent.id, toDraft(form), { label: 'preview snapshot', recordRevision: false });
    setLastLocalSavedAt(new Date().toISOString());
    setVersion((current) => current + 1);
    window.open(`/archive/${selectedEvent.id}/?preview=1`, '_blank', 'noopener,noreferrer');
  }

  if (!isAccessGranted) {
    return (
      <div className="public-home keeper-home keeper-access-home">
        <header className="archive-header">
          <a className="archive-wordmark" href="/" aria-label="Jerboa Circle archive home">
            <span>Jerboa</span><span>Circle</span><small lang="ko">보관자의 책상</small>
          </a>
          <nav className="archive-nav keeper-nav" aria-label="Keeper navigation">
            <a className="archive-nav-memory" href="/"><span lang="ko">기록벽</span></a>
            <a className="archive-private-door" href="/members/"><span lang="ko">비공개 장부</span></a>
          </nav>
        </header>
        <main className="keeper-access-room">
          <form className="keeper-access-form" onSubmit={enterKeeperDesk}>
            <p className="section-kicker"><span lang="en">Keeper seal</span> / <span lang="ko">보관자 입장</span></p>
            <h1>Keeper Desk</h1>
            <p lang="ko">한 번 입장하면 프로그램과 원전의 저장·수정·삭제·발행에서 열쇠를 다시 묻지 않습니다.</p>
            <label>
              <span lang="ko">Keeper pass key</span>
              <input
                autoComplete="current-password"
                autoFocus
                type="password"
                value={serverKey}
                onChange={(event) => setServerKey(event.target.value)}
              />
            </label>
            <button className="archive-cta" type="submit"><span className="archive-cta-label" lang="ko">Keeper Desk 열기</span></button>
            <small role="status" lang="ko">{accessStatus}</small>
          </form>
        </main>
      </div>
    );
  }

  return (
    <div className="public-home keeper-home">
      <header className="archive-header">
        <a className="archive-wordmark" href="/" aria-label="Jerboa Circle archive home">
          <span>Jerboa</span>
          <span>Circle</span>
          <small lang="ko">보관자의 책상</small>
        </a>
        <nav className="archive-nav keeper-nav" aria-label="Keeper navigation">
          <a className="archive-nav-memory" href="/"><span lang="ko">기록벽</span></a>
          <a className="archive-private-door" href="/members/"><span lang="ko">비공개 장부</span></a>
          <a className="archive-nav-textroom" href="/godmode/"><span lang="ko">문구실</span></a>
        </nav>
      </header>

      <ConnectivityNotice context="Keeper Desk" />

      {commandOpen && (
        <div className="keeper-command-overlay" role="presentation" onMouseDown={() => setCommandOpen(false)}>
          <section className="keeper-command-palette" ref={commandDialogRef} role="dialog" aria-modal="true" aria-label="Keeper 전체 찾기" onMouseDown={(event) => event.stopPropagation()}>
            <label>
              <span lang="ko">프로그램과 자료 전체 찾기</span>
              <input
                autoFocus
                type="search"
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                placeholder="제목, 판본, 만든 이"
              />
              <kbd>Esc</kbd>
            </label>
            <div className="keeper-command-results">
              {commandResults.map((item) => (
                <button type="button" key={`${item.kind}-${item.id}`} onClick={() => openKeeperItem(item.kind, item.id)}>
                  <span lang="ko">{item.kind === 'programme' ? '프로그램' : '자료'}</span>
                  <strong>{item.title}</strong>
                  <small>{item.meta}</small>
                </button>
              ))}
              {commandResults.length === 0 && <p lang="ko">찾는 기록이 없습니다.</p>}
            </div>
          </section>
        </div>
      )}

      <main className="keeper-room">
        <section className="keeper-command-bar" aria-label="Keeper save and sync controls">
          <div className="keeper-command-state">
            <strong lang="ko">Keeper 입장 확인됨</strong>
            <small role="status" aria-live="polite" lang="ko">{syncStatus}</small>
            <div className="keeper-storage-states" aria-label="저장 상태">
              <span data-state="local" lang="ko">기기 임시 저장 {lastLocalSavedAt ? timeLabel(new Date(lastLocalSavedAt)) : '대기'}</span>
              <span data-state={unsyncedChangeCount > 0 ? 'pending' : 'synced'} lang="ko">
                {sharedSnapshot ? unsyncedChangeCount > 0 ? `공동 장부와 ${unsyncedChangeCount}곳 다름` : '공동 장부와 일치' : '공동 장부 미확인'}
              </span>
              <span data-state="published" lang="ko">최근 사이트 게시 {archiveSavedAt ? timeLabel(new Date(archiveSavedAt)) : '없음'}</span>
            </div>
          </div>
          <div className="keeper-command-actions">
            <div className="keeper-command-primary">
              <button type="button" onClick={() => setCommandOpen(true)}><span lang="ko">전체 찾기</span><kbd>⌘K</kbd></button>
              <button type="button" onClick={undoCurrent} disabled={activeOperation !== 'idle' || (mode === 'events' ? programmeUndo.current.length === 0 : mode === 'references' ? referenceUndo.current.length === 0 : textUndo.current.length === 0)}><span lang="ko">되돌리기</span></button>
              <button type="button" onClick={redoCurrent} disabled={activeOperation !== 'idle' || (mode === 'events' ? programmeRedo.current.length === 0 : mode === 'references' ? referenceRedo.current.length === 0 : textRedo.current.length === 0)}><span lang="ko">다시 적용</span></button>
            </div>
            <details className="keeper-command-site-actions">
              <summary><span lang="ko">사이트 전체 관리</span></summary>
              <div>
                <small lang="ko">모든 프로그램·자료·문구의 기기 저장본을 한꺼번에 다룹니다.</small>
                <button className="keeper-command-publish" type="button" disabled={hasArchiveConflict || activeOperation !== 'idle'} onClick={saveArchiveToServer}>
                  <span lang="ko">{activeOperation === 'syncing' ? '반영 중...' : '공동 장부에 모두 반영'}</span>
                </button>
                <button type="button" disabled={hasArchiveConflict || activeOperation !== 'idle'} onClick={loadArchiveFromServer}>
                  <span lang="ko">{activeOperation === 'loading' ? '불러오는 중...' : '공동 장부 다시 불러오기'}</span>
                </button>
              </div>
            </details>
            <details className="keeper-command-more">
              <summary><span lang="ko">백업과 관리</span></summary>
              <div>
                <button type="button" onClick={downloadArchiveDrafts}><span lang="ko">파일 백업</span></button>
                <label>
                  <span lang="ko">파일 적용</span>
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      if (file) {
                        void importArchiveDrafts(file);
                        event.currentTarget.value = '';
                      }
                    }}
                  />
                </label>
                <button type="button" onClick={clearEveryDraft}><span lang="ko">기기 임시 저장 모두 삭제</span></button>
                <button type="button" disabled={operationsBusy} onClick={() => { void toggleOperations(); }}>
                  <span lang="ko">{showOperations ? '운영 상태 닫기' : '운영 상태와 백업'}</span>
                </button>
                <button type="button" onClick={leaveKeeperDesk}><span lang="ko">Keeper 입장 종료</span></button>
              </div>
            </details>
          </div>
          {hasArchiveConflict && (
            <p className="keeper-sync-conflict" role="alert" lang="ko">
              공개본이 다른 창에서 먼저 변경되었습니다. 아래에서 어느 내용을 남길지 선택하세요.
              <a href="#keeper-conflict-resolution">변경 내용 비교</a>
              {hasArchiveRecovery && (
                <button type="button" onClick={() => downloadLatestSyncRecovery('archive')}><span lang="ko">로컬 복구 파일 받기</span></button>
              )}
            </p>
          )}
        </section>
        {conflictState && (
          <section className="keeper-conflict-panel" id="keeper-conflict-resolution" aria-labelledby="keeper-conflict-title">
            <div>
              <p className="section-kicker" lang="en">Conflict ledger</p>
              <h2 id="keeper-conflict-title" lang="ko">어느 내용을 공개본에 남길지 선택하세요</h2>
              <p lang="ko">발행 이력은 양쪽을 합쳐 보존합니다. 프로그램, 컬렉션, 자료, 문구별로 남길 내용을 선택합니다.</p>
            </div>
            <label>
              <span lang="ko">프로그램</span>
              <select value={conflictChoices.drafts} onChange={(event) => setConflictChoices((current) => ({ ...current, drafts: event.target.value as 'local' | 'remote' }))}>
                <option value="local">이 기기의 임시 저장</option>
                <option value="remote">현재 공개본</option>
              </select>
              <small lang="ko">차이 {changedMapCount(conflictState.local.drafts, conflictState.remote.drafts)}개</small>
            </label>
            <label>
              <span lang="ko">컬렉션</span>
              <select value={conflictChoices.collections} onChange={(event) => setConflictChoices((current) => ({ ...current, collections: event.target.value as 'local' | 'remote' }))}>
                <option value="local">이 기기의 임시 저장</option>
                <option value="remote">현재 공개본</option>
              </select>
              <small lang="ko">차이 {changedMapCount(conflictState.local.collections, conflictState.remote.collections)}개</small>
            </label>
            <label>
              <span lang="ko">자료 장부</span>
              <select value={conflictChoices.references} onChange={(event) => setConflictChoices((current) => ({ ...current, references: event.target.value as 'local' | 'remote' }))}>
                <option value="local">이 기기의 임시 저장</option>
                <option value="remote">현재 공개본</option>
              </select>
              <small lang="ko">차이 {changedMapCount(conflictState.local.references, conflictState.remote.references)}개</small>
            </label>
            <label>
              <span lang="ko">공개 문구</span>
              <select value={conflictChoices.siteText} onChange={(event) => setConflictChoices((current) => ({ ...current, siteText: event.target.value as 'local' | 'remote' }))}>
                <option value="local">이 기기의 임시 저장</option>
                <option value="remote">현재 공개본</option>
              </select>
              <small lang="ko">차이 {changedMapCount(conflictState.local.siteText as Record<string, unknown>, conflictState.remote.siteText as Record<string, unknown>)}개</small>
            </label>
            <details className="keeper-conflict-comparison">
              <summary lang="ko">차이 목록 나란히 보기</summary>
              {([
                ['프로그램', conflictState.local.drafts, conflictState.remote.drafts],
                ['컬렉션', conflictState.local.collections, conflictState.remote.collections],
                ['자료', conflictState.local.references, conflictState.remote.references],
                ['공개 문구', conflictState.local.siteText as Record<string, unknown>, conflictState.remote.siteText as Record<string, unknown>],
              ] as const).map(([label, local, remote]) => {
                const entries = changedMapEntries(local, remote);
                return entries.length > 0 ? (
                  <section key={label}>
                    <h3 lang="ko">{label}</h3>
                    <div className="keeper-conflict-comparison-head"><span lang="ko">이 기기</span><span lang="ko">현재 공개본</span></div>
                    {entries.map((entry) => (
                      <div className="keeper-conflict-comparison-row" key={entry.key}>
                        <span><small>{entry.key}</small>{String(entry.local)}</span>
                        <span><small>{entry.key}</small>{String(entry.remote)}</span>
                      </div>
                    ))}
                  </section>
                ) : null;
              })}
            </details>
            {hasArchiveRecovery && (
              <button type="button" onClick={() => downloadLatestSyncRecovery('archive')}><span lang="ko">내 변경사항을 복구 파일로 보존</span></button>
            )}
            <button type="button" onClick={() => { void resolveArchiveConflict(); }}><span lang="ko">선택 내용으로 병합 후 공개 반영</span></button>
          </section>
        )}
        {showOperations && (
          <section className="keeper-operations" aria-labelledby="keeper-operations-title">
            <header>
              <div>
                <p className="section-kicker" lang="en">Operations register</p>
                <h2 id="keeper-operations-title" lang="ko">운영 상태와 되돌리기</h2>
              </div>
              <button type="button" disabled={operationsBusy} onClick={() => { void refreshOperations(); }}><span lang="ko">새로 확인</span></button>
            </header>
            {operationsStatus ? (
              <>
                <div className="keeper-operation-metrics">
                  <div><span lang="ko">공동 장부 크기</span><strong>{formatBytes(operationsStatus.archive.size)}</strong></div>
                  <div><span lang="ko">프로그램</span><strong>{operationsStatus.archive.recordCount}</strong></div>
                  <div><span lang="ko">삭제 보관함</span><strong>{operationsStatus.archive.deletedRecordCount}</strong></div>
                  <div><span lang="ko">자료</span><strong>{operationsStatus.archive.referenceCount}</strong></div>
                  <div><span lang="ko">발행본</span><strong>{operationsStatus.archive.publicationCount}</strong></div>
                  <div><span lang="ko">이전 필요한 포스터</span><strong>{operationsStatus.archive.embeddedPosterCount}</strong></div>
                  <div><span lang="ko">최근 동기화 문제</span><strong>{operationsStatus.recentFailures.length}</strong></div>
                </div>
                <div className="keeper-operation-links">
                  <button
                    type="button"
                    disabled={operationsBusy || !referenceRecords.some((reference) => reference.sourceUrl)}
                    onClick={() => { void runLinkCheck(referenceRecords.flatMap((reference) => reference.sourceUrl ? [reference.sourceUrl] : [])); }}
                  >
                    <span lang="ko">원문 링크 전체 확인</span>
                  </button>
                  {linkCheckResults.length > 0 && (
                    <p lang="ko">
                      확인 {linkCheckResults.length}개 · 정상 {linkCheckResults.filter((result) => result.ok).length}개 · 확인 필요 {linkCheckResults.filter((result) => !result.ok).length}개
                    </p>
                  )}
                </div>
                {linkCheckResults.some((result) => !result.ok) && (
                  <ul className="keeper-broken-links">
                    {linkCheckResults.filter((result) => !result.ok).map((result) => (
                      <li key={result.url}><span>{result.url}</span><small>{result.error ?? result.status ?? '응답 없음'}</small></li>
                    ))}
                  </ul>
                )}
                <div className="keeper-operation-columns">
                  <section>
                    <h3 lang="ko">자동 백업</h3>
                    {operationsStatus.backups.length > 0 ? (
                      <ol>
                        {operationsStatus.backups.slice(0, 8).map((backup) => (
                          <li key={backup.pathname}>
                            <span>{backup.savedAt}</span>
                            <small>{formatBytes(backup.size ?? 0)}</small>
                            <button type="button" onClick={() => requestRestoreBackup(backup.pathname, backup.savedAt)}><span lang="ko">이 장부로 복원</span></button>
                          </li>
                        ))}
                      </ol>
                    ) : <p lang="ko">아직 자동 백업이 없습니다. 다음 공개 반영부터 하루 한 번 보존됩니다.</p>}
                  </section>
                  <section>
                    <h3 lang="ko">최근 운영 기록</h3>
                    {operationsStatus.recentAudit.length > 0 ? (
                      <ol>
                        {operationsStatus.recentAudit.slice(0, 8).map((entry) => (
                          <li key={entry.id}><span>{entry.title}</span><small>{new Date(entry.createdAt).toLocaleString('ko-KR')} · {entry.action}</small></li>
                        ))}
                      </ol>
                    ) : <p lang="ko">공동 장부에 남은 운영 기록이 없습니다.</p>}
                  </section>
                </div>
              </>
            ) : <p lang="ko">운영 상태를 여는 중입니다.</p>}
          </section>
        )}
        <aside className="keeper-register" aria-label="Programme register">
          <p className="section-kicker">Keeper desk / marginal edition room</p>
          <h1>Register of passages</h1>
          <p lang="ko">
            프로그램, 자료, 문구를 고쳐 공개 장부에 반영합니다.
          </p>
          <p className="keeper-draft-count" lang="ko">
            {mode === 'text'
              ? isTextDirty ? '저장되지 않은 문구실 수정 있음' : '문구실 준비됨'
              : mode === 'references'
                ? isReferenceDirty ? '저장되지 않은 자료 수정 있음' : `자료 노드 ${referenceRecords.length}개`
                : isDirty ? '저장되지 않은 수정 있음' : `기기 임시 저장 ${draftCount}`}
          </p>
          <div className="keeper-mode-switch" aria-label="Keeper mode">
            <button
              className={mode === 'references' ? 'is-active' : ''}
              onClick={() => changeMode('references')}
              type="button"
            >
              <span lang="ko">자료 장부</span>
            </button>
            <button
              className={mode === 'events' ? 'is-active' : ''}
              onClick={() => changeMode('events')}
              type="button"
            >
              <span lang="ko">프로그램</span>
            </button>
            <button
              className={mode === 'text' ? 'is-active' : ''}
              onClick={() => changeMode('text')}
              type="button"
            >
              <span lang="ko">문구실</span>
            </button>
          </div>
          {programmeWorkingCopies.length > 0 && (
            <section className="keeper-working-copies" aria-label="자동 복구본">
              <header>
                <strong lang="ko">저장 실패·중단 자동 복구본</strong>
                <small lang="ko">검증에 막힌 입력도 이 기기에 따로 남습니다.</small>
              </header>
              <ul>
                {programmeWorkingCopies.map((copy) => (
                  <li key={copy.recordId}>
                    <button type="button" onClick={() => restoreProgrammeWorkingCopy(copy)}>
                      <strong>{copy.title}</strong>
                      <small>{new Date(copy.savedAt).toLocaleString('ko-KR')}</small>
                    </button>
                    <button type="button" aria-label={`${copy.title} 자동 복구본 삭제`} onClick={() => removeProgrammeWorkingCopy(copy.recordId)}>×</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {recentItems.length > 0 && (
            <section className="keeper-recent" aria-label="최근 작업">
              <strong lang="ko">최근 작업</strong>
              <div>
                {recentItems.map((item) => (
                  <button type="button" key={`${item.kind}-${item.id}`} onClick={() => openKeeperItem(item.kind, item.id)}>
                    <span>{item.title}</span><small>{item.meta}</small>
                  </button>
                ))}
              </div>
            </section>
          )}
          {mode === 'events' && (
            <div className="keeper-new-record-tools">
              <label>
                <span lang="ko">새 장의 바탕</span>
                <select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
                  <option value="blank">빈 장 · 기본값 자동 입력</option>
                  {archiveEvents.map((event) => <option value={event.id} key={event.id}>{event.edition} · {event.title}</option>)}
                </select>
              </label>
              <button className="keeper-new-record" type="button" onClick={createNewRecord}>
                <span lang="ko">아직 필사되지 않은 장 추가</span>
              </button>
            </div>
          )}
          {mode === 'references' && (
            <button className="keeper-new-record" type="button" onClick={createNewReference}>
              <span lang="ko">새 자료 노드 추가</span>
            </button>
          )}
          {mode !== 'text' && (
            <label className="keeper-list-search">
              <span lang="ko">{mode === 'events' ? '프로그램 찾기' : '자료 찾기'}</span>
              <input
                type="search"
                value={listQuery}
                onChange={(event) => setListQuery(event.target.value)}
                placeholder={mode === 'events' ? '제목·판본·종류' : '제목·만든 이·종류'}
              />
            </label>
          )}
          {mode === 'events' && (
            <div className="keeper-filter-block">
              <div className="keeper-view-switch" aria-label="목록 보기 방식">
                <button type="button" className={listView === 'register' ? 'is-active' : ''} onClick={() => setListView('register')}><span lang="ko">장부</span></button>
                <button type="button" className={listView === 'timeline' ? 'is-active' : ''} onClick={() => setListView('timeline')}><span lang="ko">일정</span></button>
              </div>
              <div className="keeper-list-filters" aria-label="프로그램 필터">
                <label><span lang="ko">단계</span><select value={workflowFilter} onChange={(event) => setWorkflowFilter(event.target.value as ArchiveWorkflowStatus | 'all')}><option value="all">전체</option><option value="draft">초안</option><option value="preview">미리보기</option><option value="published">발행됨</option><option value="archived">보관됨</option></select></label>
                <label><span lang="ko">공개</span><select value={visibilityFilter} onChange={(event) => setVisibilityFilter(event.target.value as ArchiveVisibility | 'all')}><option value="all">전체</option><option value="public">공개</option><option value="unlisted">주소로만 공개</option><option value="private">비공개</option></select></label>
                <label><span lang="ko">종류</span><select value={kindFilter} onChange={(event) => setKindFilter(event.target.value)}><option value="all">전체</option>{programmeKinds.map((kind) => <option value={kind} key={kind}>{kind}</option>)}</select></label>
              </div>
              <div className="keeper-saved-views">
                {preferences.savedViews.map((view) => (
                  <span key={view.id}><button type="button" onClick={() => applySavedView(view)}>{view.name}</button><button type="button" aria-label={`${view.name} 보기 삭제`} onClick={() => deleteSavedView(view.id)}>×</button></span>
                ))}
                <label><span lang="ko">현재 필터 저장</span><input value={savedViewName} onChange={(event) => setSavedViewName(event.target.value)} placeholder="예: 발행 대기" /><button type="button" onClick={createSavedView}><span lang="ko">저장</span></button></label>
              </div>
            </div>
          )}
          <div className="keeper-sync-panel" aria-label="Archive integrity status">
            <strong lang="ko">아카이브 연결 검사</strong>
            <small lang="ko">
              {integrityIssues.length === 0
                ? `기록 ${archiveEvents.length}개 · 자료 ${referenceRecords.length}개 / 끊어진 연결 없음`
                : `확인할 연결 ${integrityIssues.length}개`}
            </small>
            {selectedIntegrityIssues.length > 0 && (
              <ul className="keeper-integrity-list">
                {selectedIntegrityIssues.slice(0, 5).map((issue) => (
                  <li data-severity={issue.severity} key={issue.id}>{issue.message}</li>
                ))}
              </ul>
            )}
          </div>
          {mode === 'events' ? (
            <>
              {selectedBatchIds.length > 0 && (
                <section className="keeper-batch-panel" aria-label="선택한 프로그램 일괄 작업">
                  <strong lang="ko">{selectedBatchIds.length}개 선택됨</strong>
                  <select aria-label="발행 단계 일괄 변경" value={batchWorkflow} onChange={(event) => setBatchWorkflow(event.target.value as ArchiveWorkflowStatus | '')}><option value="">단계 유지</option><option value="draft">초안</option><option value="preview">미리보기</option><option value="published">발행됨</option><option value="archived">보관됨</option></select>
                  <select aria-label="공개 상태 일괄 변경" value={batchVisibility} onChange={(event) => setBatchVisibility(event.target.value as ArchiveVisibility | '')}><option value="">공개 상태 유지</option><option value="public">공개</option><option value="unlisted">주소로만 공개</option><option value="private">비공개</option></select>
                  <input aria-label="종류 일괄 변경" list="archive-batch-content-kinds" value={batchKind} onChange={(event) => setBatchKind(event.target.value)} placeholder="종류 유지" />
                  <datalist id="archive-batch-content-kinds">{programmeKinds.map((kind) => <option value={kind} key={kind} />)}</datalist>
                  <button type="button" onClick={applyBatchEdit}><span lang="ko">선택 항목 적용</span></button>
                  <button className="keeper-batch-delete" type="button" onClick={requestDeleteSelectedRecords}><span lang="ko">선택 프로그램 삭제</span></button>
                  <button type="button" onClick={() => setSelectedBatchIds([])}><span lang="ko">선택 해제</span></button>
                </section>
              )}
              {listView === 'timeline' ? (
                <ol className="keeper-timeline">
                  {timelineEvents.map((event) => (
                    <li key={event.id} data-status={event.status}>
                      <time>{new Date(event.publishAt ?? event.publishedAt ?? event.updatedAt).toLocaleDateString('ko-KR')}</time>
                      <button type="button" onClick={() => selectEvent(event)}><strong>{event.title}</strong><small>{event.workflowStatus} / {event.visibility}</small></button>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="keeper-list keeper-list-with-actions">
                  {visibleArchiveEvents.map((event) => (
                    <article className={event.id === selectedId ? 'is-selected' : ''} key={event.id}>
                      <input type="checkbox" aria-label={`${event.title} 일괄 선택`} checked={selectedBatchIds.includes(event.id)} onChange={() => toggleBatchRecord(event.id)} />
                      <button className="keeper-list-main" onClick={() => selectEvent(event)} type="button">
                        <span>{event.edition}</span><strong>{event.title}</strong><small>{event.workflowStatus} / {event.visibility}</small>
                      </button>
                      <button className="keeper-list-star" type="button" aria-label={`${event.title} 즐겨찾기`} aria-pressed={preferences.favouriteProgrammes.includes(event.id)} onClick={() => toggleFavourite('programme', event.id)}>{preferences.favouriteProgrammes.includes(event.id) ? '★' : '☆'}</button>
                      <div className="keeper-row-actions">
                        <a href={`/archive/${event.id}/?preview=1`} target="_blank" rel="noreferrer"><span lang="ko">미리보기</span></a>
                        <button type="button" onClick={() => duplicateRecord(event)}><span lang="ko">복제</span></button>
                        <button type="button" onClick={() => toggleRecordVisibility(event)}><span lang="ko">{event.visibility === 'public' ? '비공개' : '공개'}</span></button>
                      </div>
                    </article>
                  ))}
                  {visibleArchiveEvents.length === 0 && <p className="keeper-list-empty" lang="ko">찾는 프로그램이 없습니다.</p>}
                </div>
              )}
            </>
          ) : mode === 'references' ? (
            <>
              {selectedReferenceBatchIds.length > 0 && (
                <section className="keeper-batch-panel" aria-label="선택한 자료 일괄 작업">
                  <strong lang="ko">{selectedReferenceBatchIds.length}개 선택됨</strong>
                  <button className="keeper-batch-delete" type="button" onClick={requestDeleteSelectedReferences}><span lang="ko">선택 자료 삭제</span></button>
                  <button type="button" onClick={() => setSelectedReferenceBatchIds([])}><span lang="ko">선택 해제</span></button>
                </section>
              )}
              <div className="keeper-list keeper-list-with-actions">
                {visibleReferenceRecords.map((reference) => (
                  <article className={reference.id === selectedReferenceId ? 'is-selected' : ''} key={reference.id}>
                    <input type="checkbox" aria-label={`${reference.title} 일괄 선택`} checked={selectedReferenceBatchIds.includes(reference.id)} onChange={() => toggleBatchReference(reference.id)} />
                    <button className="keeper-list-main" onClick={() => selectReference(reference)} type="button">
                      <span lang="ko">{archiveReferenceKindLabel(reference.kind)}</span>
                      <strong>{reference.title}</strong>
                      <small>{reference.updatedAt ? `최근 수정 ${new Date(reference.updatedAt).toLocaleString('ko-KR')}` : reference.creator ?? reference.attribution ?? reference.id}</small>
                    </button>
                    <button className="keeper-list-star" type="button" aria-label={`${reference.title} 즐겨찾기`} aria-pressed={preferences.favouriteReferences.includes(reference.id)} onClick={() => toggleFavourite('reference', reference.id)}>{preferences.favouriteReferences.includes(reference.id) ? '★' : '☆'}</button>
                    <div className="keeper-row-actions"><a href={`/catalogue/${reference.id}/`} target="_blank" rel="noreferrer"><span lang="ko">공개 보기</span></a><button type="button" onClick={() => duplicateReferenceRecord(reference)}><span lang="ko">복제</span></button></div>
                  </article>
                ))}
                {visibleReferenceRecords.length === 0 && <p className="keeper-list-empty" lang="ko">찾는 자료가 없습니다.</p>}
              </div>
            </>
          ) : (
            <div className="keeper-list">
              <button className="is-selected" type="button">
                <span>🜔 Scriptorium</span>
                <strong>Text register</strong>
                <small lang="ko">반복되는 문장</small>
              </button>
            </div>
          )}
          {((mode === 'events' && deletedRecordDrafts.length > 0) || (mode === 'references' && deletedReferenceDrafts.length > 0)) && (
            <details className="keeper-trash">
              <summary lang="ko">삭제 보관함 ({mode === 'events' ? deletedRecordDrafts.length : deletedReferenceDrafts.length})</summary>
              <div>
                {(mode === 'events' ? deletedRecordDrafts : deletedReferenceDrafts).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => mode === 'events' ? restoreDeletedRecord(item.id) : restoreDeletedReference(item.id)}
                    type="button"
                  >
                    <strong>{item.title}</strong><span lang="ko">복원</span>
                  </button>
                ))}
              </div>
            </details>
          )}
        </aside>

        {mode === 'text' ? (
          <section className="keeper-editor godmode-editor" ref={editorRef} aria-label="Site text editor">
            <KeeperEditorActionBar
              mode="text"
              dirty={isTextDirty}
              busy={activeOperation !== 'idle'}
              operation={activeOperation}
              error={operationError}
              lastSavedAt={lastLocalSavedAt}
              remoteKnown={Boolean(sharedSnapshot)}
              hasRemoteDifference={unsyncedChangeCount > 0}
              onSave={() => { void saveCurrentDraft(); }}
              onSync={() => { void saveArchiveToServer(); }}
              onDiscard={discardSiteTextChanges}
            />
            <div className="keeper-preview godmode-preview">
              <div>
                <span>🜔 Scriptorium</span>
                <h2>Text register</h2>
                <p lang="ko">공개 기록벽에 반복해서 나타나는 문장을 이곳에서 직접 고칩니다.</p>
              </div>
            </div>

            <form
              className="keeper-form godmode-form"
              onSubmit={saveSiteTextDraft}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
            >
              <div className="keeper-editor-heading">
                <p className="section-kicker"><span className="kicker-en" lang="en">Scriptorium</span><span className="kicker-divider" aria-hidden="true"> / </span><span className="kicker-ko" lang="ko">고정 문구 장부</span></p>
                <h2>Text fields</h2>
              </div>

              <div className="godmode-field-grid">
                {siteTextFields.map((field) => (
                  <label className="keeper-field godmode-field" key={field.key}>
                    <span lang="ko">{field.label}</span>
                    {field.area ? (
                      <textarea
                        rows={field.key === 'manifestoBody' ? 5 : 3}
                        value={siteTextForm[field.key]}
                        onChange={(event) => updateSiteTextField(field.key, event.target.value)}
                      />
                    ) : (
                      <input
                        value={siteTextForm[field.key]}
                        onChange={(event) => updateSiteTextField(field.key, event.target.value)}
                      />
                    )}
                  </label>
                ))}
              </div>

              <div className="keeper-actions keeper-actions-secondary">
                <a className="archive-cta" href="/"><span className="archive-cta-label" lang="ko">공개 화면 보기</span></a>
              </div>
            </form>
          </section>
        ) : mode === 'references' ? (
          <section className="keeper-editor" ref={editorRef} aria-label="Selected reference editor">
            <KeeperEditorActionBar
              mode="references"
              dirty={isReferenceDirty}
              busy={activeOperation !== 'idle'}
              operation={activeOperation}
              error={operationError}
              lastSavedAt={lastLocalSavedAt}
              remoteKnown={Boolean(sharedSnapshot)}
              hasRemoteDifference={unsyncedChangeCount > 0}
              onSave={() => { void saveCurrentDraft(); }}
              onSync={() => { void saveArchiveToServer(); }}
              onDiscard={discardReferenceChanges}
            />
            <div className="keeper-preview godmode-preview">
              <div>
                <span lang="ko">{archiveReferenceKindLabel(referenceForm.kind)}</span>
                <h2>{referenceForm.title}</h2>
                <p lang="ko">{referenceForm.description}</p>
              </div>
            </div>

            <form
              className="keeper-form"
              onSubmit={saveReferenceDraft}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
            >
              <div className="keeper-editor-heading">
                <p className="section-kicker"><span lang="en">Reference node</span> / <span lang="ko">자료 편집 중</span></p>
                <h2>{referenceForm.title}</h2>
                <details className="keeper-record-menu" key="reference-management">
                  <summary aria-label="자료 관리 메뉴">
                    <span aria-hidden="true">⋯</span>
                    <span lang="ko">관리</span>
                  </summary>
                  <div className="keeper-record-menu-panel">
                    <a href={`/catalogue/${referenceForm.id}/`}>
                      <span lang="ko">공개 자료 보기</span>
                    </a>
                    <button className="keeper-danger-action" onClick={requestDeleteReference} type="button">
                      <span lang="ko">자료 삭제</span>
                    </button>
                  </div>
                </details>
              </div>

              <div className="keeper-field-grid">
                <label className="keeper-field">
                  <span lang="ko">자료 ID</span>
                  <input
                    value={referenceForm.id}
                    onChange={(event) => updateReferenceField('id', event.target.value)}
                    pattern="[a-z0-9가-힣-]+"
                    spellCheck="false"
                  />
                  <small lang="ko">공개 주소와 연결에 쓰입니다. 바꾸고 저장하면 프로그램과 하위 자료 연결도 함께 옮겨집니다.</small>
                </label>
                <div className="keeper-field">
                  <label htmlFor="keeper-reference-kind" lang="ko">종류</label>
                  <input
                    id="keeper-reference-kind"
                    value={referenceForm.kind}
                    onChange={(event) => updateReferenceField('kind', event.target.value as ArchiveReferenceKind)}
                    placeholder="기존 종류 선택 또는 새 종류 입력"
                    autoComplete="off"
                  />
                  <span className="keeper-kind-suggestions" aria-label="추천 자료 종류">
                    {referenceKinds.map((kind) => <button type="button" aria-pressed={referenceForm.kind === kind} key={kind} onClick={() => updateReferenceField('kind', kind)}>{archiveReferenceKindLabel(kind)}</button>)}
                  </span>
                  <small lang="ko">추천 목록에서 고르거나 새 종류를 직접 입력하세요.</small>
                </div>
              </div>

              <label className="keeper-field">
                <span lang="ko">제목</span>
                <input value={referenceForm.title} onChange={(event) => updateReferenceField('title', event.target.value)} />
              </label>

              <label className="keeper-field">
                <span lang="ko">설명</span>
                <textarea rows={4} value={referenceForm.description} onChange={(event) => updateReferenceField('description', event.target.value)} />
              </label>

              <div className="keeper-field-grid">
                <label className="keeper-field">
                  <span lang="ko">만든 이</span>
                  <input value={referenceForm.creator ?? ''} onChange={(event) => updateReferenceField('creator', event.target.value || undefined)} />
                </label>
                <label className="keeper-field">
                  <span lang="ko">귀속 표기</span>
                  <input value={referenceForm.attribution ?? ''} onChange={(event) => updateReferenceField('attribution', event.target.value || undefined)} />
                </label>
              </div>

              <div className="keeper-field-grid">
                <label className="keeper-field">
                  <span lang="ko">연도</span>
                  <input value={referenceForm.date ?? ''} onChange={(event) => updateReferenceField('date', event.target.value || undefined)} />
                </label>
                <label className="keeper-field">
                  <span lang="ko">판본</span>
                  <input value={referenceForm.edition ?? ''} onChange={(event) => updateReferenceField('edition', event.target.value || undefined)} />
                </label>
                <label className="keeper-field">
                  <span lang="ko">쪽·행·위치</span>
                  <input value={referenceForm.locator ?? ''} onChange={(event) => updateReferenceField('locator', event.target.value || undefined)} />
                </label>
                <label className="keeper-field">
                  <span lang="ko">언어</span>
                  <input value={referenceForm.language ?? ''} onChange={(event) => updateReferenceField('language', event.target.value || undefined)} />
                </label>
              </div>

              <label className="keeper-field">
                <span lang="ko">원문 출처 URL</span>
                <input type="url" value={referenceForm.sourceUrl ?? ''} onChange={(event) => updateReferenceField('sourceUrl', event.target.value || undefined)} />
              </label>
              {duplicateReference && (
                <p className="keeper-field-warning" role="alert" lang="ko">
                  같은 원문 주소를 쓰는 자료가 있습니다: <button type="button" onClick={() => selectReference(duplicateReference)}>{duplicateReference.title}</button>
                </p>
              )}
              <div className="keeper-inline-tools">
                <button
                  type="button"
                  disabled={!referenceForm.sourceUrl || metadataBusy}
                  onClick={() => { void applyMetadataSuggestion('reference'); }}
                >
                  <span lang="ko">원문 정보 제안</span>
                </button>
                <button
                  type="button"
                  disabled={!referenceForm.sourceUrl || operationsBusy}
                  onClick={() => { if (referenceForm.sourceUrl) void runLinkCheck([referenceForm.sourceUrl]); }}
                >
                  <span lang="ko">이 원문 링크 확인</span>
                </button>
                {linkCheckResults.filter((result) => result.url === referenceForm.sourceUrl).map((result) => (
                  <small data-state={result.ok ? 'ok' : 'error'} key={result.url} lang="ko">
                    {result.ok ? `연결됨${result.status ? ` · ${result.status}` : ''}` : `확인 필요 · ${result.error ?? result.status ?? '응답 없음'}`}
                  </small>
                ))}
              </div>

              {referenceForm.mediaAssetId && (
                <label className="keeper-field">
                  <span lang="ko">검증된 도판 파일</span>
                  <input value={referenceForm.mediaAssetId} readOnly />
                </label>
              )}

              <section className="keeper-reference-media" aria-labelledby="keeper-reference-media-title">
                <div className="keeper-reference-media-preview">
                  {referenceImagePreview ? (
                    <img
                      src={referenceImagePreview}
                      alt={referenceForm.altText || `${referenceForm.title} 대표 이미지 미리보기`}
                      decoding="async"
                    />
                  ) : (
                    <span lang="ko">아직 붙인 이미지가 없습니다</span>
                  )}
                </div>
                <div className="keeper-reference-media-controls">
                  <h3 id="keeper-reference-media-title" lang="ko">대표 이미지</h3>
                  <p lang="ko">자료의 공개 상세 화면에 표시할 PNG, JPG 또는 WebP 이미지를 붙입니다.</p>
                  <button
                    className="keeper-reference-file"
                    type="button"
                    disabled={referenceImageUploadStatus.state === 'busy'}
                    onClick={() => referenceImageInputRef.current?.click()}
                  >
                    <span lang="ko">{referenceForm.imageUrl ? '대표 이미지 교체' : '대표 이미지 붙이기'}</span>
                  </button>
                  <input
                    ref={referenceImageInputRef}
                    className="keeper-reference-file-input"
                    accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                    aria-label="대표 이미지 파일 선택"
                    disabled={referenceImageUploadStatus.state === 'busy'}
                    onChange={readReferenceImage}
                    type="file"
                  />
                  {referenceForm.imageUrl && (
                    <button type="button" className="keeper-secondary-action" onClick={removeReferenceImage}>
                      <span lang="ko">올린 이미지 제거</span>
                    </button>
                  )}
                  {referenceImageUploadStatus.message && (
                    <small className="keeper-upload-status" data-state={referenceImageUploadStatus.state} role="status" aria-live="polite" lang="ko">
                      {referenceImageUploadStatus.message}
                    </small>
                  )}
                </div>
              </section>

              <label className="keeper-field">
                <span lang="ko">권리와 재사용 조건</span>
                <input value={referenceForm.rights ?? ''} onChange={(event) => updateReferenceField('rights', event.target.value || undefined)} />
              </label>

              <label className="keeper-field">
                <span lang="ko">인용 표기</span>
                <textarea rows={3} value={referenceForm.citationNote ?? ''} onChange={(event) => updateReferenceField('citationNote', event.target.value || undefined)} />
              </label>

              <label className="keeper-field">
                <span lang="ko">이미지 대체 텍스트</span>
                <textarea rows={3} value={referenceForm.altText ?? ''} onChange={(event) => updateReferenceField('altText', event.target.value || undefined)} />
              </label>

              <RelationshipPicker
                label="상위 원전"
                description="인용문이나 도판이 어느 책·작품에서 파생되었는지 연결합니다."
                options={referenceRecords.filter((reference) => reference.id !== referenceForm.id).map((reference) => ({
                  id: reference.id,
                  title: reference.title,
                  meta: archiveReferenceKindLabel(reference.kind),
                }))}
                selectedIds={referenceForm.parentId ? [referenceForm.parentId] : []}
                onChange={(ids) => updateReferenceField('parentId', ids.at(-1) || undefined)}
              />

            </form>
          </section>
        ) : (
          <section className="keeper-editor" ref={editorRef} aria-label="Selected archive record editor">
          <KeeperEditorActionBar
            mode="events"
            dirty={isDirty}
            busy={activeOperation !== 'idle'}
            operation={activeOperation}
            error={operationError}
            lastSavedAt={lastLocalSavedAt}
            remoteKnown={Boolean(sharedSnapshot)}
            hasRemoteDifference={unsyncedChangeCount > 0}
            workflowStatus={form.workflowStatus}
            visibility={form.visibility}
            publicationBlocked={publicationErrorCount > 0}
            hasPublication={selectedPublications.length > 0 || selectedEvent.workflowStatus === 'published'}
            onSave={() => { void saveCurrentDraft(); }}
            onSync={() => { void saveArchiveToServer(); }}
            onPublish={requestPublication}
            onUnpublish={form.workflowStatus === 'published' && form.visibility === 'public' ? requestUnpublication : undefined}
            onDiscard={discardProgrammeChanges}
          />
          <div className="keeper-preview">
            <img src={form.posterImage} alt={form.posterAlt || `${form.title} poster preview`} />
          </div>

          <form
            className="keeper-form"
            onSubmit={saveDraft}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
          >
            <div className="keeper-editor-heading">
              <p className="section-kicker"><span lang="en">{selectedEvent.edition}</span> / <span lang="ko">편집 중</span></p>
              <h2>{form.title}</h2>
              <details className="keeper-record-menu" key="programme-management">
                <summary aria-label="프로그램 관리 메뉴">
                  <span aria-hidden="true">⋯</span>
                  <span lang="ko">관리</span>
                </summary>
                <div className="keeper-record-menu-panel">
                  <button onClick={duplicateSelectedRecord} type="button">
                    <span lang="ko">복제본 만들기</span>
                  </button>
                  <button onClick={openSelectedPreview} type="button">
                    <span lang="ko">현재 입력 미리보기</span>
                  </button>
                  <button className="keeper-danger-action" onClick={requestDeleteRecord} type="button">
                    <span lang="ko">프로그램 삭제</span>
                  </button>
                </div>
              </details>
            </div>

            <nav className="keeper-editor-outline" aria-label="프로그램 편집 목차">
              {editorSectionLabels.map((section) => {
                const warningCount = formWarnings.filter((warning) => warning.section === section.id).length;
                return (
                  <button type="button" key={section.id} aria-expanded={!collapsedSections.includes(section.id)} onClick={() => toggleEditorSection(section.id)}>
                    <span lang="ko">{section.label}</span>{warningCount > 0 && <small>{warningCount}</small>}
                  </button>
                );
              })}
              <button type="button" aria-pressed={livePreviewOpen} onClick={() => setLivePreviewOpen((current) => !current)}><span lang="ko">나란히 미리보기</span></button>
            </nav>
            {formWarnings.length > 0 && (
              <ul className="keeper-live-warnings" aria-label="입력 길이와 접근성 확인">
                {formWarnings.map((warning) => <li key={`${warning.section}-${warning.message}`}>{warning.message}</li>)}
              </ul>
            )}

            <section className="keeper-editor-group" id="keeper-section-identity" hidden={collapsedSections.includes('identity')}>
              <h3 lang="ko">기본 정보</h3>

            <label className="keeper-field">
              <span lang="ko">판본</span>
              <input value={form.edition} onChange={(event) => updateField('edition', event.target.value)} />
            </label>

            <label className="keeper-field">
              <span lang="ko">제목</span>
              <input id="keeper-programme-title" value={form.title} onChange={(event) => updateField('title', event.target.value)} />
            </label>

            <label className="keeper-field">
              <span lang="ko">부제</span>
              <input value={form.subtitle} onChange={(event) => updateField('subtitle', event.target.value)} />
            </label>

            <label className="keeper-field">
              <span lang="ko">라틴 문장</span>
              <input value={form.latinQuote} onChange={(event) => updateField('latinQuote', event.target.value)} />
            </label>

            <label className="keeper-field">
              <span lang="ko">여백 주석</span>
              <textarea
                rows={2}
                value={form.marginalia}
                onChange={(event) => updateField('marginalia', event.target.value)}
              />
            </label>

            <div className="keeper-field-grid">
              <label className="keeper-field">
                <span lang="ko">일자</span>
                <input value={form.date} onChange={(event) => updateField('date', event.target.value)} />
              </label>

              <label className="keeper-field">
                <span lang="ko">상태</span>
                <select value={form.status} onChange={(event) => updateField('status', event.target.value as EventStatus)}>
                  <option value="current">현재 프로그램</option>
                  <option value="upcoming">예정 프로그램</option>
                  <option value="past">지난 프로그램</option>
                </select>
              </label>
            </div>

            <div className="keeper-field-grid">
              <div className="keeper-field">
                <label htmlFor="keeper-programme-kind" lang="ko">종류</label>
                <span className="keeper-inline-create">
                  <input
                    id="keeper-programme-kind"
                    value={form.kind}
                    onChange={(event) => updateField('kind', event.target.value as ArchiveContentKind)}
                    placeholder="기존 종류 선택 또는 새 종류 입력"
                    autoComplete="off"
                  />
                  <small lang="ko">목록에 없는 이름을 입력하면 새 종류로 저장됩니다.</small>
                </span>
                <span className="keeper-kind-suggestions" aria-label="추천 프로그램 종류">
                  {programmeKinds.map((kind) => (
                    <button type="button" aria-pressed={form.kind === kind} key={kind} onClick={() => updateField('kind', kind)}>{kind}</button>
                  ))}
                </span>
              </div>

              <label className="keeper-field">
                <span lang="ko">공개 상태</span>
                <select value={form.visibility} onChange={(event) => updateField('visibility', event.target.value as ArchiveVisibility)}>
                  <option value="public">공개</option>
                  <option value="unlisted">주소로만 공개</option>
                  <option value="private">비공개</option>
                </select>
              </label>
            </div>

            <label className="keeper-field">
              <span lang="ko">발행 단계</span>
              <select value={form.workflowStatus} onChange={(event) => updateField('workflowStatus', event.target.value as ArchiveWorkflowStatus)}>
                <option value="draft">초안</option>
                <option value="preview">미리보기</option>
                <option value="published">발행됨</option>
                <option value="archived">보관됨</option>
              </select>
            </label>

            <div className="keeper-field-grid">
              <label className="keeper-field">
                <span lang="ko">예약 공개 시작</span>
                <input type="datetime-local" value={form.publishAt} onChange={(event) => updateField('publishAt', event.target.value)} />
                <small lang="ko">비우면 발행 즉시 공개됩니다.</small>
              </label>
              <label className="keeper-field">
                <span lang="ko">예약 공개 종료</span>
                <input type="datetime-local" value={form.unpublishAt} onChange={(event) => updateField('unpublishAt', event.target.value)} />
                <small lang="ko">비우면 계속 공개됩니다.</small>
              </label>
            </div>

            <label className="keeper-field">
              <span lang="ko">시즌</span>
              <select value={form.seasonId} onChange={(event) => updateField('seasonId', event.target.value)}>
                {archiveSeasons.map((season) => (
                  <option value={season.id} key={season.id}>{season.label} / {season.title}</option>
                ))}
              </select>
            </label>

            <RelationshipPicker
              label="컬렉션"
              description="이 프로그램이 나타날 묶음을 선택하거나, 필요한 컬렉션을 이 자리에서 바로 만듭니다."
              options={collectionRecords.map((collection) => ({
                id: collection.id,
                title: collection.title,
                meta: collection.visibility,
              }))}
              selectedIds={splitDraftList(form.collectionIdsText)}
              onChange={(ids) => updateField('collectionIdsText', ids.join(' / '))}
              actionLabel={inlineCollectionOpen ? '새 컬렉션 닫기' : '새 컬렉션 추가'}
              onAction={() => setInlineCollectionOpen((current) => !current)}
            />
            {inlineCollectionOpen && (
              <section className="keeper-inline-collection" aria-label="새 컬렉션 만들기">
                <div>
                  <strong lang="ko">새 컬렉션</strong>
                  <small lang="ko">만드는 즉시 현재 프로그램에 선택됩니다.</small>
                </div>
                <label>
                  <span lang="ko">이름</span>
                  <input
                    autoFocus
                    value={inlineCollectionTitle}
                    onChange={(event) => setInlineCollectionTitle(event.target.value)}
                    placeholder="예: Summer Reading"
                  />
                </label>
                <label>
                  <span lang="ko">설명</span>
                  <input
                    value={inlineCollectionDescription}
                    onChange={(event) => setInlineCollectionDescription(event.target.value)}
                    placeholder="비우면 이름을 바탕으로 자동 작성"
                  />
                </label>
                <label>
                  <span lang="ko">공개 상태</span>
                  <select
                    value={inlineCollectionVisibility}
                    onChange={(event) => setInlineCollectionVisibility(event.target.value as ArchiveVisibility)}
                  >
                    <option value="public">공개</option>
                    <option value="unlisted">주소로만 공개</option>
                    <option value="private">비공개</option>
                  </select>
                </label>
                <div className="keeper-inline-collection-actions">
                  <button type="button" onClick={() => setInlineCollectionOpen(false)}><span lang="ko">취소</span></button>
                  <button type="button" onClick={createInlineCollection}><span lang="ko">만들고 선택</span></button>
                </div>
              </section>
            )}

            </section>
            <section className="keeper-editor-group" id="keeper-section-artwork" hidden={collapsedSections.includes('artwork')}>
              <h3 lang="ko">도판</h3>

            <label className="keeper-field">
              <span lang="ko">포스터 이미지 URL</span>
              <input value={form.posterImage} onChange={(event) => updateField('posterImage', event.target.value)} />
            </label>

            <label className="keeper-field">
              <span lang="ko">포스터 대체 텍스트</span>
              <input value={form.posterAlt} onChange={(event) => updateField('posterAlt', event.target.value)} placeholder="화면 읽기 도구에 전달할 포스터 설명" />
            </label>

            <div className="keeper-poster-upload">
              <figure>
                <img src={form.posterImage} alt={form.posterAlt} />
              </figure>
              <label className="keeper-field">
                <span lang="ko">포스터 이미지 업로드</span>
                <small lang="ko">이미지를 최적화해 이 프로그램의 포스터로 보존합니다.</small>
                <input accept="image/png,image/jpeg,image/webp" disabled={posterUploadStatus.state === 'busy'} onChange={readPosterFile} type="file" />
                {posterUploadStatus.message && (
                  <small className="keeper-upload-status" data-state={posterUploadStatus.state} role="status" aria-live="polite" lang="ko">
                    {posterUploadStatus.message}
                  </small>
                )}
              </label>
              {form.posterImage.startsWith('data:') && (
                <button type="button" onClick={() => { void migrateEmbeddedPoster(); }}><span lang="ko">기존 포스터를 공동 저장소로 옮기기</span></button>
              )}
            </div>

            <label className="keeper-field">
              <span lang="ko">상세 본문 이미지 URL</span>
              <input
                value={form.detailImage}
                onChange={(event) => updateField('detailImage', event.target.value)}
                placeholder="비우면 공통 기본 이미지가 사용됩니다"
              />
            </label>

            <label className="keeper-field">
              <span lang="ko">상세 본문 이미지 대체 텍스트</span>
              <input
                value={form.detailImageAlt}
                onChange={(event) => updateField('detailImageAlt', event.target.value)}
                placeholder="이미지의 장면과 의미를 짧게 설명"
              />
            </label>

            <section className="keeper-reference-media keeper-programme-detail-media" aria-labelledby="keeper-programme-detail-media-title">
              <div className="keeper-reference-media-preview">
                <img
                  src={form.detailImage || editorialPlates.detail.src}
                  alt={form.detailImageAlt || `${form.title} 상세 본문 이미지 미리보기`}
                  decoding="async"
                />
              </div>
              <div className="keeper-reference-media-controls">
                <h3 id="keeper-programme-detail-media-title" lang="ko">상세 본문 이미지</h3>
                <p lang="ko">프로그램 기록을 열었을 때 긴 설명 옆에 나타나는 이미지를 프로그램마다 따로 붙입니다.</p>
                <button
                  className="keeper-reference-file"
                  type="button"
                  disabled={detailImageUploadStatus.state === 'busy'}
                  onClick={() => detailImageInputRef.current?.click()}
                >
                  <span lang="ko">{form.detailImage ? '상세 이미지 교체' : '상세 이미지 붙이기'}</span>
                </button>
                <input
                  ref={detailImageInputRef}
                  className="keeper-reference-file-input"
                  accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                  aria-label="프로그램 상세 이미지 파일 선택"
                  disabled={detailImageUploadStatus.state === 'busy'}
                  onChange={readProgrammeDetailImage}
                  type="file"
                />
                {form.detailImage && (
                  <button type="button" className="keeper-secondary-action" onClick={removeProgrammeDetailImage}>
                    <span lang="ko">기본 이미지로 되돌리기</span>
                  </button>
                )}
                {detailImageUploadStatus.message && (
                  <small className="keeper-upload-status" data-state={detailImageUploadStatus.state} role="status" aria-live="polite" lang="ko">
                    {detailImageUploadStatus.message}
                  </small>
                )}
              </div>
            </section>

            </section>
            <section className="keeper-editor-group" id="keeper-section-content" hidden={collapsedSections.includes('content')}>
              <h3 lang="ko">내용</h3>

            <label className="keeper-field">
              <span lang="ko">짧은 설명</span>
              <textarea
                rows={3}
                value={form.shortDescription}
                onChange={(event) => updateField('shortDescription', event.target.value)}
              />
            </label>

            <label className="keeper-field">
              <span lang="ko">긴 설명</span>
              <textarea
                rows={5}
                value={form.longDescription}
                onChange={(event) => updateField('longDescription', event.target.value)}
              />
            </label>

            <section className="keeper-journey-editor" aria-labelledby="keeper-journey-editor-title">
              <header>
                <div>
                  <span lang="en">Procession</span>
                  <h4 id="keeper-journey-editor-title" lang="ko">여정 구성</h4>
                  <small lang="ko">공개 화면에 나타날 진행 순서를 단계별로 편집합니다.</small>
                </div>
                <button type="button" onClick={addJourneyStep}><span lang="ko">단계 추가</span></button>
              </header>
              <ol>
                {journeyStepsFromText(form.passageText).map((step, index, steps) => (
                  <li key={`${index}-${steps.length}`}>
                    <span className="keeper-journey-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                    <label>
                      <span className="sr-only" lang="ko">{index + 1}번째 여정 단계</span>
                      <input
                        aria-label={`${index + 1}번째 여정 단계`}
                        value={step}
                        onChange={(event) => updateJourneyStep(index, event.target.value)}
                      />
                    </label>
                    <div className="keeper-journey-actions">
                      <button type="button" disabled={index === 0} onClick={() => moveJourneyStep(index, -1)} aria-label={`${index + 1}번째 단계를 위로 이동`}>↑</button>
                      <button type="button" disabled={index === steps.length - 1} onClick={() => moveJourneyStep(index, 1)} aria-label={`${index + 1}번째 단계를 아래로 이동`}>↓</button>
                      <button type="button" disabled={steps.length === 1} onClick={() => removeJourneyStep(index)} aria-label={`${index + 1}번째 단계 삭제`}>×</button>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="keeper-primary-theme-editor" aria-labelledby="keeper-primary-theme-title">
              <header>
                <h4 id="keeper-primary-theme-title" lang="ko">메인 주제</h4>
                <p lang="ko">프로그램의 중심 표식입니다. 하나 이상 선택하고, 필요하면 새 표식을 추가하세요.</p>
              </header>
              <div className="keeper-primary-theme-options">
                {primaryThemeOptions.map((theme) => {
                  const selected = splitDraftList(form.primaryThemesText).some((item) => item.toLocaleLowerCase('en-US') === theme.toLocaleLowerCase('en-US'));
                  return (
                    <button type="button" data-theme={theme.toLocaleLowerCase('en-US')} aria-pressed={selected} key={theme} onClick={() => togglePrimaryTheme(theme)}>{theme}</button>
                  );
                })}
              </div>
              <div className="keeper-primary-theme-create">
                <label htmlFor="keeper-new-primary-theme" lang="ko">새 메인 주제</label>
                <input id="keeper-new-primary-theme" value={newPrimaryTheme} onChange={(event) => setNewPrimaryTheme(event.target.value)} placeholder="새 표식 이름" />
                <button type="button" onClick={addPrimaryTheme} disabled={!newPrimaryTheme.trim()}><span lang="ko">추가</span></button>
              </div>
            </section>

            <label className="keeper-field">
              <span lang="ko">부가 주제</span>
              <small lang="ko">메인 주제를 보충하는 읽기 키워드를 입력하세요.</small>
              <textarea rows={3} value={form.themesText} onChange={(event) => updateField('themesText', event.target.value)} />
            </label>

            </section>
            <section className="keeper-editor-group" id="keeper-section-connections" hidden={collapsedSections.includes('connections')}>
              <h3 lang="ko">연결</h3>

            <RelationshipPicker
              label="참고자료와 문화 노드"
              description="책, 작품, 인용, 도판, 장소를 검색해 선택합니다. 선택한 자료로 공개 읽기 목록이 자동 생성됩니다."
              options={referenceRecords.map((reference) => ({
                id: reference.id,
                title: reference.title,
                meta: reference.attribution ?? reference.kind,
              }))}
              selectedIds={splitDraftList(form.referenceIdsText)}
              onChange={(ids) => updateField('referenceIdsText', ids.join(' / '))}
              actionLabel="이 자리에서 새 자료 만들기"
              onAction={() => setInlineReferenceOpen((current) => !current)}
            />

            {inlineReferenceOpen && (
              <aside className="keeper-inline-reference" aria-label="새 자료를 만들고 연결하기">
                <header><strong lang="ko">새 자료를 만들고 바로 연결</strong><button type="button" onClick={() => setInlineReferenceOpen(false)} aria-label="닫기">×</button></header>
                <label><span lang="ko">자료 ID</span><input value={inlineReferenceForm.id} onChange={(event) => setInlineReferenceForm((current) => ({ ...current, id: event.target.value }))} pattern="[a-z0-9가-힣-]+" placeholder="비워두면 제목으로 자동 생성" /></label>
                <div className="keeper-inline-reference-kind"><label htmlFor="keeper-inline-reference-kind" lang="ko">종류</label><input id="keeper-inline-reference-kind" value={inlineReferenceForm.kind} onChange={(event) => setInlineReferenceForm((current) => ({ ...current, kind: event.target.value as ArchiveReferenceKind }))} placeholder="기존 종류 또는 새 종류" autoComplete="off" /><span className="keeper-kind-suggestions">{referenceKinds.map((kind) => <button type="button" aria-pressed={inlineReferenceForm.kind === kind} key={kind} onClick={() => setInlineReferenceForm((current) => ({ ...current, kind }))}>{archiveReferenceKindLabel(kind)}</button>)}</span></div>
                <label><span lang="ko">제목</span><input value={inlineReferenceForm.title} onChange={(event) => setInlineReferenceForm((current) => ({ ...current, title: event.target.value }))} /></label>
                <label className="is-wide"><span lang="ko">원문 URL</span><input type="url" value={inlineReferenceForm.sourceUrl} onChange={(event) => setInlineReferenceForm((current) => ({ ...current, sourceUrl: event.target.value }))} /></label>
                <label className="is-wide"><span lang="ko">설명</span><textarea rows={2} value={inlineReferenceForm.description} onChange={(event) => setInlineReferenceForm((current) => ({ ...current, description: event.target.value }))} /></label>
                <label><span lang="ko">만든 이</span><input value={inlineReferenceForm.creator} onChange={(event) => setInlineReferenceForm((current) => ({ ...current, creator: event.target.value }))} /></label>
                <label><span lang="ko">소장처·출판처</span><input value={inlineReferenceForm.attribution} onChange={(event) => setInlineReferenceForm((current) => ({ ...current, attribution: event.target.value }))} /></label>
                {(inlineReferenceForm.kind === 'image' || inlineReferenceForm.kind === 'artwork') && <label><span lang="ko">권리와 재사용 조건</span><input value={inlineReferenceForm.rights} onChange={(event) => setInlineReferenceForm((current) => ({ ...current, rights: event.target.value }))} /></label>}
                {(inlineReferenceForm.kind === 'image' || inlineReferenceForm.kind === 'artwork') && <label className="is-wide"><span lang="ko">이미지 대체 텍스트</span><input value={inlineReferenceForm.altText} onChange={(event) => setInlineReferenceForm((current) => ({ ...current, altText: event.target.value }))} /></label>}
                <div className="is-wide keeper-inline-tools"><button type="button" disabled={!inlineReferenceForm.sourceUrl || metadataBusy} onClick={() => { void applyMetadataSuggestion('inline'); }}>원문 정보 제안</button><button type="button" onClick={createInlineReference}>자료 만들고 연결</button></div>
              </aside>
            )}

            <RelationshipPicker
              label="이어지는 프로그램"
              description="이 판본과 직접 연결할 과거·미래 프로그램을 선택합니다. 자기 자신은 목록에서 제외됩니다."
              options={archiveEvents.filter((event) => event.id !== selectedEvent.id).map((event) => ({
                id: event.id,
                title: event.title,
                meta: event.edition,
              }))}
              selectedIds={splitDraftList(form.relatedEventIdsText)}
              onChange={(ids) => updateField('relatedEventIdsText', ids.join(' / '))}
            />

            <aside className="keeper-relation-map" aria-label="현재 프로그램의 관계 지도">
              <div className="keeper-relation-column"><strong lang="ko">자료 {selectedRelations.references.length}</strong>{selectedRelations.references.map((reference) => <button type="button" key={reference.id} onClick={() => openKeeperItem('reference', reference.id)}>{reference.title}</button>)}</div>
              <div className="keeper-relation-centre"><span>{form.edition}</span><strong>{form.title}</strong></div>
              <div className="keeper-relation-column"><strong lang="ko">프로그램 {selectedRelations.programmes.length}</strong>{selectedRelations.programmes.map((record) => <button type="button" key={record.id} onClick={() => selectEvent(record)}>{record.title}</button>)}</div>
            </aside>

            </section>
            <section className="keeper-editor-group" id="keeper-section-publication" hidden={collapsedSections.includes('publication')}>
              <h3 lang="ko">발행과 운영</h3>

            <div className="keeper-field-grid">
              <label className="keeper-field">
                <span lang="ko">형식</span>
                <input value={form.location} onChange={(event) => updateField('location', event.target.value)} />
              </label>

              <label className="keeper-field">
                <span lang="ko">버튼 문구</span>
                <input value={form.ctaLabel} onChange={(event) => updateField('ctaLabel', event.target.value)} />
              </label>
            </div>

            <aside className="keeper-publication-panel" aria-label="Publication preflight">
              <div>
                <span lang="en">Publication preflight</span>
                <strong lang="ko">
                  {publicationErrorCount > 0
                    ? `게시 전 확인 ${publicationErrorCount}건${publicationWarningCount > 0 ? ` · 권장 ${publicationWarningCount}건` : ''}`
                    : `게시 가능${publicationWarningCount > 0 ? ` · 권장 ${publicationWarningCount}건` : ''}`}
                </strong>
              </div>
              <p lang="ko">
                임시 저장은 이 기기에만 남습니다. 게시는 공개 상태·자료 관계·도판 권리를 다시 검사하고 변경 이력을 남깁니다.
              </p>
              {publicationIssues.length > 0 ? (
                <ul className="keeper-integrity-list">
                  {publicationIssues.slice(0, 6).map((issue) => (
                    <li data-severity={issue.severity} key={issue.id}>{issue.message}</li>
                  ))}
                </ul>
              ) : (
                <small lang="ko">필수 필드와 모든 연결을 확인했습니다.</small>
              )}
              <div className="keeper-publication-diff" aria-live="polite">
                <strong lang="ko">
                  {publicationComparison.isFirstPublication
                    ? '첫 발행본으로 기록됩니다'
                    : publicationComparison.changes.length > 0
                      ? `직전 발행본 대비 ${publicationComparison.changes.length}개 변경`
                      : '직전 발행본과 내용이 같습니다'}
                </strong>
                {publicationComparison.changes.length > 0 && (
                  <ul>
                    {publicationComparison.changes.slice(0, 8).map((change) => (
                      <li key={change.id} data-kind={change.kind}>
                        <span lang="ko">
                          {change.kind === 'reference-added'
                            ? `자료 추가 · ${change.label}`
                            : change.kind === 'reference-removed'
                              ? `자료 제외 · ${change.label}`
                              : change.kind === 'reference-updated'
                                ? `자료 정보 수정 · ${change.label}`
                              : change.label}
                        </span>
                        {change.kind === 'field' && <small>{change.before} → {change.after}</small>}
                      </li>
                    ))}
                    {publicationComparison.changes.length > 8 && (
                      <li lang="ko">그 밖의 변경 {publicationComparison.changes.length - 8}개</li>
                    )}
                  </ul>
                )}
              </div>
            </aside>

            <aside className="keeper-record-preview" aria-label="Public archive record preview">
              <span>{form.edition}</span>
              <h3>{form.title}</h3>
              <p>{form.subtitle}</p>
              <p lang={/[가-힣]/.test(form.marginalia) ? 'ko' : 'en'}>{form.marginalia}</p>
              <small><span lang="en">{form.workflowStatus} / {form.visibility}</span> / <span lang={/[가-힣]/.test(form.shortDescription) ? 'ko' : 'en'}>{form.shortDescription}</span></small>
            </aside>

            <aside className="keeper-revision-history" aria-label="Archive draft revision history">
              <div>
                <span lang="en">Revision history</span>
                <strong lang="ko">{selectedRevisions.length}개 저장본</strong>
              </div>
              {selectedRevisions.length > 0 ? (
                <ol>
                  {selectedRevisions.slice(0, 6).map((revision) => (
                    <li key={revision.id}>
                      <span>{new Date(revision.savedAt).toLocaleString('ko-KR')}</span>
                      <small>{revision.label} / {revision.title}</small>
                      <button type="button" onClick={() => restoreRevision(revision.id, revision.title)}><span lang="ko">이 버전으로 되돌리기</span></button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p lang="ko">아직 되돌릴 수 있는 임시 저장 이력이 없습니다.</p>
              )}
            </aside>

            <aside className="keeper-revision-history keeper-publication-history" aria-label="Published edition history">
              <div>
                <span lang="en">Published editions</span>
                <strong lang="ko">{selectedPublications.length}개 발행본</strong>
              </div>
              {selectedPublications.length > 0 ? (
                <ol>
                  {selectedPublications.slice(0, 6).map((publication) => (
                    <li key={publication.id}>
                      <span>{new Date(publication.createdAt).toLocaleString('ko-KR')}</span>
                      <small>{publication.edition} / {publication.contentHash} / 자료 {publication.references.length}개</small>
                      <button
                        type="button"
                        onClick={() => restorePublication(publication.id, publication.title, publication.contentHash)}
                      >
                        <span lang="ko">복구 초안 만들기</span>
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p lang="ko">아직 발행 지문이 없습니다. 기존 공개 기록은 다음 발행부터 이곳에 쌓입니다.</p>
              )}
            </aside>
            </section>
          </form>
          {livePreviewOpen && (
            <aside className="keeper-live-preview" aria-label="실시간 공개 화면 미리보기">
              <header>
                <strong lang="ko">공개 화면 미리보기</strong>
                <div><button type="button" className={livePreviewViewport === 'desktop' ? 'is-active' : ''} onClick={() => setLivePreviewViewport('desktop')}>Desktop</button><button type="button" className={livePreviewViewport === 'mobile' ? 'is-active' : ''} onClick={() => setLivePreviewViewport('mobile')}>Mobile</button><button type="button" onClick={() => setPreviewRevision((current) => current + 1)}><span lang="ko">새로고침</span></button><button type="button" aria-label="미리보기 닫기" onClick={() => setLivePreviewOpen(false)}>×</button></div>
              </header>
              <div data-viewport={livePreviewViewport}><iframe key={previewRevision} title={`${form.title} 공개 화면 미리보기`} src={`/archive/${selectedEvent.id}/?preview=1&embed=keeper`} /></div>
            </aside>
          )}
          </section>
        )}
        <nav className="keeper-mobile-actions" data-mode={mode} aria-label="모바일 빠른 작업">
          <span className="keeper-mobile-save-state" role={operationError ? 'alert' : 'status'} aria-live="polite" lang="ko">
            {activeOperation !== 'idle'
              ? activeOperation === 'publishing' ? '게시 중...' : activeOperation === 'saving' ? '저장 중...' : '공동 장부 처리 중...'
              : operationError || (mode === 'events' ? isDirty : mode === 'references' ? isReferenceDirty : isTextDirty)
                ? operationError || '저장되지 않은 변경 있음'
                : lastLocalSavedAt ? `저장됨 ${timeLabel(new Date(lastLocalSavedAt))}` : '편집 준비됨'}
          </span>
          <button type="button" disabled={activeOperation !== 'idle' || !(mode === 'events' ? isDirty : mode === 'references' ? isReferenceDirty : isTextDirty)} onClick={() => { void saveCurrentDraft(); }}><span lang="ko">임시 저장</span></button>
          <button type="button" disabled={activeOperation !== 'idle' || (!isDirty && !isReferenceDirty && !isTextDirty && unsyncedChangeCount === 0)} onClick={() => { void saveArchiveToServer(); }}><span lang="ko">변경 저장</span></button>
          {mode === 'events' && <button className="keeper-mobile-publish" type="button" disabled={activeOperation !== 'idle' || publicationErrorCount > 0} onClick={requestPublication}><span lang="ko">{selectedPublications.length > 0 || selectedEvent.workflowStatus === 'published' ? '변경 게시' : '게시하기'}</span></button>}
          <button type="button" onClick={() => setCommandOpen(true)}><span lang="ko">찾기</span></button>
        </nav>
      </main>
      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.kind === 'import'
          ? '검증된 초안 파일을 적용할까요?'
          : pendingAction?.kind === 'clear'
            ? '이 기기의 임시 저장을 모두 지울까요?'
            : pendingAction?.kind === 'publish'
              ? '이 프로그램을 공개할까요?'
              : pendingAction?.kind === 'unpublish'
                ? '이 프로그램의 게시를 취소할까요?'
              : pendingAction?.kind === 'delete-record'
                ? '이 프로그램을 삭제할까요?'
              : pendingAction?.kind === 'delete-records'
                ? `${pendingAction.ids.length}개 프로그램을 삭제할까요?`
              : pendingAction?.kind === 'delete-reference'
                  ? '이 자료를 삭제할까요?'
              : pendingAction?.kind === 'delete-references'
                  ? `${pendingAction.ids.length}개 자료를 삭제할까요?`
              : pendingAction?.kind === 'restore-backup'
                ? '이 공동 장부 백업으로 복원할까요?'
              : pendingAction?.kind === 'restore-publication'
                ? '이 발행본에서 복구 초안을 만들까요?'
              : '이전 초안으로 되돌릴까요?'}
        description={pendingAction?.kind === 'import'
          ? `기록 ${pendingAction.recordCount}개, 컬렉션 ${pendingAction.collectionCount}개, 자료 ${pendingAction.referenceCount}개, 발행본 ${pendingAction.publicationCount}개와 필드 ${pendingAction.fieldCount}개를 확인했습니다. ${pendingAction.diffSummary}. 이 기기의 임시 저장 내용은 파일의 내용으로 교체됩니다.`
          : pendingAction?.kind === 'clear'
            ? '현재 공개본은 유지되지만, 이 기기에 임시 저장한 모든 수정이 사라집니다. 먼저 파일 백업을 받는 것이 안전합니다.'
          : pendingAction?.kind === 'publish'
              ? `“${pendingAction.title}”의 현재 내용을 공개하고 변경 이력을 보존합니다.${pendingAction.warningCount > 0 ? ` 권장 확인 ${pendingAction.warningCount}건이 남아 있습니다.` : ''}`
              : pendingAction?.kind === 'unpublish'
                ? `“${pendingAction.title}”을 공개 목록과 상세 주소에서 내립니다. 발행 이력과 임시 저장 내용은 보존됩니다.`
              : pendingAction?.kind === 'delete-record'
                ? `“${pendingAction.title}”을 삭제 보관함으로 옮깁니다. ${pendingAction.impactSummary}. 삭제 보관함에서 복원할 수 있습니다.`
                : pendingAction?.kind === 'delete-records'
                  ? `“${pendingAction.titles.slice(0, 3).join('”, “')}${pendingAction.titles.length > 3 ? `” 외 ${pendingAction.titles.length - 3}개` : '”'}를 삭제 보관함으로 옮깁니다. ${pendingAction.impactSummary}. 각 기록은 삭제 보관함에서 복원할 수 있습니다.`
                : pendingAction?.kind === 'delete-reference'
                  ? `“${pendingAction.title}”을 삭제 보관함으로 옮깁니다. ${pendingAction.impactSummary}. 삭제 보관함에서 복원할 수 있습니다.`
                : pendingAction?.kind === 'delete-references'
                  ? `“${pendingAction.titles.slice(0, 3).join('”, “')}${pendingAction.titles.length > 3 ? `” 외 ${pendingAction.titles.length - 3}개` : '”'}를 삭제 보관함으로 옮깁니다. ${pendingAction.impactSummary}. 각 자료는 삭제 보관함에서 복원할 수 있습니다.`
              : pendingAction?.kind === 'restore-backup'
                ? `${pendingAction.title} 백업으로 공동 장부 전체를 되돌립니다. 현재 공동 장부는 복원 직전 백업으로 따로 보존됩니다.`
              : pendingAction?.kind === 'restore-publication'
                ? `“${pendingAction.title}”의 발행본 ${pendingAction.contentHash}에서 새 초안을 만듭니다. 발행 이력은 바뀌지 않으며, 초안은 안전하게 미리보기·비목록 상태로 시작합니다.`
              : `“${pendingAction?.kind === 'restore' ? pendingAction.title : ''}” 저장본으로 되돌립니다. 현재 초안은 새 이력으로 남습니다.`}
        confirmLabel={pendingAction?.kind === 'import'
          ? '검증 파일 적용'
          : pendingAction?.kind === 'clear'
            ? '기기 임시 저장 삭제'
            : pendingAction?.kind === 'publish'
              ? '게시하기'
              : pendingAction?.kind === 'unpublish'
                ? '게시 취소'
              : pendingAction?.kind === 'delete-record'
                ? '프로그램 삭제'
                : pendingAction?.kind === 'delete-records'
                  ? '선택 프로그램 삭제'
                : pendingAction?.kind === 'delete-reference'
                  ? '자료 삭제'
                  : pendingAction?.kind === 'delete-references'
                    ? '선택 자료 삭제'
                  : pendingAction?.kind === 'restore-backup'
                    ? '공동 장부 복원'
                  : pendingAction?.kind === 'restore-publication'
                    ? '복구 초안 만들기'
                    : '이 버전 복원'}
        tone={pendingAction?.kind === 'clear'
          || pendingAction?.kind === 'unpublish'
          || pendingAction?.kind === 'delete-record'
          || pendingAction?.kind === 'delete-records'
          || pendingAction?.kind === 'delete-reference'
          || pendingAction?.kind === 'delete-references'
          ? 'danger'
          : 'default'}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => { void confirmPendingAction(); }}
      />
    </div>
  );
}
