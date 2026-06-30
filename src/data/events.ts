import scintillaPoster from '../assets/posters/scintilla-animae.svg';
import readingPoster from '../assets/posters/reading-edge-room.svg';
import lettersPoster from '../assets/posters/letters-unmade-places.svg';
import museumPoster from '../assets/posters/museum-after-hours.svg';

export type EventStatus = 'upcoming' | 'past' | 'current';

export interface ArchiveEvent {
  id: string;
  title: string;
  subtitle: string;
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
    title: 'Scintilla Animae',
    subtitle: 'Grail / Forest / Relic / Rose / Fire / Star',
    date: 'Current Program',
    status: 'current',
    posterImage: scintillaPoster,
    shortDescription:
      'Six small flames arranged as a season of reading, image, memory, and myth.',
    longDescription:
      'Scintilla Animae is the current Jerboa Circle program: a six-part sequence moving through Grail, Forest, Relic, Rose, Fire, and Star. It is built for slow reading, symbolic attention, and the private electricity that gathers around shared texts.',
    themes: ['Grail', 'Forest', 'Relic', 'Rose', 'Fire', 'Star'],
    location: 'Jerboa Circle / private program',
    ctaLabel: 'Enter the record',
    ctaHref: './archive/scintilla-animae/',
  },
  {
    id: 'reading-edge-room',
    title: 'A Reading at the Edge of the Room',
    subtitle: 'Winter gathering for text and voice',
    date: 'Archive I',
    status: 'past',
    posterImage: readingPoster,
    shortDescription:
      'A chamber reading staged around the border between public speech and private annotation.',
    longDescription:
      'A Reading at the Edge of the Room treated the room itself as a margin. Participants brought short texts, fragments, and marginal notes, then read them as if standing at the threshold of a larger manuscript.',
    themes: ['Reading', 'Voice', 'Margin'],
    location: 'Table gathering',
    ctaLabel: 'Read the record',
    ctaHref: './archive/reading-edge-room/',
  },
  {
    id: 'letters-unmade-places',
    title: 'Letters to Unmade Places',
    subtitle: 'Correspondence study',
    date: 'Archive II',
    status: 'past',
    posterImage: lettersPoster,
    shortDescription:
      'A study of letters addressed to rooms, cities, futures, and selves that did not arrive.',
    longDescription:
      'Letters to Unmade Places gathered epistolary fragments and impossible addresses. The session considered correspondence as a ritual for reaching what has not yet taken form.',
    themes: ['Letter', 'Distance', 'Fragment'],
    location: 'Correspondence circle',
    ctaLabel: 'Open the record',
    ctaHref: './archive/letters-unmade-places/',
  },
  {
    id: 'museum-after-hours',
    title: 'The Museum After Hours',
    subtitle: 'Slow looking session',
    date: 'Archive III',
    status: 'past',
    posterImage: museumPoster,
    shortDescription:
      'A quiet session on looking after the institution closes and the object begins to speak differently.',
    longDescription:
      'The Museum After Hours was a slow-looking exercise in absence, display, and afterimage. It borrowed the discipline of the museum label but moved toward more private forms of attention.',
    themes: ['Museum', 'Image', 'Afterimage'],
    location: 'Looking session',
    ctaLabel: 'View the record',
    ctaHref: './archive/museum-after-hours/',
  },
];

export const featuredEvent = events.find((event) => event.status === 'current') ?? events[0];

export function getEventById(id: string | undefined) {
  return events.find((event) => event.id === id);
}
