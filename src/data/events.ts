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
    latinQuote: 'Scintilla animae lucet in tenebris',
    marginalia: '여섯 표식은 답이 아니라 통과 지점이다.',
    date: '현재 프로그램',
    status: 'current',
    posterImage: scintillaPoster,
    shortDescription:
      '성배 / 숲 / 성물 / 장미 / 불 / 별 / 여섯 불씨를 따라 읽는 상징적 순례',
    longDescription:
      '하나의 주제를 배우는 과정이 아니라 여섯 개의 표식을 통과하는 사적인 순례다. 텍스트, 이미지, 신화적 잔상, 종교적 언어, 기억의 단편이 서로를 비추며 임시적인 별자리를 이룬다.',
    passage: ['초대', '문턱', '통과', '변형', '귀환'],
    materials: ['medieval legend', 'symbolic image', 'close reading', 'ritual note'],
    themes: ['Grail', 'Forest', 'Relic', 'Rose', 'Fire', 'Star'],
    location: '저보아 서클 / 비공개 프로그램',
    ctaLabel: '기록에 들어가기',
    ctaHref: './archive/scintilla-animae/',
  },
  {
    id: 'reading-edge-room',
    edition: 'Edition 005',
    title: 'A Reading at the Edge of the Room',
    subtitle: 'Winter gathering for text and voice',
    latinQuote: 'In margine vox invenitur',
    marginalia: '목소리는 중심보다 가장자리에서 오래 남는다.',
    date: '기록 I',
    status: 'past',
    posterImage: readingPoster,
    shortDescription:
      '낭독과 주석이 방의 가장자리에서 서로를 비추던 겨울 기록',
    longDescription:
      '방 자체를 여백으로 다룬 기록이다. 짧은 텍스트와 파편, 가장자리의 메모, 목소리의 흔적이 더 큰 필사본의 문턱에서 만났다.',
    passage: ['입장', '낭독', '여백', '잔향'],
    materials: ['voice', 'margin', 'winter text', 'private annotation'],
    themes: ['Reading', 'Voice', 'Margin'],
    location: '테이블 모임',
    ctaLabel: '기록 읽기',
    ctaHref: './archive/reading-edge-room/',
  },
  {
    id: 'letters-unmade-places',
    edition: 'Edition 004',
    title: 'Letters to Unmade Places',
    subtitle: 'Correspondence study',
    latinQuote: 'Ad loca nondum facta',
    marginalia: '주소가 없을 때 편지는 더 먼 곳에 도착한다.',
    date: '기록 II',
    status: 'past',
    posterImage: lettersPoster,
    shortDescription:
      '아직 만들어지지 않은 장소와 미래의 자아에게 보내는 서신 연구',
    longDescription:
      '서간의 파편과 불가능한 주소를 다룬다. 아직 형체를 갖지 못한 것에 닿기 위한 의식으로서 편지를 읽고 썼다.',
    passage: ['발신', '거리', '불가능한 주소', '응답'],
    materials: ['letter', 'absence', 'future self', 'unbuilt place'],
    themes: ['Letter', 'Distance', 'Fragment'],
    location: '서신 원탁',
    ctaLabel: '기록 열기',
    ctaHref: './archive/letters-unmade-places/',
  },
  {
    id: 'museum-after-hours',
    edition: 'Edition 003',
    title: 'The Museum After Hours',
    subtitle: 'Slow looking session',
    latinQuote: 'Post horam objecta loquuntur',
    marginalia: '문이 닫힌 뒤에야 사물은 낮은 목소리로 말한다.',
    date: '기록 III',
    status: 'past',
    posterImage: museumPoster,
    shortDescription:
      '기관이 닫힌 뒤 사물이 다르게 말하기 시작하는 시간을 바라본 기록',
    longDescription:
      '부재와 전시와 잔상을 느리게 바라보는 연습이다. 박물관 라벨의 엄격함을 지나 더 사적인 주의의 형식으로 이동했다.',
    passage: ['폐관', '응시', '잔상', '보존'],
    materials: ['museum label', 'object', 'afterimage', 'slow looking'],
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
