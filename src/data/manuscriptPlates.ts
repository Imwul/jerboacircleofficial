import loveWindow from '../assets/manuscripts/love-window-gallica.webp';
import grailTable from '../assets/manuscripts/grail-table.webp';
import cosmicWheel from '../assets/manuscripts/cosmic-wheel.webp';
import starVision from '../assets/manuscripts/star-vision.webp';
import danteStars from '../assets/manuscripts/dante-stars.webp';
import bestiaryMargin from '../assets/manuscripts/bestiary-margin.webp';
import stLukeMet from '../assets/manuscripts/st-luke-met.webp';

export const privateArchivePlate = loveWindow;

export const memberScribePlate = {
  src: stLukeMet,
  alt: '금빛 양피지 앞에서 책과 필사 도구를 곁에 두고 글을 쓰는 성 루가의 중세 필사본 세밀화',
  title: 'Manuscript Illumination with the Evangelist Luke',
  date: 'late 13th–early 14th century',
  repository: 'The Metropolitan Museum of Art',
  rights: 'Public Domain',
  sourceUrl: 'https://www.metmuseum.org/art/collection/search/473633',
};

export const editorialPlates = {
  masthead: danteStars,
  featured: grailTable,
  archive: starVision,
  manifesto: loveWindow,
  join: cosmicWheel,
  detail: bestiaryMargin,
  privateRoom: loveWindow,
};
