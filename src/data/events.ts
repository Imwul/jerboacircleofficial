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
  date: string;
  status: EventStatus;
  posterImage: string;
  shortDescription: string;
  longDescription: string;
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
    date: '현재 프로그램',
    status: 'current',
    posterImage: scintillaPoster,
    shortDescription:
      '성배 / 숲 / 성물 / 장미 / 불 / 별 / 여섯 불씨의 독서와 이미지와 기억',
    longDescription:
      '현재 프로그램 / Grail / Forest / Relic / Rose / Fire / Star / 느린 독서와 상징적 주의 / 함께 읽는 텍스트 주변에 모이는 사적인 전류',
    themes: ['Grail', 'Forest', 'Relic', 'Rose', 'Fire', 'Star'],
    location: '저보아 서클 / 비공개 프로그램',
    ctaLabel: '기록 열람',
    ctaHref: './archive/scintilla-animae/',
  },
  {
    id: 'reading-edge-room',
    edition: 'Edition 005',
    title: 'A Reading at the Edge of the Room',
    subtitle: 'Winter gathering for text and voice',
    latinQuote: 'In margine vox invenitur',
    date: '기록 I',
    status: 'past',
    posterImage: readingPoster,
    shortDescription:
      '공적인 낭독 / 사적인 주석 / 방의 가장자리에서 열린 챔버 리딩',
    longDescription:
      '방 자체를 여백으로 다룬 기록 / 짧은 텍스트와 파편과 가장자리의 메모 / 더 큰 필사본의 문턱에서 이루어진 낭독',
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
    date: '기록 II',
    status: 'past',
    posterImage: lettersPoster,
    shortDescription:
      '도착하지 않은 방 / 도시 / 미래 / 자아에게 보내는 편지 연구',
    longDescription:
      '서간의 파편과 불가능한 주소 / 아직 형체를 갖지 못한 것에 닿기 위한 의식 / 편지를 통한 사적인 도달',
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
    date: '기록 III',
    status: 'past',
    posterImage: museumPoster,
    shortDescription:
      '기관이 닫힌 뒤 / 사물이 다르게 말하기 시작하는 시간을 바라보는 세션',
    longDescription:
      '부재와 전시와 잔상을 느리게 바라보는 연습 / 박물관 라벨의 엄격함 / 더 사적인 주의의 형식으로 이동한 기록',
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
