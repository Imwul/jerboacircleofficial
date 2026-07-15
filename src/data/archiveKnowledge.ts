import type { ArchiveEvent } from './events';

export type ArchiveReferenceKind = 'book' | 'artwork' | 'quotation' | 'image' | 'place' | 'theme';
export type ArchiveRelationKind = 'chronology' | 'shared-source' | 'thematic';

export interface ArchiveReference {
  id: string;
  kind: ArchiveReferenceKind;
  title: string;
  attribution?: string;
  creator?: string;
  date?: string;
  edition?: string;
  locator?: string;
  sourceUrl?: string;
  rights?: string;
  language?: string;
  citationNote?: string;
  altText?: string;
  description: string;
  parentId?: string;
}

export interface ArchiveProgrammeRelation {
  id: string;
  fromEventId: string;
  toEventId: string;
  kind: ArchiveRelationKind;
  note: string;
  referenceIds?: string[];
  themeLabels?: string[];
}

export interface ArchiveProgrammeConnection {
  event: ArchiveEvent;
  kind: ArchiveRelationKind | 'editorial' | 'shared-reference' | 'shared-theme';
  direction: 'earlier' | 'later' | 'parallel';
  note: string;
  references: ArchiveReference[];
  sharedThemes: string[];
}

export const archiveReferences: ArchiveReference[] = [
  {
    id: 'canticum-canticorum',
    kind: 'book',
    title: 'Canticum Canticorum',
    attribution: 'Song of Songs',
    language: 'Latin',
    rights: 'Public-domain source text',
    citationNote: 'Canticum Canticorum, chapter 2. Edition varies by programme.',
    description: 'Edition 004의 2:14와 Edition 006의 2:13을 잇는 공통 원전.',
  },
  {
    id: 'song-2-13',
    kind: 'quotation',
    title: 'Surge, amica mea, speciosa mea, et veni',
    attribution: 'Canticum Canticorum 2:13',
    locator: '2:13',
    language: 'Latin',
    rights: 'Public-domain source text',
    citationNote: 'Canticum Canticorum 2:13.',
    description: 'Scintilla Animae의 문을 여는 부름.',
    parentId: 'canticum-canticorum',
  },
  {
    id: 'song-2-14',
    kind: 'quotation',
    title: 'Ostende mihi faciem tuam',
    attribution: 'Canticum Canticorum 2:14',
    locator: '2:14',
    language: 'Latin',
    rights: 'Public-domain source text',
    citationNote: 'Canticum Canticorum 2:14.',
    description: '보이지 않는 얼굴과 응답을 요청하는 문장.',
    parentId: 'canticum-canticorum',
  },
  {
    id: 'divine-comedy',
    kind: 'book',
    title: 'Divina Commedia',
    attribution: 'Dante Alighieri',
    creator: 'Dante Alighieri',
    language: 'Italian',
    rights: 'Public-domain source text',
    citationNote: 'Dante Alighieri, Divina Commedia. Edition varies by programme.',
    description: '어두운 숲과 다시 보는 별을 통해 Edition 003과 Edition 006을 잇는 원전.',
  },
  {
    id: 'selva-oscura',
    kind: 'quotation',
    title: 'selva oscura',
    attribution: 'Inferno I',
    locator: 'Inferno, Canto I',
    language: 'Italian',
    rights: 'Public-domain source text',
    citationNote: 'Dante Alighieri, Inferno, Canto I.',
    description: '길을 잃는 장면을 하나의 읽기 방법으로 바꾸는 구절.',
    parentId: 'divine-comedy',
  },
  {
    id: 'riveder-le-stelle',
    kind: 'quotation',
    title: 'E quindi uscimmo a riveder le stelle',
    attribution: 'Inferno XXXIV.139',
    locator: 'Inferno XXXIV.139',
    language: 'Italian',
    rights: 'Public-domain source text',
    citationNote: 'Dante Alighieri, Inferno XXXIV.139.',
    description: '폐관 이후의 시선과 귀환을 연결하는 마지막 행.',
    parentId: 'divine-comedy',
  },
  {
    id: 'book-of-job',
    kind: 'book',
    title: 'Book of Job',
    rights: 'Public-domain source text; translation rights vary',
    citationNote: 'Book of Job. Translation and edition vary by programme.',
    description: '질문에 답하는 대신 질문의 규모를 넓히는 원전.',
  },
  {
    id: 'job-38-7',
    kind: 'quotation',
    title: 'Job 38:7',
    attribution: 'Book of Job',
    locator: '38:7',
    rights: 'Source text is public domain; translation rights vary',
    citationNote: 'Book of Job 38:7. Translation varies by programme.',
    description: '아침 별의 이미지로 프로그램의 마지막 표식을 지지하는 구절.',
    parentId: 'book-of-job',
  },
  {
    id: 'perceval',
    kind: 'book',
    title: 'Perceval, le Conte du Graal',
    attribution: 'Chrétien de Troyes',
    creator: 'Chrétien de Troyes',
    language: 'Old French',
    rights: 'Public-domain source text',
    citationNote: 'Chrétien de Troyes, Perceval, le Conte du Graal. Edition varies by programme.',
    description: '성배 앞에서 무엇을 물어야 하는가라는 질문의 문학적 계보.',
  },
  {
    id: 'grail-question',
    kind: 'theme',
    title: 'The Grail question',
    citationNote: 'Jerboa Circle thematic node derived from Perceval, le Conte du Graal.',
    description: '페르스발이 묻지 못한 질문과 그 책임을 중심에 놓는 반복 주제.',
    parentId: 'perceval',
  },
  {
    id: 'sir-gawain',
    kind: 'book',
    title: 'Sir Gawain and the Green Knight',
    attribution: 'Anonymous',
    creator: 'Anonymous',
    language: 'Middle English',
    rights: 'Public-domain source text',
    citationNote: 'Sir Gawain and the Green Knight. Edition varies by programme.',
    description: '목소리, 단단한 글자와 겨울의 방을 연결하는 중세 영어 원전.',
  },
  {
    id: 'stori-stif',
    kind: 'quotation',
    title: 'In stori stif and stronge',
    attribution: 'Sir Gawain and the Green Knight, line 34',
    locator: 'Line 34',
    language: 'Middle English',
    rights: 'Public-domain source text',
    citationNote: 'Sir Gawain and the Green Knight, line 34.',
    description: 'Edition 005에서 낭독과 기록이 오래 버티는 방식을 설명하는 행.',
    parentId: 'sir-gawain',
  },
  {
    id: 'winter-room',
    kind: 'place',
    title: 'The winter room',
    citationNote: 'Jerboa Circle programme place node.',
    description: '목소리, 침묵과 여백이 한 장면에 머무는 장소.',
  },
  {
    id: 'unmade-place',
    kind: 'place',
    title: 'An unmade place',
    citationNote: 'Jerboa Circle programme place node.',
    description: '주소보다 편지가 먼저 도착하는 가상의 수신지.',
  },
  {
    id: 'museum-after-hours-place',
    kind: 'place',
    title: 'The museum after hours',
    citationNote: 'Jerboa Circle programme place node.',
    description: '라벨의 설명이 멈춘 뒤 사물과 잔상이 다시 읽히는 장소.',
  },
  {
    id: 'grail-table-plate',
    kind: 'image',
    title: 'Grail table plate',
    attribution: 'Jerboa Circle image archive',
    rights: 'Jerboa Circle archive; reuse by permission',
    altText: '성배의 질문과 원탁의 관계를 다루는 중세 도판.',
    citationNote: 'Jerboa Circle image archive, Grail table plate.',
    description: 'Scintilla Animae에서 질문과 원탁의 관계를 여는 도판.',
  },
  {
    id: 'bestiary-margin-plate',
    kind: 'image',
    title: 'Bestiary margin plate',
    attribution: 'Jerboa Circle image archive',
    rights: 'Jerboa Circle archive; reuse by permission',
    altText: '낭독과 여백의 관계를 보여주는 중세 필사본 가장자리 도판.',
    citationNote: 'Jerboa Circle image archive, Bestiary margin plate.',
    description: 'Edition 005의 목소리와 여백을 시각적으로 연결하는 도판.',
  },
  {
    id: 'love-window-plate',
    kind: 'image',
    title: 'Love window plate',
    attribution: 'Jerboa Circle image archive',
    rights: 'Jerboa Circle archive; reuse by permission',
    altText: '보이지 않는 얼굴과 먼 수신지를 연결하는 창문 도상.',
    citationNote: 'Jerboa Circle image archive, Love window plate.',
    description: '보이지 않는 얼굴과 먼 수신지를 연결하는 도판.',
  },
  {
    id: 'dante-stars-plate',
    kind: 'image',
    title: 'Dante stars plate',
    attribution: 'Jerboa Circle image archive',
    rights: 'Jerboa Circle archive; reuse by permission',
    altText: '어두운 공간을 지나 다시 별을 바라보는 장면의 도판.',
    citationNote: 'Jerboa Circle image archive, Dante stars plate.',
    description: '폐관 이후의 별과 Scintilla Animae의 마지막 표식을 잇는 도판.',
  },
];

