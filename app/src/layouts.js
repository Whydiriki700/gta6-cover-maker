// Vice Grid: panel layouts and colour grades.
//
// A layout is a set of rectangles in unit coordinates, each written as
// [left, top, width, height]. The renderer scales them to the export size,
// so one collage works at 1080x1080, 1080x1350 and 1920x1080. Every layout is
// built around one dominant panel or a strong rhythm: a plain even grid reads
// like a contact sheet, not a cover, so the hero layouts keep one big panel
// and the six-panel one keeps a strict two-row beat.
//
// A grade pairs a CSS filter string with a stack of tint washes painted over
// each photo. The washes use soft-light so the highlights keep their shape
// while the shadows take the colour: that is what makes a phone photo feel
// like a poster off the Vice City shelf. A wash is [blend, opacity, stops],
// where stops are [position, colour] pairs along a vertical gradient.

export const LAYOUTS = [
  {
    id: "cover-story",
    name: "Cover Story",
    panels: [
      [0, 0, 0.6, 0.64],
      [0.6, 0, 0.4, 0.32],
      [0.6, 0.32, 0.4, 0.32],
      [0, 0.64, 0.34, 0.36],
      [0.34, 0.64, 0.33, 0.36],
      [0.67, 0.64, 0.33, 0.36],
    ],
  },
  {
    id: "hero-strip",
    name: "Hero + Strip",
    panels: [
      [0, 0, 1, 0.68],
      [0, 0.68, 0.34, 0.32],
      [0.34, 0.68, 0.33, 0.32],
      [0.67, 0.68, 0.33, 0.32],
    ],
  },
  {
    id: "triptych",
    name: "Triptych",
    panels: [
      [0, 0, 0.34, 1],
      [0.34, 0, 0.33, 1],
      [0.67, 0, 0.33, 1],
    ],
  },
  {
    id: "six-pack",
    name: "Six Pack",
    panels: [
      [0, 0, 0.34, 0.5],
      [0.34, 0, 0.33, 0.5],
      [0.67, 0, 0.33, 0.5],
      [0, 0.5, 0.34, 0.5],
      [0.34, 0.5, 0.33, 0.5],
      [0.67, 0.5, 0.33, 0.5],
    ],
  },
];

export const GRADES = [
  {
    id: "sunset",
    name: "Vice Sunset",
    css: "saturate(1.4) contrast(1.12) brightness(1.04)",
    washes: [
      ["soft-light", 1, [[0, "rgba(255, 180, 70, 0.22)"], [0.45, "rgba(255, 115, 70, 0.06)"], [1, "rgba(255, 48, 118, 0.44)"]]],
      ["multiply", 1, [[0, "rgba(66, 18, 94, 0)"], [1, "rgba(66, 18, 94, 0.32)"]]],
    ],
  },
  {
    id: "neon",
    name: "Neon Nights",
    css: "saturate(1.55) contrast(1.18) brightness(1.0)",
    washes: [
      ["soft-light", 1, [[0, "rgba(0, 232, 255, 0.24)"], [0.5, "rgba(22, 22, 62, 0.05)"], [1, "rgba(255, 0, 155, 0.42)"]]],
      ["multiply", 1, [[0, "rgba(9, 9, 42, 0.28)"], [0.4, "rgba(9, 9, 42, 0)"]]],
    ],
  },
  {
    id: "golden",
    name: "Golden Hour",
    css: "saturate(1.25) contrast(1.07) brightness(1.06) sepia(0.24)",
    washes: [
      ["soft-light", 1, [[0, "rgba(255, 198, 66, 0.26)"], [1, "rgba(216, 92, 22, 0.32)"]]],
    ],
  },
  {
    id: "noir",
    name: "Midnight Noir",
    css: "grayscale(0.88) contrast(1.3) brightness(0.97)",
    washes: [
      ["multiply", 1, [[0, "rgba(11, 11, 28, 0.32)"], [0.55, "rgba(11, 11, 28, 0)"], [1, "rgba(11, 11, 28, 0.4)"]]],
    ],
  },
  {
    id: "none",
    name: "No grade",
    css: "none",
    washes: [],
  },
];

export function layoutById(id) {
  for (const layout of LAYOUTS) if (layout.id === id) return layout;
  return LAYOUTS[0];
}

export function gradeById(id) {
  for (const grade of GRADES) if (grade.id === id) return grade;
  return GRADES[0];
}

/** How many panels a layout has. */
export function panelCount(id) {
  return layoutById(id).panels.length;
}
