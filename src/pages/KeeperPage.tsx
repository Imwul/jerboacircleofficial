import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  archiveCollections,
  archiveSeasons,
  defaultArchiveContentKinds,
  defaultArchiveCollectionId,
  defaultArchiveSeasonId,
  events,
  type ArchiveContentKind,
  type ArchiveEvent,
  type ArchiveVisibility,
  type ArchiveWorkflowStatus,
  type EventStatus,
} from '../data/events';
import { defaultSiteText, type SiteText } from '../data/siteText';
import {
  applyArchiveDrafts,
  clearAllArchiveDrafts,
  clearArchiveDraft,
  deleteArchiveDraft,
  readArchiveDrafts,
  readArchiveDraftRevisions,
  restoreDeletedArchiveDraft,
  restoreArchiveDraftRevision,
  writeArchiveDraft,
  writeArchiveDrafts,
  type ArchiveEventDraft,
  type ArchiveDraftMap,
} from '../utils/archiveDrafts';
import { loadServerSync, saveServerSync, ServerSyncError } from '../utils/serverSync';
import {
  clearSiteTextDraft,
  getSiteText,
  mergeSiteText,
  writeSiteTextDraft,
} from '../utils/siteTextDrafts';
import { resizeImage } from '../utils/imageUtils';
import { usePageMetadata } from '../utils/pageMetadata';
import { downloadLatestSyncRecovery, readSyncRecovery, writeSyncRecovery } from '../utils/syncRecovery';
import { authenticateRole, clearRoleSession, readRoleSession, roleSessionToken } from '../utils/roleAuth';
import {
  archiveReferenceKindLabel,
  archiveReferences,
  type ArchiveReference,
  type ArchiveReferenceKind,
} from '../data/archiveKnowledge';
import {
  applyArchiveReferenceDrafts,
  clearAllArchiveReferenceDrafts,
  clearArchiveReferenceDraft,
  deleteArchiveReferenceDraft,
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
import './HomePage.css';
import './EditorialStability.css';
import '../JerboaCondoRefine.css';

interface ArchiveSyncPayload {
  schemaVersion?: 1 | 2 | 3;
  drafts?: ArchiveDraftMap;
  siteText?: Partial<SiteText>;
  references?: ArchiveReferenceDraftMap;
  publications?: ArchivePublicationMap;
}

type ReferenceFormState = Omit<ArchiveReference, 'id'> & { id: string };

function toReferenceForm(reference: ArchiveReference): ReferenceFormState {
  return { ...reference };
}

function validateReferenceForm(form: ReferenceFormState, references: ArchiveReference[]) {
  if (!form.id.trim()) return '자료 ID를 입력하세요';
  if (!/^[a-z0-9가-힣-]+$/.test(form.id)) return '자료 ID는 영문 소문자, 숫자, 한글과 하이픈만 사용할 수 있습니다';
  if (!form.title.trim()) return '자료 제목을 입력하세요';
  if (!form.description.trim()) return '자료 설명을 입력하세요';
  if ((form.kind === 'image' || form.kind === 'artwork') && !form.sourceUrl?.trim()) return '도판과 작품은 소장기관 원문 출처 URL이 필요합니다';
  if ((form.kind === 'image' || form.kind === 'artwork') && !form.rights?.trim()) return '도판과 작품은 권리와 재사용 조건이 필요합니다';
  if ((form.kind === 'image' || form.kind === 'artwork') && !form.altText?.trim()) return '도판과 작품은 이미지 대체 텍스트가 필요합니다';
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
  | { kind: 'import'; drafts: ArchiveDraftMap; references: ArchiveReferenceDraftMap; publications: ArchivePublicationMap; recordCount: number; referenceCount: number; publicationCount: number; fieldCount: number }
  | { kind: 'clear' }
  | { kind: 'restore'; revisionId: string; title: string }
  | { kind: 'restore-publication'; publicationId: string; title: string; contentHash: string }
  | { kind: 'publish'; title: string; warningCount: number }
  | { kind: 'delete-record'; id: string; title: string }
  | { kind: 'delete-reference'; id: string; title: string }
  | null;

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

function nextEditionLabel(records: ArchiveEvent[]) {
  const highestEdition = records.reduce((highest, record) => {
    const editionNumber = Number(record.edition.match(/\d+/)?.[0] ?? 0);
    return Number.isFinite(editionNumber) ? Math.max(highest, editionNumber) : highest;
  }, 0);
  return `Edition ${String(highestEdition + 1).padStart(3, '0')}`;
}

function timeLabel(date = new Date()) {
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
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

export default function KeeperPage() {
  const [isAccessGranted, setIsAccessGranted] = useState(() => Boolean(readRoleSession('archive-editor')));
  const [accessStatus, setAccessStatus] = useState('Keeper pass key를 입력하면 이 기기에서 7일 동안 다시 묻지 않습니다.');
  const [mode, setMode] = useState<'events' | 'references' | 'text'>(() => (
    window.location.pathname.replace(/\/+$/, '').endsWith('/godmode') ? 'text' : 'events'
  ));
  const [version, setVersion] = useState(0);
  const archiveEvents = useMemo(() => applyArchiveDrafts(events), [version]);
  const referenceRecords = useMemo(() => applyArchiveReferenceDrafts(archiveReferences), [version]);
  const [selectedId, setSelectedId] = useState(archiveEvents[0].id);
  const selectedEvent = archiveEvents.find((event) => event.id === selectedId) ?? archiveEvents[0];
  const [form, setForm] = useState(() => toFormState(selectedEvent));
  const [selectedReferenceId, setSelectedReferenceId] = useState(referenceRecords[0].id);
  const selectedReference = referenceRecords.find((reference) => reference.id === selectedReferenceId) ?? referenceRecords[0];
  const [referenceForm, setReferenceForm] = useState<ReferenceFormState>(() => toReferenceForm(selectedReference));
  const [siteTextForm, setSiteTextForm] = useState<SiteText>(() => getSiteText());
  const draftCount = useMemo(() => Object.keys(readArchiveDrafts()).length, [version]);
  const [serverKey, setServerKey] = useState('');
  const [syncStatus, setSyncStatus] = useState('공동 장부 대기');
  const [archiveSavedAt, setArchiveSavedAt] = useState<string | null>(null);
  const [hasArchiveConflict, setHasArchiveConflict] = useState(false);
  const [hasArchiveRecovery, setHasArchiveRecovery] = useState(() => Boolean(readSyncRecovery<ArchiveSyncPayload>('archive')));
  const [pendingAction, setPendingAction] = useState<KeeperPendingAction>(null);
  const [listQuery, setListQuery] = useState('');
  const isDirty = JSON.stringify(form) !== JSON.stringify(toFormState(selectedEvent));
  const isReferenceDirty = JSON.stringify(referenceForm) !== JSON.stringify(toReferenceForm(selectedReference));
  const isTextDirty = JSON.stringify(siteTextForm) !== JSON.stringify(getSiteText());
  const selectedRevisions = useMemo(() => readArchiveDraftRevisions(selectedEvent.id), [selectedEvent.id, version]);
  const selectedPublications = useMemo(() => readArchivePublications()[selectedEvent.id] ?? [], [selectedEvent.id, version]);
  const integrityIssues = useMemo(() => inspectArchiveIntegrity(archiveEvents, referenceRecords), [archiveEvents, referenceRecords]);
  const publicationCandidate = useMemo(() => archiveEventFromForm(
    selectedEvent.id,
    form,
    selectedEvent,
    selectedEvent.publishedAt || new Date().toISOString().slice(0, 10),
  ), [form, selectedEvent]);
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
  const deletedRecordDrafts = useMemo(() => Object.entries(readArchiveDrafts())
    .filter(([, draft]) => Boolean(draft.deletedAt))
    .map(([id, draft]) => ({
      id,
      title: draft.title ?? events.find((event) => event.id === id)?.title ?? id,
    })), [version]);
  const deletedReferenceDrafts = useMemo(() => Object.values(readArchiveReferenceDrafts())
    .filter((reference) => Boolean(reference.deletedAt))
    .map((reference) => ({ id: reference.id, title: reference.title })), [version]);
  const programmeKinds = useMemo(() => [...defaultArchiveContentKinds], []);
  const visibleArchiveEvents = useMemo(() => {
    const query = listQuery.trim().toLocaleLowerCase('ko-KR');
    if (!query) return archiveEvents;
    return archiveEvents.filter((event) => (
      `${event.edition} ${event.title} ${event.kind}`.toLocaleLowerCase('ko-KR').includes(query)
    ));
  }, [archiveEvents, listQuery]);
  const visibleReferenceRecords = useMemo(() => {
    const query = listQuery.trim().toLocaleLowerCase('ko-KR');
    if (!query) return referenceRecords;
    return referenceRecords.filter((reference) => (
      `${reference.title} ${reference.creator ?? ''} ${archiveReferenceKindLabel(reference.kind)}`
        .toLocaleLowerCase('ko-KR')
        .includes(query)
    ));
  }, [listQuery, referenceRecords]);
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
    if (!isAccessGranted || initialArchiveLoad.current) return;
    initialArchiveLoad.current = true;
    void loadArchiveFromServer();
  }, [isAccessGranted]);

  useEffect(() => {
    if (!isAccessGranted || !isDirty) return;
    const timer = window.setTimeout(() => {
      writeArchiveDraft(selectedEvent.id, toDraft(form), { label: 'automatic local draft', recordRevision: false });
      setVersion((current) => current + 1);
      setSyncStatus(`프로그램 수정 자동 보관됨 / ${timeLabel()}`);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [form, isAccessGranted, isDirty, selectedEvent.id]);

  useEffect(() => {
    if (!isAccessGranted || !isReferenceDirty) return;
    const timer = window.setTimeout(() => {
      const savedReference = writeArchiveReferenceDraft(referenceForm);
      setReferenceForm(savedReference);
      setVersion((current) => current + 1);
      setSyncStatus(`자료 수정 자동 보관됨 / ${timeLabel()}`);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [isAccessGranted, isReferenceDirty, referenceForm]);

  useEffect(() => {
    if (!isAccessGranted || !isTextDirty) return;
    const timer = window.setTimeout(() => {
      writeSiteTextDraft(siteTextForm);
      setSyncStatus(`문구 수정 자동 보관됨 / ${timeLabel()}`);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [isAccessGranted, isTextDirty, siteTextForm]);

  useEffect(() => {
    if (!isAccessGranted) return;
    const preserveLastChanges = () => {
      if (isDirty) {
        writeArchiveDraft(selectedEvent.id, toDraft(form), { label: 'automatic local draft', recordRevision: false });
      }
      if (isReferenceDirty) writeArchiveReferenceDraft(referenceForm);
      if (isTextDirty) writeSiteTextDraft(siteTextForm);
    };
    window.addEventListener('pagehide', preserveLastChanges);
    return () => window.removeEventListener('pagehide', preserveLastChanges);
  }, [form, isAccessGranted, isDirty, isReferenceDirty, isTextDirty, referenceForm, selectedEvent.id, siteTextForm]);

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

  function selectEvent(event: ArchiveEvent) {
    if (isDirty) {
      writeArchiveDraft(selectedEvent.id, toDraft(form), { label: 'automatic local draft', recordRevision: false });
      setVersion((current) => current + 1);
    }
    setSelectedId(event.id);
    setForm(toFormState(event));
  }

  function selectReference(reference: ArchiveReference) {
    if (isReferenceDirty) {
      writeArchiveReferenceDraft(referenceForm);
      setVersion((current) => current + 1);
    }
    setSelectedReferenceId(reference.id);
    setReferenceForm(toReferenceForm(reference));
  }

  function changeMode(nextMode: 'events' | 'references' | 'text') {
    if (mode === 'events' && isDirty) {
      writeArchiveDraft(selectedEvent.id, toDraft(form), { label: 'automatic local draft', recordRevision: false });
    }
    if (mode === 'references' && isReferenceDirty) writeArchiveReferenceDraft(referenceForm);
    if (mode === 'text' && isTextDirty) writeSiteTextDraft(siteTextForm);
    setMode(nextMode);
    setListQuery('');
    setVersion((current) => current + 1);
  }

  function updateReferenceField<Key extends keyof ReferenceFormState>(key: Key, value: ReferenceFormState[Key]) {
    setReferenceForm((current) => ({ ...current, [key]: value }));
  }

  function saveReferenceDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateReferenceForm(referenceForm, referenceRecords);
    if (validation) {
      setSyncStatus(`입력 확인 / ${validation}`);
      return;
    }
    const savedReference = writeArchiveReferenceDraft(referenceForm);
    setReferenceForm(savedReference);
    setSelectedReferenceId(savedReference.id);
    setVersion((current) => current + 1);
    setSyncStatus(`자료 초안 봉인됨 / ${timeLabel()}`);
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
    setVersion((current) => current + 1);
    setSyncStatus('새 자료 초안 생성됨');
  }

  function resetReferenceDraft() {
    clearArchiveReferenceDraft(selectedReference.id);
    const baseReference = archiveReferences.find((reference) => reference.id === selectedReference.id);
    const nextReference = baseReference ?? applyArchiveReferenceDrafts(archiveReferences)[0];
    setSelectedReferenceId(nextReference.id);
    setReferenceForm(toReferenceForm(nextReference));
    setVersion((current) => current + 1);
    setSyncStatus('선택 자료 원본 복원됨');
  }

  function updateField<Key extends keyof KeeperFormState>(key: Key, value: KeeperFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateSiteTextField(key: keyof SiteText, value: string) {
    setSiteTextForm((current) => ({ ...current, [key]: value }));
  }

  function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateKeeperForm(form, archiveEvents, referenceRecords);
    if (validation) {
      setSyncStatus(`입력 확인 / ${validation}`);
      return;
    }
    writeArchiveDraft(selectedEvent.id, toDraft(form), { label: form.workflowStatus });
    setVersion((current) => current + 1);
    setSyncStatus(`로컬 초안 봉인됨 / ${timeLabel()}`);
  }

  function saveSiteTextDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateSiteTextForm(siteTextForm);
    if (validation) {
      setSyncStatus(`입력 확인 / ${validation}`);
      return;
    }
    writeSiteTextDraft(siteTextForm);
    setSyncStatus(`문구실 초안 봉인됨 / ${timeLabel()}`);
  }

  function resetSiteTextDraft() {
    clearSiteTextDraft();
    setSiteTextForm(defaultSiteText);
    setSyncStatus('문구실 원본 복원됨');
  }

  function resetDraft() {
    clearArchiveDraft(selectedEvent.id);
    const baseEvent = events.find((event) => event.id === selectedEvent.id);
    if (baseEvent) {
      setForm(toFormState(baseEvent));
    } else {
      const nextEvent = applyArchiveDrafts(events)[0];
      setSelectedId(nextEvent.id);
      setForm(toFormState(nextEvent));
    }
    setVersion((current) => current + 1);
    setSyncStatus('선택 기록 원본 복원됨');
  }

  function createNewRecord() {
    const nextId = makeRecordId('Unwritten Folio');
    const nextDraft: ArchiveEventDraft = {
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
      themes: ['Fragment', 'Passage'],
      referenceIds: [],
      relatedEventIds: [],
      location: '저보아 서클',
      ctaLabel: '기록 열기',
      ctaHref: `./archive/${nextId}/`,
      createdAt: new Date().toISOString(),
      isCustom: true,
    };

    writeArchiveDraft(nextId, nextDraft, { label: 'new draft' });
    const nextEvents = applyArchiveDrafts(events);
    const nextEvent = nextEvents.find((event) => event.id === nextId) ?? nextEvents[0];
    setSelectedId(nextEvent.id);
    setForm(toFormState(nextEvent));
    setVersion((current) => current + 1);
    setSyncStatus('새 기록 초안 생성됨 / 공동 장부에 봉인하면 공개됩니다');
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
    setPendingAction({ kind: 'delete-record', id: selectedEvent.id, title: selectedEvent.title });
  }

  function requestDeleteReference() {
    setPendingAction({ kind: 'delete-reference', id: selectedReference.id, title: selectedReference.title });
  }

  function performDeleteRecord(id: string) {
    if (id === selectedEvent.id && isDirty) {
      writeArchiveDraft(id, toDraft(form), { label: 'automatic local draft', recordRevision: false });
    }
    deleteArchiveDraft(id);
    const nextDrafts = readArchiveDrafts();
    archiveEvents.forEach((record) => {
      if (record.id === id || !record.relatedEventIds.includes(id)) return;
      nextDrafts[record.id] = {
        ...nextDrafts[record.id],
        relatedEventIds: record.relatedEventIds.filter((relatedId) => relatedId !== id),
        updatedAt: new Date().toISOString(),
      };
    });
    writeArchiveDrafts(nextDrafts);
    const remaining = applyArchiveDrafts(events);
    const nextRecord = remaining[0];
    if (nextRecord) {
      setSelectedId(nextRecord.id);
      setForm(toFormState(nextRecord));
    }
    setVersion((current) => current + 1);
    setSyncStatus('프로그램이 삭제 보관함으로 옮겨졌습니다 / 공동 장부에 봉인하면 모두에게 반영됩니다');
  }

  function performDeleteReference(id: string) {
    if (id === selectedReference.id && isReferenceDirty) writeArchiveReferenceDraft(referenceForm);
    const currentReference = applyArchiveReferenceDrafts(archiveReferences).find((reference) => reference.id === id) ?? selectedReference;
    deleteArchiveReferenceDraft(currentReference);

    const nextDrafts = readArchiveDrafts();
    archiveEvents.forEach((record) => {
      if (!record.referenceIds.includes(id)) return;
      nextDrafts[record.id] = {
        ...nextDrafts[record.id],
        referenceIds: record.referenceIds.filter((referenceId) => referenceId !== id),
        updatedAt: new Date().toISOString(),
      };
    });
    writeArchiveDrafts(nextDrafts);

    applyArchiveReferenceDrafts(archiveReferences).forEach((reference) => {
      if (reference.id !== id && reference.parentId === id) {
        writeArchiveReferenceDraft({ ...reference, parentId: undefined });
      }
    });

    const remaining = applyArchiveReferenceDrafts(archiveReferences);
    const nextReference = remaining[0];
    if (nextReference) {
      setSelectedReferenceId(nextReference.id);
      setReferenceForm(toReferenceForm(nextReference));
    }
    setVersion((current) => current + 1);
    setSyncStatus('자료가 삭제 보관함으로 옮겨지고 프로그램 연결이 정리되었습니다 / 공동 장부에 봉인하면 모두에게 반영됩니다');
  }

  function restoreDeletedRecord(id: string) {
    restoreDeletedArchiveDraft(id);
    const restored = applyArchiveDrafts(events).find((event) => event.id === id);
    if (restored) {
      setSelectedId(restored.id);
      setForm(toFormState(restored));
    }
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
    setVersion((current) => current + 1);
    setSyncStatus('삭제한 자료를 복원했습니다 / 프로그램 연결은 필요하면 다시 선택하세요');
  }

  function createArchiveSyncPayload(overrides: { drafts?: ArchiveDraftMap; publications?: ArchivePublicationMap } = {}) {
    const drafts = overrides.drafts ?? {
      ...readArchiveDrafts(),
      ...(isDirty ? { [selectedEvent.id]: toDraft(form) } : {}),
    };
    return {
      schemaVersion: 3 as const,
      drafts,
      siteText: siteTextForm,
      references: {
        ...readArchiveReferenceDrafts(),
        ...(isReferenceDirty ? { [referenceForm.id]: referenceForm } : {}),
      },
      publications: overrides.publications ?? readArchivePublications(),
    };
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
    try {
      const archiveValidation = mode === 'events' || isDirty ? validateKeeperForm(form, archiveEvents, referenceRecords) : '';
      if (archiveValidation) {
        setSyncStatus(`입력 확인 / ${archiveValidation}`);
        return;
      }
      const textValidation = mode === 'text' || isTextDirty ? validateSiteTextForm(siteTextForm) : '';
      if (textValidation) {
        setSyncStatus(`입력 확인 / ${textValidation}`);
        return;
      }
      const referenceValidation = mode === 'references' || isReferenceDirty
        ? validateReferenceForm(referenceForm, referenceRecords)
        : '';
      if (referenceValidation) {
        setSyncStatus(`입력 확인 / ${referenceValidation}`);
        return;
      }
      if (isDirty) {
        writeArchiveDraft(selectedEvent.id, toDraft(form), { label: form.workflowStatus });
      }
      setSyncStatus('공동 장부에 봉인 중');
      if (mode === 'text' || isTextDirty) {
        writeSiteTextDraft(siteTextForm);
      }
      if (mode === 'references' || isReferenceDirty) {
        writeArchiveReferenceDraft(referenceForm);
      }

      const auth = await resolveArchiveAuth();
      if (!auth.syncKey && !auth.authSession) {
        setSyncStatus('공동 장부 또는 아카이브 편집자 열쇠 필요');
        return;
      }

      const result = await saveServerSync<ArchiveSyncPayload>('archive', createArchiveSyncPayload(), auth.syncKey, {
        baseSavedAt: archiveSavedAt,
        authSession: auth.authSession,
      });
      setArchiveSavedAt(result.savedAt || archiveSavedAt);
      setHasArchiveConflict(false);
      setVersion((current) => current + 1);
      setSyncStatus(`공동 장부에 봉인됨 / ${timeLabel(result.savedAt ? new Date(result.savedAt) : new Date())}`);
    } catch (error) {
      if (error instanceof ServerSyncError && error.message === 'sync_conflict') {
        captureArchiveRecovery('archive_sync_conflict', error.savedAt);
        setArchiveSavedAt(error.savedAt || archiveSavedAt);
        setHasArchiveConflict(true);
        setSyncStatus('공동 장부가 먼저 바뀌었습니다 / 열람 후 다시 봉인');
        return;
      }
      console.error('Archive server save failed:', error);
      setSyncStatus('공동 장부 봉인 실패 / 열쇠 또는 연결 확인');
    }
  }

  async function loadArchiveFromServer() {
    try {
      setSyncStatus('공동 장부 여는 중');
      const auth = await resolveArchiveAuth();
      const result = await loadServerSync<ArchiveSyncPayload>('archive', auth.syncKey, {
        authSession: auth.authSession,
      });
      setHasArchiveConflict(false);
      if (result.exists && result.saved?.data) {
        if (result.saved.data.drafts) {
          writeArchiveDrafts(result.saved.data.drafts);
        }
        if (result.saved.data.siteText) {
          const nextSiteText = mergeSiteText(result.saved.data.siteText);
          writeSiteTextDraft(nextSiteText);
          setSiteTextForm(nextSiteText);
        }
        if (result.saved.data.references) {
          writeArchiveReferenceDrafts(result.saved.data.references);
        }
        if (result.saved.data.publications) {
          writeArchivePublications(result.saved.data.publications);
        }
        const nextEvents = applyArchiveDrafts(events);
        const nextSelected = nextEvents.find((event) => event.id === selectedId) ?? nextEvents[0];
        setForm(toFormState(nextSelected));
        const nextReferences = applyArchiveReferenceDrafts(archiveReferences);
        const nextReference = nextReferences.find((reference) => reference.id === selectedReferenceId) ?? nextReferences[0];
        setSelectedReferenceId(nextReference.id);
        setReferenceForm(toReferenceForm(nextReference));
        setArchiveSavedAt(result.saved.savedAt);
        setVersion((current) => current + 1);
        setSyncStatus(`공동 장부 적용됨 / ${timeLabel(new Date(result.saved.savedAt))}`);
      } else {
        setArchiveSavedAt(null);
        setSyncStatus('공동 장부에 보존된 초안 없음');
      }
    } catch (error) {
      console.error('Archive server load failed:', error);
      setSyncStatus('공동 장부 열람 실패 / 열쇠 또는 연결 확인');
    }
  }

  function downloadArchiveDrafts() {
    const payload = {
      type: 'jerboa-archive-drafts',
      version: 2,
      exportedAt: new Date().toISOString(),
      drafts: readArchiveDrafts(),
      references: readArchiveReferenceDrafts(),
      publications: readArchivePublications(),
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
      setPendingAction({ kind: 'import', ...parsed });
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
    clearAllArchiveReferenceDrafts();
    const baseEvent = events.find((event) => event.id === selectedId) ?? events[0];
    setSelectedId(baseEvent.id);
    setForm(toFormState(baseEvent));
    setSelectedReferenceId(archiveReferences[0].id);
    setReferenceForm(toReferenceForm(archiveReferences[0]));
    setVersion((current) => current + 1);
    setSyncStatus('모든 로컬 초안 삭제됨');
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
    setVersion((current) => current + 1);
    setSyncStatus('선택한 초안 이력으로 되돌림 / 확인 후 공동 장부에 봉인하세요');
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

  async function performPublication() {
    const validation = validateKeeperForm(form, archiveEvents, referenceRecords);
    if (validation) {
      setSyncStatus(`발행 보류 / ${validation}`);
      return;
    }
    const issues = inspectPublicationReadiness(publicationCandidate, archiveEvents, referenceRecords);
    const errors = issues.filter((issue) => issue.severity === 'error');
    if (errors.length > 0) {
      setSyncStatus(`발행 보류 / ${errors[0].message}`);
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
    const payload = createArchiveSyncPayload({ drafts: nextDrafts, publications: nextPublications });

    try {
      setSyncStatus('발행본 검증과 공동 장부 봉인 중');
      const result = await saveServerSync<ArchiveSyncPayload>('archive', payload, auth.syncKey, {
        baseSavedAt: archiveSavedAt,
        authSession: auth.authSession,
      });
      writeArchiveDraft(selectedEvent.id, publishedDraft, { label: `published / ${manifest.contentHash}` });
      writeArchivePublications(nextPublications);
      setArchiveSavedAt(result.savedAt || archiveSavedAt);
      setHasArchiveConflict(false);
      setForm(toFormState(publicationCandidate));
      setVersion((current) => current + 1);
      setSyncStatus(`판본 발행 완료 / ${manifest.contentHash} / ${timeLabel(result.savedAt ? new Date(result.savedAt) : new Date())}`);
    } catch (error) {
      if (error instanceof ServerSyncError && (error.message === 'sync_conflict' || error.message === 'publication_history_conflict')) {
        captureArchiveRecovery('publication_conflict', error.savedAt, payload);
        setArchiveSavedAt(error.savedAt || archiveSavedAt);
        setHasArchiveConflict(true);
        setSyncStatus('발행 보류 / 공동 장부 이력을 먼저 열람하세요');
        return;
      }
      console.error('Archive publication failed:', error);
      setSyncStatus('판본 발행 실패 / 열쇠 또는 연결을 확인하세요');
    }
  }

  async function confirmPendingAction() {
    if (!pendingAction) return;
    if (pendingAction.kind === 'import') {
      writeArchiveDrafts(pendingAction.drafts);
      writeArchiveReferenceDrafts(pendingAction.references);
      writeArchivePublications(pendingAction.publications);
      const nextEvents = applyArchiveDrafts(events);
      const nextSelected = nextEvents.find((event) => event.id === selectedId) ?? nextEvents[0];
      setForm(toFormState(nextSelected));
      setVersion((current) => current + 1);
      setSyncStatus(`검증된 초안 파일 적용됨 / 기록 ${pendingAction.recordCount}개 · 자료 ${pendingAction.referenceCount}개 · 발행본 ${pendingAction.publicationCount}개`);
    } else if (pendingAction.kind === 'clear') {
      performClearEveryDraft();
    } else if (pendingAction.kind === 'publish') {
      await performPublication();
    } else if (pendingAction.kind === 'delete-record') {
      performDeleteRecord(pendingAction.id);
    } else if (pendingAction.kind === 'delete-reference') {
      performDeleteReference(pendingAction.id);
    } else if (pendingAction.kind === 'restore-publication') {
      performRestorePublication(pendingAction.publicationId);
    } else {
      performRestoreRevision(pendingAction.revisionId);
    }
    setPendingAction(null);
  }

  async function readPosterFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setSyncStatus('포스터를 웹용으로 줄이는 중');
      const resizedPoster = await resizeImage(file, 1600, 2200);
      updateField('posterImage', resizedPoster);
      setSyncStatus('포스터 이미지 준비됨');
    } catch (error) {
      console.error('Poster upload failed:', error);
      setSyncStatus('포스터를 읽을 수 없음');
    } finally {
      event.currentTarget.value = '';
    }
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

      <main className="keeper-room">
        <section className="keeper-command-bar" aria-label="Keeper save and sync controls">
          <div className="keeper-command-state">
            <strong lang="ko">Keeper 입장 확인됨</strong>
            <small role="status" aria-live="polite" lang="ko">{syncStatus}</small>
          </div>
          <div className="keeper-command-primary">
            <button type="button" onClick={saveArchiveToServer}><span lang="ko">공동 장부에 봉인</span></button>
            <button type="button" onClick={loadArchiveFromServer}><span lang="ko">장부 열람</span></button>
          </div>
          <details className="keeper-command-more">
            <summary lang="ko">백업과 관리</summary>
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
              <button type="button" onClick={clearEveryDraft}><span lang="ko">로컬 초안 모두 삭제</span></button>
              <button type="button" onClick={leaveKeeperDesk}><span lang="ko">Keeper 입장 종료</span></button>
            </div>
          </details>
          {hasArchiveConflict && (
            <p className="keeper-sync-conflict" role="alert" lang="ko">
              공동 장부가 다른 곳에서 먼저 바뀌었습니다. 장부를 열람한 뒤 다시 봉인하세요.
              {hasArchiveRecovery && (
                <button type="button" onClick={() => downloadLatestSyncRecovery('archive')}><span lang="ko">로컬 복구 파일 받기</span></button>
              )}
            </p>
          )}
        </section>
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
                : isDirty ? '저장되지 않은 수정 있음' : `저장된 초안 ${draftCount}`}
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
          {mode === 'events' && (
            <button className="keeper-new-record" type="button" onClick={createNewRecord}>
              <span lang="ko">아직 필사되지 않은 장 추가</span>
            </button>
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
            <div className="keeper-list">
              {visibleArchiveEvents.map((event) => (
                <button
                  className={event.id === selectedId ? 'is-selected' : ''}
                  key={event.id}
                  onClick={() => selectEvent(event)}
                  type="button"
                >
                  <span>{event.edition}</span>
                  <strong>{event.title}</strong>
                  <small>{event.workflowStatus} / {event.visibility}</small>
                </button>
              ))}
              {visibleArchiveEvents.length === 0 && <p className="keeper-list-empty" lang="ko">찾는 프로그램이 없습니다.</p>}
            </div>
          ) : mode === 'references' ? (
            <div className="keeper-list">
              {visibleReferenceRecords.map((reference) => (
                <button
                  className={reference.id === selectedReferenceId ? 'is-selected' : ''}
                  key={reference.id}
                  onClick={() => selectReference(reference)}
                  type="button"
                >
                  <span lang="ko">{archiveReferenceKindLabel(reference.kind)}</span>
                  <strong>{reference.title}</strong>
                  <small>
                    {reference.updatedAt
                      ? `최근 수정 ${new Date(reference.updatedAt).toLocaleString('ko-KR')}`
                      : reference.creator ?? reference.attribution ?? reference.id}
                  </small>
                </button>
              ))}
              {visibleReferenceRecords.length === 0 && <p className="keeper-list-empty" lang="ko">찾는 자료가 없습니다.</p>}
            </div>
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
          <section className="keeper-editor godmode-editor" aria-label="Site text editor">
            <div className="keeper-preview godmode-preview">
              <div>
                <span>🜔 Scriptorium</span>
                <h2>Text register</h2>
                <p lang="ko">공개 기록벽에 반복해서 나타나는 문장을 이곳에서 직접 고칩니다.</p>
              </div>
            </div>

            <form className="keeper-form godmode-form" onSubmit={saveSiteTextDraft}>
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

              <div className="keeper-actions">
                <button className="archive-cta" type="submit"><span className="archive-cta-label" lang="ko">문구 초안 봉인</span></button>
                <button className="archive-cta inverse" onClick={resetSiteTextDraft} type="button"><span className="archive-cta-label" lang="ko">문구 원본 복원</span></button>
                <button className="archive-cta" onClick={saveArchiveToServer} type="button"><span className="archive-cta-label" lang="ko">공동 장부에 봉인</span></button>
                <a className="archive-cta" href="/"><span className="archive-cta-label" lang="ko">공개 화면 보기</span></a>
              </div>
            </form>
          </section>
        ) : mode === 'references' ? (
          <section className="keeper-editor" aria-label="Selected reference editor">
            <div className="keeper-preview godmode-preview">
              <div>
                <span lang="ko">{archiveReferenceKindLabel(referenceForm.kind)}</span>
                <h2>{referenceForm.title}</h2>
                <p lang="ko">{referenceForm.description}</p>
              </div>
            </div>

            <form className="keeper-form" onSubmit={saveReferenceDraft}>
              <div className="keeper-editor-heading">
                <p className="section-kicker"><span lang="en">Reference node</span> / <span lang="ko">자료 편집 중</span></p>
                <h2>{referenceForm.title}</h2>
              </div>

              <div className="keeper-field-grid">
                <label className="keeper-field">
                  <span lang="ko">자료 ID</span>
                  <input value={referenceForm.id} readOnly />
                </label>
                <label className="keeper-field">
                  <span lang="ko">종류</span>
                  <select value={referenceForm.kind} onChange={(event) => updateReferenceField('kind', event.target.value as ArchiveReferenceKind)}>
                    <option value="book">book</option>
                    <option value="artwork">artwork</option>
                    <option value="quotation">quotation</option>
                    <option value="image">image</option>
                    <option value="place">place</option>
                    <option value="theme">theme</option>
                  </select>
                </label>
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

              {referenceForm.mediaAssetId && (
                <label className="keeper-field">
                  <span lang="ko">검증된 도판 파일</span>
                  <input value={referenceForm.mediaAssetId} readOnly />
                </label>
              )}

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

              <div className="keeper-actions">
                <button className="archive-cta" type="submit"><span className="archive-cta-label" lang="ko">자료 초안 봉인</span></button>
                <button className="archive-cta inverse" onClick={resetReferenceDraft} type="button"><span className="archive-cta-label" lang="ko">자료 원본 복원</span></button>
                <button className="archive-cta" onClick={saveArchiveToServer} type="button"><span className="archive-cta-label" lang="ko">공동 장부에 봉인</span></button>
                <a className="archive-cta" href={`/catalogue/${referenceForm.id}/`}><span className="archive-cta-label" lang="ko">공개 자료 보기</span></a>
                <button className="archive-cta keeper-danger-action" onClick={requestDeleteReference} type="button"><span className="archive-cta-label" lang="ko">자료 삭제</span></button>
              </div>
            </form>
          </section>
        ) : (
          <section className="keeper-editor" aria-label="Selected archive record editor">
          <div className="keeper-preview">
            <img src={form.posterImage} alt={`${form.title} poster preview`} />
          </div>

          <form className="keeper-form" onSubmit={saveDraft}>
            <div className="keeper-editor-heading">
              <p className="section-kicker"><span lang="en">{selectedEvent.edition}</span> / <span lang="ko">편집 중</span></p>
              <h2>{form.title}</h2>
            </div>

            <label className="keeper-field">
              <span lang="ko">판본</span>
              <input value={form.edition} onChange={(event) => updateField('edition', event.target.value)} />
            </label>

            <label className="keeper-field">
              <span lang="ko">제목</span>
              <input value={form.title} onChange={(event) => updateField('title', event.target.value)} />
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
                  <option value="current">current</option>
                  <option value="upcoming">upcoming</option>
                  <option value="past">past</option>
                </select>
              </label>
            </div>

            <div className="keeper-field-grid">
              <label className="keeper-field">
                <span lang="ko">종류</span>
                <span className="keeper-inline-create">
                  <input
                    list="archive-content-kinds"
                    value={form.kind}
                    onChange={(event) => updateField('kind', event.target.value as ArchiveContentKind)}
                    placeholder="기존 종류 선택 또는 새 종류 입력"
                  />
                  <small lang="ko">목록에 없는 이름을 입력하면 새 종류로 저장됩니다.</small>
                </span>
                <datalist id="archive-content-kinds">
                  {programmeKinds.map((kind) => <option value={kind} key={kind} />)}
                </datalist>
              </label>

              <label className="keeper-field">
                <span lang="ko">공개 상태</span>
                <select value={form.visibility} onChange={(event) => updateField('visibility', event.target.value as ArchiveVisibility)}>
                  <option value="public">public</option>
                  <option value="unlisted">unlisted</option>
                  <option value="private">private</option>
                </select>
              </label>
            </div>

            <label className="keeper-field">
              <span lang="ko">발행 단계</span>
              <select value={form.workflowStatus} onChange={(event) => updateField('workflowStatus', event.target.value as ArchiveWorkflowStatus)}>
                <option value="draft">draft</option>
                <option value="preview">preview</option>
                <option value="published">published</option>
                <option value="archived">archived</option>
              </select>
            </label>

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
              description="이 프로그램이 나타날 공개 묶음을 선택합니다. ID를 직접 입력할 필요가 없습니다."
              options={archiveCollections.map((collection) => ({
                id: collection.id,
                title: collection.title,
                meta: collection.visibility,
              }))}
              selectedIds={splitDraftList(form.collectionIdsText)}
              onChange={(ids) => updateField('collectionIdsText', ids.join(' / '))}
            />

            <label className="keeper-field">
              <span lang="ko">포스터 이미지 URL</span>
              <input value={form.posterImage} onChange={(event) => updateField('posterImage', event.target.value)} />
            </label>

            <div className="keeper-poster-upload">
              <figure>
                <img src={form.posterImage} alt="" />
              </figure>
              <label className="keeper-field">
                <span lang="ko">포스터 이미지 업로드</span>
                <small lang="ko">파일을 올리면 웹용 크기로 줄인 뒤 이 프로그램 기록에 붙습니다</small>
                <input accept="image/*" onChange={readPosterFile} type="file" />
              </label>
            </div>

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

            <label className="keeper-field">
              <span lang="ko">여정 단계</span>
              <textarea
                rows={3}
                value={form.passageText}
                onChange={(event) => updateField('passageText', event.target.value)}
              />
            </label>

            <label className="keeper-field">
              <span lang="ko">자료 묶음</span>
              <textarea
                rows={3}
                value={form.materialsText}
                onChange={(event) => updateField('materialsText', event.target.value)}
              />
            </label>

            <label className="keeper-field">
              <span lang="ko">주제</span>
              <textarea
                rows={3}
                value={form.themesText}
                onChange={(event) => updateField('themesText', event.target.value)}
              />
            </label>

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
            />

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

            <div className="keeper-actions">
              <button className="archive-cta" type="submit"><span className="archive-cta-label" lang="ko">초안 봉인</span></button>
              <button className="archive-cta inverse" onClick={resetDraft} type="button"><span className="archive-cta-label" lang="ko">원본 복원</span></button>
              <button className="archive-cta" onClick={saveArchiveToServer} type="button"><span className="archive-cta-label" lang="ko">공동 장부에 봉인</span></button>
              <a className="archive-cta" href="/"><span className="archive-cta-label" lang="ko">공개 화면 보기</span></a>
              <button className="archive-cta keeper-danger-action" onClick={requestDeleteRecord} type="button"><span className="archive-cta-label" lang="ko">프로그램 삭제</span></button>
            </div>

            <aside className="keeper-publication-panel" aria-label="Publication preflight">
              <div>
                <span lang="en">Publication preflight</span>
                <strong lang="ko">
                  {publicationErrorCount > 0
                    ? `발행 보류 ${publicationErrorCount}건${publicationWarningCount > 0 ? ` · 경고 ${publicationWarningCount}건` : ''}`
                    : `발행 가능${publicationWarningCount > 0 ? ` · 경고 ${publicationWarningCount}건` : ''}`}
                </strong>
              </div>
              <p lang="ko">
                일반 봉인은 초안을 저장합니다. 판본 발행은 공개 상태·자료 관계·도판 권리를 다시 검사하고 변경할 수 없는 발행 지문을 남깁니다.
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
              <button type="button" disabled={publicationErrorCount > 0} onClick={requestPublication}>
                <span lang="ko">검사 후 판본 발행</span>
              </button>
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
                <p lang="ko">아직 되돌릴 수 있는 초안 이력이 없습니다.</p>
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
          </form>
          </section>
        )}
      </main>
      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.kind === 'import'
          ? '검증된 초안 파일을 적용할까요?'
          : pendingAction?.kind === 'clear'
            ? '모든 로컬 초안을 지울까요?'
            : pendingAction?.kind === 'publish'
              ? '이 판본을 공개 발행할까요?'
              : pendingAction?.kind === 'delete-record'
                ? '이 프로그램을 삭제할까요?'
                : pendingAction?.kind === 'delete-reference'
                  ? '이 자료를 삭제할까요?'
              : pendingAction?.kind === 'restore-publication'
                ? '이 발행본에서 복구 초안을 만들까요?'
              : '이전 초안으로 되돌릴까요?'}
        description={pendingAction?.kind === 'import'
          ? `기록 ${pendingAction.recordCount}개, 자료 ${pendingAction.referenceCount}개, 발행본 ${pendingAction.publicationCount}개와 필드 ${pendingAction.fieldCount}개를 확인했습니다. 현재 로컬 초안은 이 파일의 내용으로 교체됩니다.`
          : pendingAction?.kind === 'clear'
            ? '공개 원본은 유지되지만, 이 기기에 저장된 모든 수정 초안이 사라집니다. 먼저 파일 백업을 받는 것이 안전합니다.'
            : pendingAction?.kind === 'publish'
              ? `“${pendingAction.title}”을 공동 장부에 공개하고 발행 지문을 보존합니다.${pendingAction.warningCount > 0 ? ` 경고 ${pendingAction.warningCount}건은 확인 후에도 남습니다.` : ''}`
              : pendingAction?.kind === 'delete-record'
                ? `“${pendingAction.title}”을 삭제 보관함으로 옮깁니다. 다른 프로그램의 직접 연결도 함께 정리되며, 삭제 보관함에서 복원할 수 있습니다.`
                : pendingAction?.kind === 'delete-reference'
                  ? `“${pendingAction.title}”을 삭제 보관함으로 옮깁니다. 프로그램과 하위 자료의 연결도 함께 정리되며, 삭제 보관함에서 복원할 수 있습니다.`
              : pendingAction?.kind === 'restore-publication'
                ? `“${pendingAction.title}”의 발행본 ${pendingAction.contentHash}에서 새 초안을 만듭니다. 발행 이력은 바뀌지 않으며, 초안은 안전하게 미리보기·비목록 상태로 시작합니다.`
              : `“${pendingAction?.kind === 'restore' ? pendingAction.title : ''}” 저장본으로 되돌립니다. 현재 초안은 새 이력으로 남습니다.`}
        confirmLabel={pendingAction?.kind === 'import'
          ? '검증 파일 적용'
          : pendingAction?.kind === 'clear'
            ? '로컬 초안 삭제'
            : pendingAction?.kind === 'publish'
              ? '판본 발행'
              : pendingAction?.kind === 'delete-record'
                ? '프로그램 삭제'
                : pendingAction?.kind === 'delete-reference'
                  ? '자료 삭제'
                  : pendingAction?.kind === 'restore-publication'
                    ? '복구 초안 만들기'
                    : '이 버전 복원'}
        tone={pendingAction?.kind === 'clear' || pendingAction?.kind === 'delete-record' || pendingAction?.kind === 'delete-reference' ? 'danger' : 'default'}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => { void confirmPendingAction(); }}
      />
    </div>
  );
}
