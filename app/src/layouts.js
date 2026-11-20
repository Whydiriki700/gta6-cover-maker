// Vice Grid — layout, grade and caption definitions.
// Every panel is a rectangle in fractions of the cover (x, y, w, h).
// A grade is a pair of sky colours plus a canvas filter; a caption scheme
// is a way of lettering the headline and subtitle onto the finished cover.

export const LAYOUTS = [
  {
    id: 'cover-story',
    name: 'Cover Story',
    blurb: 'One tall hero panel on the left, five stacked moments on the right.',
    panels: [
      { x: 0, y: 0, w: 0.62, h: 1 },
      { x: 0.62, y: 0, w: 0.38, h: 0.2 },
      { x: 0.62, y: 0.2, w: 0.38, h: 0.2 },
      { x: 0.62, y: 0.4, w: 0.38, h: 0.2 },
      { x: 0.62, y: 0.6, w: 0.38, h: 0.2 },
      { x: 0.62, y: 0.8, w: 0.38, h: 0.2 },
    ],
  },
  {
    id: 'hero-strip',
    name: 'Hero + Strip',
    blurb: 'A wide hero shot above a three-panel strip of highlights.',
    panels: [
      { x: 0, y: 0, w: 1, h: 0.68 },
      { x: 0, y: 0.68, w: 1 / 3, h: 0.32 },
      { x: 1 / 3, y: 0.68, w: 1 / 3, h: 0.32 },
      { x: 2 / 3, y: 0.68, w: 1 / 3, h: 0.32 },
    ],
  },
  {
    id: 'triptych',
    name: 'Triptych',
    blurb: 'Three equal upright panels, one story told three ways.',
    panels: [
      { x: 0, y: 0, w: 1 / 3, h: 1 },
      { x: 1 / 3, y: 0, w: 1 / 3, h: 1 },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 1 },
    ],
  },
  {
    id: 'six-pack',
    name: 'Six Pack',
    blurb: 'A three-by-two grid for a full night out in Leonida.',
    panels: [
      { x: 0, y: 0, w: 1 / 3, h: 0.5 },
      { x: 1 / 3, y: 0, w: 1 / 3, h: 0.5 },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 0.5 },
      { x: 0, y: 0.5, w: 1 / 3, h: 0.5 },
      { x: 1 / 3, y: 0.5, w: 1 / 3, h: 0.5 },
      { x: 2 / 3, y: 0.5, w: 1 / 3, h: 0.5 },
    ],
  },
];

export const GRADES = [
  {
    id: 'neon',
    name: 'Neon Vice',
    sky: ['#ff2e88', '#00e5ff'],
    ink: '#ff2e88',
    filter: { saturate: 1.38, contrast: 1.09, brightness: 1.02, hue: 0 },
    tint: 0.34,
  },
  {
    id: 'golden',
    name: 'Golden Hour',
    sky: ['#ffb347', '#ff5e3a'],
    ink: '#ff9a3d',
    filter: { saturate: 1.26, contrast: 1.06, brightness: 1.04, hue: -8 },
    tint: 0.3,
  },
  {
    id: 'teal',
    name: 'Teal Nights',
    sky: ['#00e5c7', '#0b3d66'],
    ink: '#00e5c7',
    filter: { saturate: 1.16, contrast: 1.08, brightness: 0.99, hue: -12 },
    tint: 0.32,
  },
  {
    id: 'mono',
    name: 'Mono Noir',
    sky: ['#e8e8e8', '#1a1a1a'],
    ink: '#f2f2f2',
    filter: { saturate: 0, contrast: 1.16, brightness: 1.0, hue: 0 },
    tint: 0.22,
  },
];

export const CAPTIONS = [
  {
    id: 'slant',
    name: 'Slant Banner',
    hint: 'A slanted ribbon carries the headline; the subtitle sits under it.',
  },
  {
    id: 'block',
    name: 'Block Stack',
    hint: 'Huge stacked headline, subtitle tucked underneath in a bar.',
  },
  {
    id: 'badge',
    name: 'Corner Badge',
    hint: 'A rounded badge in the corner holds the headline and subtitle.',
  },
  {
    id: 'marquee',
    name: 'Marquee Strip',
    hint: 'A full-width strip along the edge, headline left, subtitle right.',
  },
];

export const EXPORT_SIZES = [
  { id: 'square', name: 'Square', w: 1080, h: 1080, label: '1080 × 1080' },
  { id: 'portrait', name: 'Portrait', w: 1080, h: 1350, label: '1080 × 1350' },
  { id: 'wide', name: 'Wide', w: 1920, h: 1080, label: '1920 × 1080' },
];

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) || LAYOUTS[0];
}

export function gradeById(id) {
  return GRADES.find((g) => g.id === id) || GRADES[0];
}

export function captionById(id) {
  return CAPTIONS.find((c) => c.id === id) || CAPTIONS[0];
}

export function sizeById(id) {
  return EXPORT_SIZES.find((s) => s.id === id) || EXPORT_SIZES[0];
}