export const archiveProgrammeRelations: ArchiveProgrammeRelation[] = [
  {
    id: 'edition-003-to-004',
    fromEventId: 'museum-after-hours',
    toEventId: 'letters-unmade-places',
    kind: 'chronology',
    note: '사물에 붙은 라벨을 읽는 일은 다음 판본에서 주소가 없는 편지를 쓰는 일로 이어진다.',
    themeLabels: ['Fragment'],
  },
  {
    id: 'edition-004-to-005',
    fromEventId: 'letters-unmade-places',
    toEventId: 'reading-edge-room',
    kind: 'chronology',
    note: '서신의 발신과 응답 구조는 다음 판본에서 낭독과 잔향의 구조로 이어진다.',
    themeLabels: ['Voice', 'Letter'],
  },
  {
    id: 'edition-005-to-006',
    fromEventId: 'reading-edge-room',
    toEventId: 'scintilla-animae',
    kind: 'chronology',
    note: '목소리와 여백에 대한 질문은 성배 문학, 숲과 별을 함께 읽는 현재 판본으로 확장된다.',
    themeLabels: ['Reading', 'Forest'],
  },
  {
    id: 'song-of-songs-across-editions',
    fromEventId: 'letters-unmade-places',
    toEventId: 'scintilla-animae',
    kind: 'shared-source',
    note: '두 판본은 『아가서』 2장의 연속된 구절을 서로 다른 질문으로 읽는다.',
    referenceIds: ['canticum-canticorum', 'song-2-13', 'song-2-14'],
  },
  {
    id: 'dante-across-editions',
    fromEventId: 'museum-after-hours',
    toEventId: 'scintilla-animae',
    kind: 'shared-source',
    note: '단테의 어두운 숲과 다시 보는 별이 두 판본의 시작과 귀환을 연결한다.',
    referenceIds: ['divine-comedy', 'selva-oscura', 'riveder-le-stelle', 'dante-stars-plate'],
  },
];

