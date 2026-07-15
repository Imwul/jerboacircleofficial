import lastSupper from '../assets/manuscripts/last-supper-met-466370.webp';
import singingMonks from '../assets/manuscripts/singing-monks-met-463605.webp';
import annunciation from '../assets/manuscripts/annunciation-met-466086.webp';
import beatusStar from '../assets/manuscripts/beatus-star-met-466191.webp';
import armenianBifolium from '../assets/manuscripts/armenian-bifolium-met-662941.webp';
import fixedStars from '../assets/manuscripts/fixed-stars-met-446297.webp';
import stLuke from '../assets/manuscripts/st-luke-met.webp';

export interface ArchiveMediaAsset {
  id: string;
  src: string;
  title: string;
  creator?: string;
  culture: string;
  date: string;
  medium: string;
  repository: string;
  repositoryObjectId: string;
  creditLine: string;
  sourceUrl: string;
  rights: 'Public Domain';
  rightsUrl: string;
  altText: string;
}

const metRepository = 'The Metropolitan Museum of Art';
const metOpenAccessUrl = 'https://www.metmuseum.org/about-the-met/policies-and-documents/open-access';

export const archiveMediaAssets: ArchiveMediaAsset[] = [
  {
    id: 'met-466370-last-supper',
    src: lastSupper,
    title: 'Manuscript Leaf with the Last Supper and the Washing of the Apostles’ Feet Leaf, from a Royal Psalter',
    culture: 'British',
    date: 'ca. 1250–70',
    medium: 'Tempera and gold on parchment',
    repository: metRepository,
    repositoryObjectId: '22.24.3',
    creditLine: 'Rogers Fund, 1922',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/466370',
    rights: 'Public Domain',
    rightsUrl: metOpenAccessUrl,
    altText: '푸른색과 금색 테두리 안에서 긴 식탁에 둘러앉은 인물들과 아래쪽의 발을 씻는 장면이 두 단으로 그려진 왕실 시편 필사본 잎.',
  },
  {
    id: 'met-463605-singing-monks',
    src: singingMonks,
    title: 'Manuscript Illumination with Singing Monks in an Initial D, from a Psalter',
    creator: 'Girolamo dai Libri',
    culture: 'Italian',
    date: '1501–2',
    medium: 'Tempera, ink, and gold on parchment',
    repository: metRepository,
    repositoryObjectId: '12.56.4',
    creditLine: 'Rogers Fund, 1912',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/463605',
    rights: 'Public Domain',
    rightsUrl: metOpenAccessUrl,
    altText: '금빛 장식 이니셜 D 안에서 흰 수도복을 입은 세 수도사가 악보를 향해 함께 노래하는 필사본 세밀화.',
  },
  {
    id: 'met-466086-annunciation',
    src: annunciation,
    title: 'Manuscript Illumination with the Annunciation in an Initial R, from a Gradual',
    culture: 'Upper Rhenish',
    date: 'ca. 1300',
    medium: 'Tempera, ink and gold on parchment',
    repository: metRepository,
    repositoryObjectId: '1982.175',
    creditLine: 'Purchase, Gift of J. Pierpont Morgan, by exchange, 1982',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/466086',
    rights: 'Public Domain',
    rightsUrl: metOpenAccessUrl,
    altText: '파란색 이니셜 R과 금빛 배경 안에서 천사가 마리아에게 소식을 전하고 흰 비둘기가 귀 가까이 다가가는 수태고지 장면.',
  },
  {
    id: 'met-466191-beatus-star',
    src: beatusStar,
    title: 'Leaf from a Beatus Manuscript: A Star Falls from the Sky',
    culture: 'Spanish',
    date: 'ca. 1180',
    medium: 'Tempera, gold, and ink on parchment',
    repository: metRepository,
    repositoryObjectId: '1991.232.10',
    creditLine: 'Purchase, The Cloisters Collection, Rogers and Harris Brisbane Dick Funds, and Joseph Pulitzer Bequest, 1991',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/466191',
    rights: 'Public Domain',
    rightsUrl: metOpenAccessUrl,
    altText: '푸른 밤하늘의 금빛 별들 사이에서 천사가 나팔을 불고 별이 불길처럼 땅으로 떨어지는 베아투스 필사본 잎.',
  },
  {
    id: 'met-662941-armenian-bifolium',
    src: armenianBifolium,
    title: 'Armenian Manuscript Bifolium',
    creator: 'Illuminator Minas (?)',
    culture: 'Armenian',
    date: '15th century',
    medium: 'Tempera and gold leaf on paper',
    repository: metRepository,
    repositoryObjectId: '2014.740',
    creditLine: 'Gift of Linda Barker and Lore Hilburg, in memory of their mother, Judith E. Hilburg, 2014',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/662941',
    rights: 'Public Domain',
    rightsUrl: metOpenAccessUrl,
    altText: '새와 꽃 장식, 붉고 푸른 기둥 사이의 복음서 대조표와 아르메니아어 본문이 양쪽 면에 펼쳐진 필사본 이중 잎.',
  },
  {
    id: 'met-446297-fixed-stars',
    src: fixedStars,
    title: 'Kitab suwar al-kawakib al-thabita (Book of the Images of the Fixed Stars) of al-Sufi',
    creator: '`Abd al-Rahman al-Sufi',
    culture: 'Iranian',
    date: 'late 15th century',
    medium: 'Ink and gold on paper; leather binding',
    repository: metRepository,
    repositoryObjectId: '13.160.10',
    creditLine: 'Rogers Fund, 1913',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/446297',
    rights: 'Public Domain',
    rightsUrl: metOpenAccessUrl,
    altText: '아랍어 천문 기록 사이에 큰곰자리와 작은곰자리의 별 위치가 붉고 금빛인 점으로 표시된 15세기 필사본 쪽.',
  },
  {
    id: 'met-473633-st-luke',
    src: stLuke,
    title: 'Manuscript Illumination with the Evangelist Luke',
    culture: 'Byzantine',
    date: 'late 13th–early 14th century',
    medium: 'Tempera and gold on parchment',
    repository: metRepository,
    repositoryObjectId: '2001.633',
    creditLine: 'Purchase, The Jaharis Family Foundation Inc. Gift, 2001',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/473633',
    rights: 'Public Domain',
    rightsUrl: metOpenAccessUrl,
    altText: '금빛 양피지 앞에서 책과 필사 도구를 곁에 두고 글을 쓰는 성 루가의 중세 필사본 세밀화.',
  },
];

export function getArchiveMediaAsset(id: string | undefined) {
  return archiveMediaAssets.find((asset) => asset.id === id);
}

export function mediaAssetCitation(asset: ArchiveMediaAsset) {
  return [
    asset.creator,
    asset.title,
    asset.date,
    asset.medium,
    `${asset.repository}, ${asset.repositoryObjectId}`,
    asset.rights,
  ].filter(Boolean).join('. ');
}
