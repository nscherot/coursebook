// Tolerant parser for pasted course lists — Notes app text, Google Sheets/Excel
// paste (tab-separated), numbered lists, bullets, with optional notes and scores.

export type ParsedCourse = {
  rank: number | null;
  name: string;
  location: string;
  note: string;
  score: number | null;
};

const HEADER_WORDS = new Set([
  "rank", "no", "no.", "#", "course", "courses", "course name", "name",
  "location", "town", "city", "state", "country", "score", "best", "best score",
  "notes", "note", "played", "date",
]);

function isHeaderLine(cells: string[]): boolean {
  const filled = cells.filter((c) => c.trim().length > 0);
  if (filled.length === 0) return true;
  const headerish = filled.filter((c) => HEADER_WORDS.has(c.trim().toLowerCase()));
  return headerish.length >= Math.max(1, Math.ceil(filled.length * 0.6));
}

function isTitleLine(line: string): boolean {
  return /^(my\s+)?top\s*\d*\s*(golf\s*)?(courses?|list)?[:!]?$/i.test(line.trim());
}

/** Strip leading list markers: "1.", "12)", "#3", "-", "•", "*", "1 -" */
function stripMarker(line: string): { rank: number | null; rest: string } {
  const m = line.match(/^\s*(?:[#]?(\d{1,3})\s*[.):\-–]?\s+|[-•*]\s+)(.*)$/);
  if (m) {
    return { rank: m[1] ? parseInt(m[1], 10) : null, rest: m[2].trim() };
  }
  return { rank: null, rest: line.trim() };
}

function looksLikeScore(s: string): number | null {
  const n = Number(s.trim());
  if (Number.isInteger(n) && n >= 50 && n <= 150) return n;
  return null;
}

function looksLikeLocation(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  // "Town, ST" / "Town, State" / contains a comma / a known-ish region word
  return /,/.test(t) || /\b(ireland|scotland|england|wales|usa|united states)\b/i.test(t);
}

/** Split "Course name - some comment" into name + note (conservative). */
function splitNote(rest: string): { name: string; note: string } {
  // Trailing parenthetical → note: "Pebble Beach (best round ever)"
  const paren = rest.match(/^(.{3,}?)\s*\(([^)]{2,})\)\s*$/);
  if (paren && !/course|links|club|no\.?\s*\d/i.test(paren[2])) {
    return { name: paren[1].trim(), note: paren[2].trim() };
  }
  // " - " separator (spaces required, so "Pinehurst No-2" style names survive)
  const dash = rest.split(/\s+[-–—]\s+/);
  if (dash.length >= 2 && dash[0].trim().length >= 3) {
    return { name: dash[0].trim(), note: dash.slice(1).join(" — ").trim() };
  }
  return { name: rest.trim(), note: "" };
}

function parseDelimitedLine(cells: string[]): ParsedCourse | null {
  let rank: number | null = null;
  let score: number | null = null;
  let name = "";
  let location = "";
  const extras: string[] = [];

  for (const raw of cells) {
    const cell = raw.trim();
    if (!cell) continue;
    const asNum = Number(cell);
    if (rank === null && Number.isInteger(asNum) && asNum >= 1 && asNum <= 500 && !name) {
      rank = asNum; // leading small number before the name = rank
      continue;
    }
    if (score === null && looksLikeScore(cell) && name) {
      score = Number(cell);
      continue;
    }
    if (!name) {
      name = cell;
      continue;
    }
    if (!location && looksLikeLocation(cell)) {
      location = cell;
      continue;
    }
    extras.push(cell);
  }
  if (!name) return null;
  const { name: n, note: inlineNote } = splitNote(name);
  const note = [inlineNote, ...extras].filter(Boolean).join(" — ");
  return { rank, name: n, location, note, score };
}

export function parseCourseList(text: string): ParsedCourse[] {
  const out: ParsedCourse[] = [];
  const lines = text.split(/\r?\n/).slice(0, 300);

  for (const line of lines) {
    if (!line.trim()) continue;
    if (isTitleLine(line)) continue;

    // Spreadsheet paste: tab-separated. Also accept 2+ consecutive spaces as columns.
    const cells = line.includes("\t") ? line.split("\t") : null;
    if (cells) {
      if (isHeaderLine(cells)) continue;
      const parsed = parseDelimitedLine(cells);
      if (parsed) out.push(parsed);
      continue;
    }

    const { rank, rest } = stripMarker(line);
    if (!rest) continue;
    if (isHeaderLine([rest])) continue;

    // Plain line: name [- note]; a trailing ", Town, ST" chunk stays in the name —
    // the course-database match will supply the canonical location anyway.
    const { name, note } = splitNote(rest);
    // Trailing bare score: "Pebble Beach 84"
    const scoreMatch = name.match(/^(.{3,}?)\s+(\d{2,3})$/);
    let finalName = name;
    let score: number | null = null;
    if (scoreMatch && looksLikeScore(scoreMatch[2]) !== null && !/no\.?\s*\d+$/i.test(name)) {
      finalName = scoreMatch[1].trim();
      score = Number(scoreMatch[2]);
    }
    out.push({ rank, name: finalName, location: "", note, score });
  }

  // If no explicit ranks were present, rank by order of appearance.
  const anyRanks = out.some((c) => c.rank !== null);
  out.forEach((c, i) => {
    if (c.rank === null) c.rank = anyRanks ? i + 1 : i + 1;
  });
  out.sort((a, b) => (a.rank as number) - (b.rank as number));
  // De-dup identical names (keeps first/highest-ranked occurrence).
  const seen = new Set<string>();
  return out.filter((c) => {
    const k = c.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