export function getArchiveReference(id: string | undefined, references: ArchiveReference[] = archiveReferences) {
  return id ? references.find((reference) => reference.id === id) : undefined;
}

export function getArchiveReferencesForEvent(event: ArchiveEvent, references: ArchiveReference[] = archiveReferences) {
  return event.referenceIds
    .map((id) => getArchiveReference(id, references))
    .filter((reference): reference is ArchiveReference => Boolean(reference));
}

function compareDirection(current: ArchiveEvent, related: ArchiveEvent): ArchiveProgrammeConnection['direction'] {
  if (related.publishedAt < current.publishedAt) return 'earlier';
  if (related.publishedAt > current.publishedAt) return 'later';
  return 'parallel';
}

function sharedReferenceIds(a: ArchiveEvent, b: ArchiveEvent) {
  const bIds = new Set(b.referenceIds);
  return a.referenceIds.filter((id) => bIds.has(id));
}

function sharedThemeLabels(a: ArchiveEvent, b: ArchiveEvent) {
  const bThemes = new Set(b.themes.map((theme) => theme.toLowerCase()));
  return a.themes.filter((theme) => bThemes.has(theme.toLowerCase()));
}

export function getArchiveConnections(event: ArchiveEvent, records: ArchiveEvent[], references: ArchiveReference[] = archiveReferences) {
  const recordsById = new Map(records.map((record) => [record.id, record]));
  const connections = new Map<string, ArchiveProgrammeConnection>();

  archiveProgrammeRelations.forEach((relation) => {
    if (relation.fromEventId !== event.id && relation.toEventId !== event.id) return;
    const relatedId = relation.fromEventId === event.id ? relation.toEventId : relation.fromEventId;
    const related = recordsById.get(relatedId);
    if (!related) return;

    connections.set(related.id, {
      event: related,
      kind: relation.kind,
      direction: compareDirection(event, related),
      note: relation.note,
      references: (relation.referenceIds ?? [])
        .map((id) => getArchiveReference(id, references))
        .filter((reference): reference is ArchiveReference => Boolean(reference)),
      sharedThemes: relation.themeLabels ?? [],
    });
  });

  event.relatedEventIds.forEach((relatedId) => {
    if (connections.has(relatedId)) return;
    const related = recordsById.get(relatedId);
    if (!related) return;
    const references = sharedReferenceIds(event, related)
      .map((id) => getArchiveReference(id, references))
      .filter((reference): reference is ArchiveReference => Boolean(reference));
    const themes = sharedThemeLabels(event, related);

    connections.set(related.id, {
      event: related,
      kind: 'editorial',
      direction: compareDirection(event, related),
      note: references.length
        ? `공통 자료 ${references.map((reference) => reference.title).join(' / ')}에서 다시 만나는 판본.`
        : '아카이브의 편집 계보에서 직접 이어지는 판본.',
      references,
      sharedThemes: themes,
    });
  });

  records.forEach((related) => {
    if (connections.has(related.id) || !related.relatedEventIds.includes(event.id)) return;
    const references = sharedReferenceIds(event, related)
      .map((id) => getArchiveReference(id, references))
      .filter((reference): reference is ArchiveReference => Boolean(reference));
    const themes = sharedThemeLabels(event, related);

    connections.set(related.id, {
      event: related,
      kind: 'editorial',
      direction: compareDirection(event, related),
      note: references.length
        ? `공통 자료 ${references.map((reference) => reference.title).join(' / ')}에서 다시 만나는 판본.`
        : '다른 판본에서 이 기록으로 직접 이어진 편집 연결.',
      references,
      sharedThemes: themes,
    });
  });

  const chronologicalRecords = records
    .filter((record) => record.id !== event.id)
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  const nearestEarlier = [...chronologicalRecords]
    .reverse()
    .find((record) => record.publishedAt < event.publishedAt);
  const nearestLater = chronologicalRecords.find((record) => record.publishedAt > event.publishedAt);

  [nearestEarlier, nearestLater].forEach((related) => {
    if (!related || connections.has(related.id)) return;
    connections.set(related.id, {
      event: related,
      kind: 'chronology',
      direction: compareDirection(event, related),
      note: related.publishedAt < event.publishedAt
        ? '발행 순서에서 바로 앞선 판본. 다음 기록이 시작된 자리를 보여준다.'
        : '발행 순서에서 바로 이어지는 판본. 이 기록이 이후 어디로 이동했는지 보여준다.',
      references: [],
      sharedThemes: [],
    });
  });

  records.forEach((related) => {
    if (related.id === event.id || connections.has(related.id)) return;
    const referenceIds = sharedReferenceIds(event, related);
    const themes = sharedThemeLabels(event, related);
    if (referenceIds.length === 0 && themes.length === 0) return;
    const references = referenceIds
      .map((id) => getArchiveReference(id, references))
      .filter((reference): reference is ArchiveReference => Boolean(reference));

    connections.set(related.id, {
      event: related,
      kind: references.length ? 'shared-reference' : 'shared-theme',
      direction: compareDirection(event, related),
      note: references.length
        ? `공통 자료 ${references.map((reference) => reference.title).join(' / ')}를 함께 읽는 판본.`
        : `공통 주제 ${themes.join(' / ')}를 다른 시기에서 다시 다루는 판본.`,
      references,
      sharedThemes: themes,
    });
  });

  return [...connections.values()].sort((a, b) => {
    const distanceA = Math.abs(Date.parse(a.event.publishedAt) - Date.parse(event.publishedAt));
    const distanceB = Math.abs(Date.parse(b.event.publishedAt) - Date.parse(event.publishedAt));
    return distanceA - distanceB;
  });
}

