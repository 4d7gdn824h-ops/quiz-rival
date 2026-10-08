export interface HomeworkFixtureMeta {
  id: string;
  title: string;
  language: string;
  image: string;
  blurb: string;
}

/** Client-safe fixture index. Notes JSON stays on the server. */
export const HOMEWORK_FIXTURES: HomeworkFixtureMeta[] = [
  {
    id: "water-cycle-worksheet",
    title: "Water cycle (EN)",
    language: "en",
    image: "/fixtures/water-cycle-worksheet.svg",
    blurb: "Short science sheet",
  },
  {
    id: "planetas-worksheet",
    title: "Los planetas (ES)",
    language: "es",
    image: "/fixtures/planetas-worksheet.svg",
    blurb: "Ficha de ciencias",
  },
];

export function getFixtureMeta(id: string): HomeworkFixtureMeta | undefined {
  return HOMEWORK_FIXTURES.find((item) => item.id === id);
}
