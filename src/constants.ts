
import { Tier, User, CalendarEvent, ThemeColor } from './types';
import { addDays, addHours, format, startOfToday } from 'date-fns';

export const ADMIN_PASSWORD = "8888";

const today = startOfToday();

export const INITIAL_USERS: User[] = [
  {
    id: '1',
    name: '김철수',
    tier: Tier.SILT,
    coins: 8,
    tierStartDate: format(today, 'yyyy-MM-dd'),
    tierDurationWeeks: 2,
    enrolledEventIds: [],
    avatarIcon: '✣',
    avatarColor: '#C44A3A'
  },
  {
    id: '2',
    name: '이영희',
    tier: Tier.SILT,
    coins: 8,
    tierStartDate: format(addDays(today, -5), 'yyyy-MM-dd'),
    tierDurationWeeks: 2,
    enrolledEventIds: [],
    avatarIcon: '⭑',
    avatarColor: '#018790'
  },
  {
    id: '3',
    name: '박민수',
    tier: Tier.SILT,
    coins: 8,
    tierStartDate: format(addDays(today, -2), 'yyyy-MM-dd'),
    tierDurationWeeks: 2,
    enrolledEventIds: [],
    avatarIcon: '✦',
    avatarColor: '#DE802B'
  }
];

export const INITIAL_EVENTS: CalendarEvent[] = [
  {
    id: 'evt-1',
    title: '첫 번째 문턱',
    description: '현재 여정의 첫 텍스트를 함께 여는 시간입니다.',
    detailedDescription: '프로그램의 첫 장을 천천히 읽고, 각자 붙잡은 상징과 질문을 장부에 남깁니다.\n\n준비물: 읽은 문장, 이미지 한 점, 질문 하나',
    theme: ThemeColor.SAGE,
    themeName: '문턱',
    cost: 10,
    isReward: false,
    date: format(addDays(today, 2), 'yyyy-MM-ddT14:00:00'),
    endDate: format(addHours(addDays(today, 2), 2), 'yyyy-MM-ddT16:00:00'),
    maxParticipants: 20
  },
  {
    id: 'evt-2',
    title: '보관자 정리 시간',
    description: '자료와 좌석과 기록을 조용히 정돈하는 시간입니다.',
    detailedDescription: '포스터, 인쇄물, 좌석, 기록 양식을 정리합니다.\n도움을 준 사람에게는 다음 여정을 위한 문장이 지급됩니다.',
    theme: ThemeColor.OLIVE,
    themeName: '보존',
    cost: 15,
    isReward: true, // 문장 지급
    date: format(addDays(today, 3), 'yyyy-MM-ddT10:00:00'),
    endDate: format(addHours(addDays(today, 3), 1), 'yyyy-MM-ddT11:00:00'),
    maxParticipants: 3
  },
  {
    id: 'evt-3',
    title: '밤의 주석회',
    description: '서로의 메모와 이미지, 남은 질문을 교환하는 느린 모임입니다.',
    detailedDescription: '읽은 것보다 남은 것을 중심으로 말합니다.\n답을 정리하지 않고 다음 장으로 가져갈 단서를 고릅니다.',
    theme: ThemeColor.TERRACOTTA,
    themeName: '주석회',
    cost: 30,
    isReward: false,
    date: format(addDays(today, 10), 'yyyy-MM-ddT18:00:00'),
    endDate: format(addHours(addDays(today, 10), 4), 'yyyy-MM-ddT22:00:00'),
    maxParticipants: 10
  }
];
