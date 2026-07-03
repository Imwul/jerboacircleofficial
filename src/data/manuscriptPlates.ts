import loveWindow from '../assets/manuscripts/love-window-gallica.jpg';
import knightMargin from '../assets/manuscripts/knight-margin-page.jpg';
import grailTable from '../assets/manuscripts/grail-table.jpg';
import cosmicWheel from '../assets/manuscripts/cosmic-wheel.jpg';
import diagramFolio from '../assets/manuscripts/diagram-folio.jpg';
import bookGame from '../assets/manuscripts/book-game-folio.jpg';
import treeOfLife from '../assets/manuscripts/tree-of-life.jpg';
import owlInitial from '../assets/manuscripts/owl-initial.jpg';
import bestiaryOpenBook from '../assets/manuscripts/bestiary-open-book.jpg';
import starVision from '../assets/manuscripts/star-vision.jpg';
import celestialSchema from '../assets/manuscripts/celestial-schema.jpg';
import pilgrimageMap from '../assets/manuscripts/pilgrimage-map.jpg';
import falconCourt from '../assets/manuscripts/falcon-court.jpg';
import arborPhilosophica from '../assets/manuscripts/arbor-philosophica.jpg';
import danteStars from '../assets/manuscripts/dante-stars.jpg';
import bestiaryMargin from '../assets/manuscripts/bestiary-margin.jpg';

export interface ManuscriptPlate {
  id: string;
  image: string;
  title: string;
  source: string;
}

export const manuscriptPlates: ManuscriptPlate[] = [
  {
    id: 'love-window',
    image: loveWindow,
    title: 'Courtly chambers',
    source: 'Gallica / Bibliotheque nationale de France',
  },
  {
    id: 'knight-margin',
    image: knightMargin,
    title: 'Knight in the margin',
    source: 'Digitised manuscript folio',
  },
  {
    id: 'grail-table',
    image: grailTable,
    title: 'Grail table',
    source: 'Manuscript illumination',
  },
  {
    id: 'cosmic-wheel',
    image: cosmicWheel,
    title: 'Celestial wheel',
    source: 'Medieval cosmological diagram',
  },
  {
    id: 'diagram-folio',
    image: diagramFolio,
    title: 'Figure and ratio',
    source: 'Scholastic diagram folio',
  },
  {
    id: 'book-game',
    image: bookGame,
    title: 'Book of play',
    source: 'Manuscript folio',
  },
  {
    id: 'tree-of-life',
    image: treeOfLife,
    title: 'Tree of life',
    source: 'Kabbalistic diagram',
  },
  {
    id: 'owl-initial',
    image: owlInitial,
    title: 'Owl initial',
    source: 'Illuminated initial',
  },
  {
    id: 'bestiary-open-book',
    image: bestiaryOpenBook,
    title: 'Bestiary leaves',
    source: 'Open manuscript book',
  },
  {
    id: 'star-vision',
    image: starVision,
    title: 'Star vision',
    source: 'Visionary miniature',
  },
  {
    id: 'celestial-schema',
    image: celestialSchema,
    title: 'Celestial schema',
    source: 'Cosmological diagram',
  },
  {
    id: 'pilgrimage-map',
    image: pilgrimageMap,
    title: 'Pilgrimage map',
    source: 'Route and city manuscript',
  },
  {
    id: 'falcon-court',
    image: falconCourt,
    title: 'Falcon court',
    source: 'Bestiary and courtly folio',
  },
  {
    id: 'arbor-philosophica',
    image: arborPhilosophica,
    title: 'Arbor philosophica',
    source: 'Philosophical diagram',
  },
  {
    id: 'dante-stars',
    image: danteStars,
    title: 'Canto of stars',
    source: 'Dantesque star field',
  },
  {
    id: 'bestiary-margin',
    image: bestiaryMargin,
    title: 'Bestiary margin',
    source: 'Manuscript marginalia',
  },
];

export const privateArchivePlate = loveWindow;

export const editorialPlates = {
  masthead: danteStars,
  featured: grailTable,
  archive: starVision,
  manifesto: loveWindow,
  join: cosmicWheel,
  detail: bestiaryMargin,
  privateRoom: loveWindow,
};
