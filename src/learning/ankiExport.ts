export interface AnkiExportRow {
  targetText: string;
  sourceText: string;
  partOfSpeech: string;
  exampleTargetText: string;
  exampleSourceText: string;
  difficulty: string;
  learningStatus: "new" | "practicing" | "learned";
}

function escapeTsvField(value: string): string {
  return /[\t\r\n"]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function learningStatusLabel(status: AnkiExportRow["learningStatus"]): string {
  return status === "new" ? "New" : status === "learned" ? "Learned" : "Practicing";
}

/** Serializes encountered vocabulary as a UTF-8, tab-separated Anki import file. */
export function serializeAnkiExport(rows: readonly AnkiExportRow[], targetLanguage: string): string {
  const columns = [
    targetLanguage,
    "English",
    "Part of speech",
    `Example (${targetLanguage})`,
    "Example (English)",
    "Difficulty",
    "Learning status",
  ];
  const lines = rows.map((row) =>
    [
      row.targetText,
      row.sourceText,
      row.partOfSpeech,
      row.exampleTargetText,
      row.exampleSourceText,
      row.difficulty,
      learningStatusLabel(row.learningStatus),
    ]
      .map(escapeTsvField)
      .join("\t"),
  );

  return ["#separator:Tab", `#columns:${columns.join("\t")}`, ...lines].join("\r\n");
}