export function archiveKnowledgeSearchText(event: ArchiveEvent, records: ArchiveEvent[], referenceRecords: ArchiveReference[] = archiveReferences) {
  const references = getArchiveReferencesForEvent(event, referenceRecords);
  const connections = getArchiveConnections(event, records, referenceRecords);
  return [
    ...references.flatMap((reference) => [
      reference.kind,
      reference.title,
      reference.attribution,
      reference.creator,
      reference.date,
      reference.edition,
      reference.locator,
      reference.rights,
      reference.language,
      reference.citationNote,
      reference.altText,
      reference.description,
    ]),
    ...connections.flatMap((connection) => [
      connection.event.edition,
      connection.event.title,
      connection.note,
      ...connection.sharedThemes,
    ]),
  ].filter(Boolean).join(' ');
}

export function archiveReferenceKindLabel(kind: ArchiveReferenceKind) {
  if (kind === 'book') return '책';
  if (kind === 'artwork') return '작품';
  if (kind === 'quotation') return '인용';
  if (kind === 'image') return '도판';
  if (kind === 'place') return '장소';
  return '주제';
}

export function archiveConnectionDirectionLabel(direction: ArchiveProgrammeConnection['direction']) {
  if (direction === 'earlier') return '이전 판본';
  if (direction === 'later') return '다음 판본';
  return '동시기 판본';
}
