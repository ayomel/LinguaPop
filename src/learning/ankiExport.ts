export interface AnkiExportRow {
  spanish: string;
  english: string;
  partOfSpeech: string;
  exampleSpanish: string;
  exampleEnglish: string;
  difficulty: string;
  learningStatus: "new" | "practicing" | "learned";
}

const columns = [
  "Spanish",
  "English",
  "Part of speech",
  "Example (Spanish)",
  "Example (English)",
  "Difficulty",
  "Learning status",
] as const;

function escapeTsvField(value: string): string {
  return /[\t\r\n"]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function learningStatusLabel(status: AnkiExportRow["learningStatus"]): string {
  return status === "new" ? "New" : status === "learned" ? "Learned" : "Practicing";
}

/** Serializes encountered vocabulary as a UTF-8, tab-separated Anki import file. */
export function serializeAnkiExport(rows: readonly AnkiExportRow[]): string {
  const lines = rows.map((row) =>
    [
      row.spanish,
      row.english,
      row.partOfSpeech,
      row.exampleSpanish,
      row.exampleEnglish,
      row.difficulty,
      learningStatusLabel(row.learningStatus),
    ]
      .map(escapeTsvField)
      .join("\t"),
  );

  return ["#separator:Tab", `#columns:${columns.join("\t")}`, ...lines].join("\r\n");
}
