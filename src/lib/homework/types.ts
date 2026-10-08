import type {
  Level,
  PackCatalogItem,
  PublicLevel,
  QuizLanguage,
  QuizPackFile,
} from "@/data/types";

export type HomeworkMode = "xai" | "fixture";

export interface ExtractLine {
  id: string;
  text: string;
  /** Parent keeps this line as study material. Junk starts unchecked. */
  keep: boolean;
}

export interface ExtractedNotes {
  title: string;
  language: QuizLanguage;
  topics: string[];
  facts: string[];
  essayPrompts: string[];
  rawText: string;
  lines: ExtractLine[];
  fixtureId?: string;
}

export interface HomeworkExtract {
  id: string;
  notes: ExtractedNotes;
  mode: HomeworkMode;
  notice?: string;
  createdAt: number;
  /** Vision completion finish_reason. Null when no model call ran. */
  finishReason?: string | null;
}

export interface GeneratedHomeworkPack {
  id: string;
  pack: QuizPackFile;
  levels: Level[];
  writing: null;
  notes: ExtractedNotes;
  mode: HomeworkMode;
  createdAt: number;
}

export interface PublicHomeworkPack extends PackCatalogItem {
  generated: boolean;
  tonight: boolean;
  hasEssay: boolean;
  levels: PublicLevel[];
}

export interface PublicPackDetail extends PublicHomeworkPack {
  writing: null;
}
