
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
    title: '주간 워크숍',
    description: '모두가 참여하는 정기 워크숍입니다.',
    detailedDescription: '정기 워크숍에서는 다양한 주제로 토론하고 학습합니다.\n\n준비물: 노트북, 필기도구',
    theme: ThemeColor.SAGE,
    themeName: '정기 워크숍',
    cost: 10,
    isReward: false,
    date: format(addDays(today, 2), 'yyyy-MM-ddT14:00:00'),
    endDate: format(addHours(addDays(today, 2), 2), 'yyyy-MM-ddT16:00:00'),
    maxParticipants: 20
  },
  {
    id: 'evt-2',
    title: '운영진 헬퍼 모임',
    description: '모임 준비를 도와주시면 코인을 드립니다.',
    detailedDescription: '행사 준비를 위한 헬퍼 모임입니다.\n의자 배치, 다과 준비 등을 도와주시면 됩니다.',
    theme: ThemeColor.OLIVE,
    themeName: '헬퍼 활동',
    cost: 15,
    isReward: true, // 코인 획득
    date: format(addDays(today, 3), 'yyyy-MM-ddT10:00:00'),
    endDate: format(addHours(addDays(today, 3), 1), 'yyyy-MM-ddT11:00:00'),
    maxParticipants: 3
  },
  {
    id: 'evt-3',
    title: '네트워킹 파티',
    description: '가벼운 다과와 함께하는 시간.',
    detailedDescription: '참여자들과 자유롭게 네트워킹할 수 있는 파티입니다.\n간단한 음식과 음료가 제공됩니다.',
    theme: ThemeColor.TERRACOTTA,
    themeName: '소셜 파티',
    cost: 30,
    isReward: false,
    date: format(addDays(today, 10), 'yyyy-MM-ddT18:00:00'),
    endDate: format(addHours(addDays(today, 10), 4), 'yyyy-MM-ddT22:00:00'),
    maxParticipants: 10
  }
];
