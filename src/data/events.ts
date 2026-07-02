import scintillaPoster from '../assets/posters/scintilla-animae.svg';
import readingPoster from '../assets/posters/reading-edge-room.svg';
import lettersPoster from '../assets/posters/letters-unmade-places.svg';
import museumPoster from '../assets/posters/museum-after-hours.svg';

export type EventStatus = 'upcoming' | 'past' | 'current';

export interface ArchiveEvent {
  id: string;
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
  passage: string[];
  materials: string[];
  themes: string[];
  location: string;
  ctaLabel: string;
  ctaHref: string;
}

export const events: ArchiveEvent[] = [
  {
    id: 'scintilla-animae',
    edition: 'Edition 006',
    title: 'Scintilla Animae',
    subtitle: 'Grail / Forest / Relic / Rose / Fire / Star',
    latinQuote: 'Surge, amica mea, speciosa mea, et veni',
    marginalia: '질문은 성배에서 시작하여 별 아래에서 끝난다.',
    date: '현재 진행 중인 프로그램',
    status: 'current',
    posterImage: scintillaPoster,
    shortDescription:
      '여섯 개의 불씨를 따라 걷는 상징적 순례.',
    longDescription:
      '『아가서』의 부름에서 출발해 『신곡』의 어두운 숲, 『욥기』의 아침 별, 성배 문학의 침묵을 거친다. 여섯 표식은 답이 아니라 서로를 비추는 통과 지점이다.',
    passage: ['부름', '숲', '질문', '불씨', '귀환'],
    materials: ['Canticum 2:13', 'Dante: selva oscura', 'Job 38:7', 'Grail question'],
    themes: ['Grail', 'Forest', 'Relic', 'Rose', 'Fire', 'Star'],
    location: '저보아 서클 / 비공개 프로그램',
    ctaLabel: '기록에 들어가기',
    ctaHref: './archive/scintilla-animae/',
  },
  {
    id: 'reading-edge-room',
    edition: 'Edition 005',
    title: 'A Reading at the Edge of the Room',
    subtitle: 'Voice, margin, and winter text',
    latinQuote: 'In story stiff and strong',
    marginalia: '글자는 소리보다 늦게 사라지고, 여백은 마지막 독자를 기다린다.',
    date: '기록 I',
    status: 'past',
    posterImage: readingPoster,
    shortDescription:
      '낭독과 주석이 방의 가장자리에서 만나는 겨울 기록',
    longDescription:
      '방 자체를 여백으로 다룬 기록이다. 『가웨인 경과 녹색 기사』의 단단한 글자처럼, 목소리와 메모가 하나의 장면 안에서 오래 버티는 방식을 읽었다.',
    passage: ['낭독', '침묵', '여백', '잔향'],
    materials: ['Sir Gawain', 'voice', 'margin', 'winter room'],
    themes: ['Reading', 'Voice', 'Margin'],
    location: '테이블 모임',
    ctaLabel: '기록 읽기',
    ctaHref: './archive/reading-edge-room/',
  },
  {
    id: 'letters-unmade-places',
    edition: 'Edition 004',
    title: 'Letters to Unmade Places',
    subtitle: 'Absence, address, and future place',
    latinQuote: 'Ostende mihi faciem tuam',
    marginalia: '주소가 없을 때 편지는 장소보다 먼저 도착한다.',
    date: '기록 II',
    status: 'past',
    posterImage: lettersPoster,
    shortDescription:
      '아직 만들어지지 않은 장소와 미래의 자아에게 보내는 서신 연구',
    longDescription:
      '서간의 파편과 불가능한 주소를 다룬다. 아직 형체를 갖지 못한 것에 닿기 위한 의식으로서 편지를 읽고 썼으며, 보이지 않는 얼굴을 부르는 문장들을 모았다.',
    passage: ['발신', '거리', '불가능한 주소', '응답'],
    materials: ['Song 2:14', 'letter', 'absence', 'future place'],
    themes: ['Letter', 'Distance', 'Fragment'],
    location: '서신 원탁',
    ctaLabel: '기록 열기',
    ctaHref: './archive/letters-unmade-places/',
  },
  {
    id: 'museum-after-hours',
    edition: 'Edition 003',
    title: 'The Museum After Hours',
    subtitle: 'Object, label, and afterimage',
    latinQuote: 'E quindi uscimmo a riveder le stelle',
    marginalia: '닫힌 문 뒤에서 사물은 설명을 멈추고 기억이 된다.',
    date: '기록 III',
    status: 'past',
    posterImage: museumPoster,
    shortDescription:
      '기관이 닫힌 뒤 사물이 다르게 말하기 시작하는 시간을 바라본 기록',
    longDescription:
      '부재와 전시와 잔상을 느리게 바라보는 연습이다. 박물관 라벨의 엄격함을 지나, 기록이 사물을 다시 보존하는 방식을 살폈다.',
    passage: ['폐관', '응시', '잔상', '보존'],
    materials: ['Dante: stelle', 'museum label', 'object', 'afterimage'],
    themes: ['Museum', 'Image', 'Afterimage'],
    location: '감상 세션',
    ctaLabel: '기록 보기',
    ctaHref: './archive/museum-after-hours/',
  },
];

export const featuredEvent = events.find((event) => event.status === 'current') ?? events[0];

export function getEventById(id: string | undefined) {
  return events.find((event) => event.id === id);
}
