
export enum Tier {
  SILT = 'Silt',
  CREST = 'Crest',
  ERG = 'Erg'
}

export enum ThemeColor {
  SAGE = 'sage',
  TERRACOTTA = 'terracotta',
  SLATE = 'slate',
  SAND = 'sand',
  CHARCOAL = 'charcoal',
  MAUVE = 'mauve',
  OLIVE = 'olive',
  ROSE = 'rose',
  INDIGO = 'indigo',
  LIME = 'lime'
}

export interface HabitRecord {
  status: 'success' | 'fail' | 'none';
  photo?: string; 
  mediaType?: 'image' | 'video' | 'audio';
  rating?: number;
  timestamp?: string;
  comment?: string;
  rewarded?: boolean;
  streakId?: number;
}

export interface User {
  id: string;
  name: string;
  tier: Tier;
  coins: number;
  tierStartDate: string;
  tierDurationWeeks: 2 | 4;
  tierEndDate?: string;
  enrolledEventIds: string[];
  avatarIcon?: string;
  avatarColor?: string;
  profileImage?: string;
  habitGoal?: string;
  habitRecords?: Record<string, HabitRecord>;
  lastReminderDate?: string; // 'YYYY-MM-DD' 형식으로 마지막 리마인더 발송일 저장
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  detailedDescription?: string;
  theme: ThemeColor;
  themeName: string; 
  cost: number;
  isReward: boolean; 
  date: string; 
  endDate: string; 
  maxParticipants?: number;
  recurringGroupId?: string;
}

export const TIER_COLORS = {
  [Tier.SILT]: 'bg-stone-300 text-stone-900 ring-1 ring-stone-400',
  [Tier.CREST]: 'bg-sky-500 text-white ring-1 ring-sky-600',
  [Tier.ERG]: 'bg-amber-500 text-white ring-1 ring-amber-600',
};

export const THEME_CONFIG = {
  [ThemeColor.SAGE]: { 
    base: 'sage', 
    bg: 'bg-[#10B981]', 
    border: 'border-[#059669]',
    text: 'text-white' 
  },
  [ThemeColor.TERRACOTTA]: { 
    base: 'terracotta', 
    bg: 'bg-[#EF4444]', 
    border: 'border-[#DC2626]',
    text: 'text-white' 
  },
  [ThemeColor.SLATE]: { 
    base: 'slate', 
    bg: 'bg-[#3B82F6]', 
    border: 'border-[#2563EB]',
    text: 'text-white' 
  },
  [ThemeColor.SAND]: { 
    base: 'sand', 
    bg: 'bg-[#F59E0B]', 
    border: 'border-[#D97706]',
    text: 'text-white' 
  },
  [ThemeColor.CHARCOAL]: { 
    base: 'charcoal', 
    bg: 'bg-[#334155]', 
    border: 'border-[#1E293B]',
    text: 'text-white' 
  },
  [ThemeColor.MAUVE]: { 
    base: 'mauve', 
    bg: 'bg-[#8B5CF6]', 
    border: 'border-[#7C3AED]',
    text: 'text-white' 
  },
  [ThemeColor.OLIVE]: { 
    base: 'olive', 
    bg: 'bg-[#14B8A6]', 
    border: 'border-[#0D9488]',
    text: 'text-white' 
  },
  [ThemeColor.ROSE]: { 
    base: 'rose', 
    bg: 'bg-[#F43F5E]', 
    border: 'border-[#E11D48]',
    text: 'text-white' 
  },
  [ThemeColor.INDIGO]: { 
    base: 'indigo', 
    bg: 'bg-[#6366F1]', 
    border: 'border-[#4F46E5]',
    text: 'text-white' 
  },
  [ThemeColor.LIME]: { 
    base: 'lime', 
    bg: 'bg-[#84CC16]', 
    border: 'border-[#65A30D]',
    text: 'text-white' 
  },
};

export const AVATAR_ICONS = ['✣', '⭑', '☎', '☻', '✦', '✿', '⚛', '⚡'];
export const AVATAR_COLORS = [
  '#C44A3A', '#018790', '#DE802B', '#F2D479', '#6FAF4F', '#BF092F', '#5D4037', '#455A64', '#7B1FA2'
];
