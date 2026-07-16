import lastSupper from '../assets/manuscripts/last-supper-met-466370.webp';
import singingMonks from '../assets/manuscripts/singing-monks-met-463605.webp';
import annunciation from '../assets/manuscripts/annunciation-met-466086.webp';
import beatusStar from '../assets/manuscripts/beatus-star-met-466191.webp';
import armenianBifolium from '../assets/manuscripts/armenian-bifolium-met-662941.webp';
import fixedStars from '../assets/manuscripts/fixed-stars-met-446297.webp';
import stLuke from '../assets/manuscripts/st-luke-met.webp';
import cabalePage20 from '../assets/occult/cabale-sacree-page-20.webp';
import cabalePage34 from '../assets/occult/cabale-sacree-page-34.webp';
import cabalePage54 from '../assets/occult/cabale-sacree-page-54.webp';
import cabalePage74 from '../assets/occult/cabale-sacree-page-74.webp';
import cabalePage94 from '../assets/occult/cabale-sacree-page-94.webp';
import cabalePage114 from '../assets/occult/cabale-sacree-page-114.webp';
import alchemicalPeacock from '../assets/occult/alchemical-peacock-wellcome.webp';
import crownedWoman from '../assets/occult/crowned-woman-wellcome.webp';
import hermeticAndrogyne from '../assets/occult/hermetic-androgyne-wellcome.webp';
import dragonsTree from '../assets/occult/dragons-tree-wellcome.webp';
import ripleyTree from '../assets/occult/ripley-scroll-tree-wellcome.webp';
import ripleyEagle from '../assets/occult/ripley-scroll-eagle-wellcome.webp';
import threeHeadedEagle from '../assets/occult/three-headed-eagle-wellcome.webp';
import goldenPrince from '../assets/occult/golden-prince-wellcome.webp';

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
  rights: 'Public Domain' | 'CC BY 4.0';
  rightsUrl: string;
  altText: string;
}

const metRepository = 'The Metropolitan Museum of Art';
const metOpenAccessUrl = 'https://www.metmuseum.org/about-the-met/policies-and-documents/open-access';
const wellcomeRepository = 'Wellcome Collection';
const wellcomeCabaleSourceUrl = 'https://wellcomecollection.org/works/vyewmamt';
const publicDomainMarkUrl = 'https://creativecommons.org/publicdomain/mark/1.0/';
const ccByUrl = 'https://creativecommons.org/licenses/by/4.0/';

