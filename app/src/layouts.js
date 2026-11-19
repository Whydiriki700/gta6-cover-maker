// Panel layouts and colour grades for Vice Panels.
//
// A layout is a list of rectangles in a unit square; the renderer scales them to the export size, so the same
// collage works at 1080 x 1080, 1080 x 1350 and 1920 x 1080. The layouts are the poster's skeleton: a hero panel
// with supporting panels reads as cover art, a plain grid reads as a contact sheet, so each layout keeps one
// dominant panel or a strong rhythm.

export const LAYOUTS = [
  {
    id: "cover-story",
    name: "Cover Story",
    panels: [
      { x: 0.0, y: 0.0, w: 0.6, h: 0.64 },
      { x: 0.6, y: 0.0, w: 0.4, h: 0.32 },
      { x: 0.6, y: 0.32, w: 0.4, h: 0.32 },
      { x: 0.0, y: 0.64, w: 0.34, h: 0.36 },
      { x: 0.34, y: 0.64, w: 0.33, h: 0.36 },
      { x: 0.67, y: 0.64, w: 0.33, h: 0.36 },
    ],
  },
  {
    id: "hero-strip",
    name: "Hero + Strip",
    panels: [
      { x: 0.0, y: 0.0, w: 1.0, h: 0.68 },
      { x: 0.0, y: 0.68, w: 0.34, h: 0.32 },
      { x: 0.34, y: 0.68, w: 0.33, h: 0.32 },
      { x: 0.67, y: 0.68, w: 0.33, h: 0.32 },
    ],
  },
  {
    id: "triptych",
    name: "Triptych",
    panels: [
      { x: 0.0, y: 0.0, w: 0.34, h: 1.0 },
      { x: 0.34, y: 0.0, w: 0.33, h: 1.0 },
      { x: 0.67, y: 0.0, w: 0.33, h: 1.0 },
    ],
  },
  {
    id: "six-pack",
    name: "Six Pack",
    panels: [
      { x: 0.0, y: 0.0, w: 0.34, h: 0.5 },
      { x: 0.34, y: 0.0, w: 0.33, h: 0.5 },
      { x: 0.67, y: 0.0, w: 0.33, h: 0.5 },
      { x: 0.0, y: 0.5, w: 0.34, h: 0.5 },
      { x: 0.34, y: 0.5, w: 0.33, h: 0.5 },
      { x: 0.67, y: 0.5, w: 0.33, h: 0.5 },
    ],
  },
];

// A grade is a canvas filter chain plus a stack of tint overlays the renderer paints over each photo. The
// overlays use soft-light so highlights keep their shape while the shadows take the colour: that is what makes
// a phone photo feel like a poster from the Vice City shelf.
export const GRADES = [
  {
    id: "sunset",
    name: "Vice Sunset",
    filter: "saturate(1.35) contrast(1.1) brightness(1.03)",
    overlays: [
      { stops: [[0, "rgba(255, 176, 66, 0.20)"], [0.45, "rgba(255, 110, 64, 0.05)"], [1, "rgba(255, 45, 120, 0.42)"]], mode: "soft-light" },
      { stops: [[0, "rgba(64, 16, 92, 0)"], [1, "rgba(64, 16, 92, 0.30)"]], mode: "multiply" },
    ],
  },
  {
    id: "neon",
    name: "Neon Nights",
    filter: "saturate(1.5) contrast(1.16) brightness(0.99)",
    overlays: [
      { stops: [[0, "rgba(0, 229, 255, 0.22)"], [0.5, "rgba(20, 20, 60, 0.04)"], [1, "rgba(255, 0, 153, 0.40)"]], mode: "soft-light" },
      { stops: [[0, "rgba(8, 8, 40, 0.26)"], [0.4, "rgba(8, 8, 40, 0)"]], mode: "multiply" },
    ],
  },
  {
    id: "golden",
    name: "Golden Hour",
    filter: "saturate(1.22) contrast(1.06) brightness(1.05) sepia(0.22)",
    overlays: [
      { stops: [[0, "rgba(255, 196, 64, 0.24)"], [1, "rgba(214, 90, 20, 0.30)"]], mode: "soft-light" },
    ],
  },
  {
    id: "noir",
    name: "Midnight Noir",
    filter: "grayscale(0.85) contrast(1.28) brightness(0.96)",
    overlays: [
      { stops: [[0, "rgba(10, 10, 26, 0.30)"], [0.55, "rgba(10, 10, 26, 0)"], [1, "rgba(10, 10, 26, 0.38)"]], mode: "multiply" },
    ],
  },
  {
    id: "none",
    name: "No grade",
    filter: "none",
    overlays: [],
  },
];

export function layoutById(id) {
  return LAYOUTS.find((layout) => layout.id === id) ?? LAYOUTS[0];
}

export function gradeById(id) {
  return GRADES.find((grade) => grade.id === id) ?? GRADES[0];
}