export const archiveMediaAssets: ArchiveMediaAsset[] = [
  {
    id: 'wellcome-golden-prince',
    src: goldenPrince,
    title: 'A Prince Clad in Gold Succeeds the King',
    creator: 'Edith A. Ibbs, after Salomon Trismosin',
    culture: 'British',
    date: '1900–1909',
    medium: 'Watercolour painting',
    repository: wellcomeRepository,
    repositoryObjectId: '38704i',
    creditLine: 'Wellcome Collection 38704i',
    sourceUrl: 'https://wellcomecollection.org/works/vujg9ft8',
    rights: 'Public Domain',
    rightsUrl: publicDomainMarkUrl,
    altText: '푸른 하늘과 산길 앞에 금빛 옷과 왕관을 쓴 왕자가 별 달린 홀과 황금 구체를 들고 서 있는 연금술 수채화.',
  },
  {
    id: 'wellcome-three-headed-eagle',
    src: threeHeadedEagle,
    title: 'A Three-Headed Eagle in a Crowned Alchemical Flask',
    creator: 'Edith A. Ibbs, after Salomon Trismosin',
    culture: 'British',
    date: '1900–1909',
    medium: 'Watercolour painting',
    repository: wellcomeRepository,
    repositoryObjectId: '38823i',
    creditLine: 'Wellcome Collection 38823i',
    sourceUrl: 'https://wellcomecollection.org/works/nq5v5cb5',
    rights: 'CC BY 4.0',
    rightsUrl: ccByUrl,
    altText: '왕관을 두른 푸른 연금술 플라스크 안에서 세 머리의 흰 독수리가 날개를 펼친 수채화.',
  },
  {
    id: 'wellcome-alchemical-peacock',
    src: alchemicalPeacock,
    title: 'A Peacock in a Crowned Alchemical Flask',
    creator: 'Edith A. Ibbs, after Salomon Trismosin',
    culture: 'British',
    date: '1900–1909',
    medium: 'Watercolour painting',
    repository: wellcomeRepository,
    repositoryObjectId: '38825i',
    creditLine: 'Wellcome Collection 38825i',
    sourceUrl: 'https://wellcomecollection.org/works/pyhb4hmk',
    rights: 'Public Domain',
    rightsUrl: publicDomainMarkUrl,
    altText: '금빛 왕관을 두른 유리 플라스크 안에 푸른 공작이 꼬리를 펼친 채 서 있는 연금술 수채화.',
  },
  {
    id: 'wellcome-crowned-woman-alchemy',
    src: crownedWoman,
    title: 'A Crowned Woman with a Rose-Topped Caduceus',
    culture: 'European',
    date: 'ca. 18th century',
    medium: 'Coloured etching',
    repository: wellcomeRepository,
    repositoryObjectId: '38629i',
    creditLine: 'Wellcome Collection 38629i',
    sourceUrl: 'https://wellcomecollection.org/works/ckz6rqdz',
    rights: 'Public Domain',
    rightsUrl: publicDomainMarkUrl,
    altText: '붉은 옷과 왕관을 쓴 여인이 장미가 핀 지팡이를 들고 푸른 물의 원 안에 떠 있는 채색 연금술 도판.',
  },
  {
    id: 'wellcome-hermetic-androgyne',
    src: hermeticAndrogyne,
    title: 'The Hermetic Androgyne',
    creator: 'Edith A. Ibbs',
    culture: 'British',
    date: '1900–1909',
    medium: 'Watercolour painting',
    repository: wellcomeRepository,
    repositoryObjectId: '38739i',
    creditLine: 'Wellcome Collection 38739i',
    sourceUrl: 'https://wellcomecollection.org/works/prmankg3',
    rights: 'CC BY 4.0',
    rightsUrl: ccByUrl,
    altText: '붉고 푸른 한 쌍의 날개와 원형 거울을 지닌 헤르메스적 양성자가 산과 숲 앞에 선 채색 연금술 도판.',
  },
  {
    id: 'wellcome-dragons-flowering-tree',
    src: dragonsTree,
    title: 'Dragons and Griffins around a Flowering Tree',
    creator: 'After Nicolas Flamel',
    culture: 'European',
    date: 'ca. 17th century',
    medium: 'Etching with watercolour',
    repository: wellcomeRepository,
    repositoryObjectId: '38032i',
    creditLine: 'Wellcome Collection 38032i',
    sourceUrl: 'https://wellcomecollection.org/works/sj4mu8bn',
    rights: 'CC BY 4.0',
    rightsUrl: ccByUrl,
    altText: '높은 언덕의 흰 꽃나무를 향해 붉고 검은 용과 그리핀이 사방에서 날아드는 채색 연금술 도판.',
  },
  {
    id: 'wellcome-ripley-scroll-tree',
    src: ripleyTree,
    title: 'Ripley Scroll: Alchemical Tree and Fountain',
    creator: 'After George Ripley',
    culture: 'British',
    date: 'c. 1600',
    medium: 'Ink and colour on parchment roll',
    repository: wellcomeRepository,
    repositoryObjectId: 'MS.692, panel 3',
    creditLine: 'Wellcome Collection MS.692',
    sourceUrl: 'https://wellcomecollection.org/works/b38k86ch',
    rights: 'Public Domain',
    rightsUrl: publicDomainMarkUrl,
    altText: '채색 덩굴 테두리 안에서 태양과 달, 인물과 새가 연금술의 나무와 분수 주위에 층층이 놓인 리플리 두루마리.',
  },
  {
    id: 'wellcome-ripley-scroll-eagle',
    src: ripleyEagle,
    title: 'Ripley Scroll: The Bird of Hermes',
    creator: 'After George Ripley',
    culture: 'British',
    date: 'c. 1600',
    medium: 'Ink and colour on parchment roll',
    repository: wellcomeRepository,
    repositoryObjectId: 'MS.692, panel 6',
    creditLine: 'Wellcome Collection MS.692',
    sourceUrl: 'https://wellcomecollection.org/works/b38k86ch',
    rights: 'Public Domain',
    rightsUrl: publicDomainMarkUrl,
    altText: '황금 빗방울 아래 날개 달린 헤르메스의 새가 검은 구체 위에 서 있고 양옆을 채색 덩굴이 두른 리플리 두루마리.',
  },
  {
    id: 'wellcome-cabale-sacree-page-20',
    src: cabalePage20,
    title: 'Cabale Sacrée et Divine, p. 20: Character of the Angel Mahasiah',
    culture: 'French',
    date: 'c. 1775',
    medium: 'Ink and red pigment on paper',
    repository: wellcomeRepository,
    repositoryObjectId: 'MS.1434, p. 20',
    creditLine: 'Wellcome Collection, MS.1434',
    sourceUrl: wellcomeCabaleSourceUrl,
    rights: 'Public Domain',
    rightsUrl: publicDomainMarkUrl,
    altText: '옅은 종이 위에 천사 마하시야의 이름과 기도문, 붉은 잉크로 그린 기호가 놓인 카발라 필사본 20쪽.',
  },
  {
    id: 'wellcome-cabale-sacree-page-34',
    src: cabalePage34,
    title: 'Cabale Sacrée et Divine, p. 34: Characters of the Angel Hariel',
    culture: 'French',
    date: 'c. 1775',
    medium: 'Ink and red pigment on paper',
    repository: wellcomeRepository,
    repositoryObjectId: 'MS.1434, p. 34',
    creditLine: 'Wellcome Collection, MS.1434',
    sourceUrl: wellcomeCabaleSourceUrl,
    rights: 'Public Domain',
    rightsUrl: publicDomainMarkUrl,
    altText: '천사 하리엘의 이름 아래 붉은 잉크로 세 개의 서로 다른 시질이 나란히 그려진 카발라 필사본 34쪽.',
  },
  {
    id: 'wellcome-cabale-sacree-page-54',
    src: cabalePage54,
    title: 'Cabale Sacrée et Divine, p. 54: Character of the Angel Reiyel',
    culture: 'French',
    date: 'c. 1775',
    medium: 'Ink and red pigment on paper',
    repository: wellcomeRepository,
    repositoryObjectId: 'MS.1434, p. 54',
    creditLine: 'Wellcome Collection, MS.1434',
    sourceUrl: wellcomeCabaleSourceUrl,
    rights: 'Public Domain',
    rightsUrl: publicDomainMarkUrl,
    altText: '천사 레이엘의 이름과 긴 기도문 사이에 붉은 계단 모양 시질이 놓인 카발라 필사본 54쪽.',
  },
  {
    id: 'wellcome-cabale-sacree-page-74',
    src: cabalePage74,
    title: 'Cabale Sacrée et Divine, p. 74: Character of the Angel Michael',
    culture: 'French',
    date: 'c. 1775',
    medium: 'Ink and red pigment on paper',
    repository: wellcomeRepository,
    repositoryObjectId: 'MS.1434, p. 74',
    creditLine: 'Wellcome Collection, MS.1434',
    sourceUrl: wellcomeCabaleSourceUrl,
    rights: 'Public Domain',
    rightsUrl: publicDomainMarkUrl,
    altText: '천사 미카엘의 이름과 라틴어 구절 곁에 연한 붉은 선으로 네모난 시질이 그려진 카발라 필사본 74쪽.',
  },
  {
    id: 'wellcome-cabale-sacree-page-94',
    src: cabalePage94,
    title: 'Cabale Sacrée et Divine, p. 94: Divine Name and Solar Character',
    culture: 'French',
    date: 'c. 1775',
    medium: 'Ink and red pigment on paper',
    repository: wellcomeRepository,
    repositoryObjectId: 'MS.1434, p. 94',
    creditLine: 'Wellcome Collection, MS.1434',
    sourceUrl: wellcomeCabaleSourceUrl,
    rights: 'Public Domain',
    rightsUrl: publicDomainMarkUrl,
    altText: '히브리어 신명과 태양의 움직임을 적은 문장 사이에 붉은 태양 기호가 놓인 카발라 필사본 94쪽.',
  },
  {
    id: 'wellcome-cabale-sacree-page-114',
    src: cabalePage114,
    title: 'Cabale Sacrée et Divine, p. 114: Divine Name and Pisces',
    culture: 'French',
    date: 'c. 1775',
    medium: 'Ink and red pigment on paper',
    repository: wellcomeRepository,
    repositoryObjectId: 'MS.1434, p. 114',
    creditLine: 'Wellcome Collection, MS.1434',
    sourceUrl: wellcomeCabaleSourceUrl,
    rights: 'Public Domain',
    rightsUrl: publicDomainMarkUrl,
    altText: '물고기자리와 천사의 이름, 히브리어 신명을 가느다란 필체로 기록한 카발라 필사본 114쪽.',
  },
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
