import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { TaskExportRecord, WeekMdData, WeekMdSection } from "./types.ts";

export function buildWeekMdData(records: TaskExportRecord[], now: Date): WeekMdData {
  const startOfWeek = new Date(now);
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  const diff = (day + 6) % 7; // days since Monday
  startOfWeek.setDate(now.getDate() - diff);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const weekNumber = getISOWeek(now);
  const weekRange = `${formatDate(startOfWeek)}–${formatDate(endOfWeek)}`;

  const overdue = records.filter((r) => r.status === "pending" && r.due && parseTwDate(r.due)! < now);
  const active = records.filter((r) => r.status === "pending" && r.start);
  const thisWeek = records.filter((r) => {
    if (r.status !== "pending") return false;
    const sch = r.scheduled ? parseTwDate(r.scheduled) : null;
    const due = r.due ? parseTwDate(r.due) : null;
    return (sch && sch <= endOfWeek) || (due && due <= endOfWeek);
  });
  const blocked = records.filter((r) => r.status === "pending" && r.depends && r.depends.length > 0);
  const blocking = records.filter((r) => r.status === "pending");
  const recurring = records.filter((r) => r.status === "recurring" || r.rtype);
  const doneThisWeek = records.filter((r) => r.status === "completed" && r.end && parseTwDate(r.end)! >= startOfWeek);
  const backlog = records.filter((r) => r.status === "pending").sort((a, b) => b.urgency - a.urgency).slice(0, 10);

  const sections: WeekMdSection[] = [
    { heading: "## 🔴 Overdue", rows: overdue.map(toRow) },
    { heading: "## 🟡 Active (started)", rows: active.map(toRow) },
    { heading: "## 🔵 This Week", rows: thisWeek.map(toRow) },
    { heading: "## 🔗 Blocked", rows: blocked.map(toRow) },
    { heading: "## 🔒 Blocking", rows: blocking.slice(0, 5).map(toRow) },
    { heading: "## 🔁 Recurring", rows: recurring.map(toRow) },
    { heading: "## ✅ Done This Week", rows: doneThisWeek.map(toRow) },
    { heading: "## ⚪ Backlog", rows: backlog.map(toRow) },
  ];

  return { weekNumber, weekRange, refreshedAt: now.toISOString(), sections };
}

function toRow(r: TaskExportRecord): Record<string, string | number> {
  return {
    "#": r.id,
    Task: r.description,
    Project: r.project ?? "—",
    Estimate: r.estimate ?? "—",
    Pri: r.priority ?? "—",
    Sch: r.scheduled ? formatDate(parseTwDate(r.scheduled)!) : "—",
    Due: r.due ? formatDate(parseTwDate(r.due)!) : "—",
  };
}

export function renderWeekMd(records: TaskExportRecord[], now = new Date()): string {
  const data = buildWeekMdData(records, now);
  const lines: string[] = [
    `# Week ${data.weekNumber} — ${data.weekRange}`,
    `_Refreshed: ${data.refreshedAt}_`,
    "",
  ];

  for (const section of data.sections) {
    lines.push(section.heading);
    lines.push("");
    if (section.rows.length === 0) {
      lines.push("*No tasks*");
      lines.push("");
      continue;
    }
    const keys = Object.keys(section.rows[0]);
    lines.push("| " + keys.join(" | ") + " |");
    lines.push("| " + keys.map(() => "---").join(" | ") + " |");
    for (const row of section.rows) {
      lines.push("| " + keys.map((k) => row[k] ?? "—").join(" | ") + " |");
    }
    lines.push("");
  }

  return lines.join("\n");
}

export async function writeWeekMd(
  vaultRoot: string,
  text: string,
): Promise<string> {
  const path = join(vaultRoot, "WEEK.md");
  await writeFile(path, text + "\n", "utf8");
  return path;
}

function parseTwDate(dateStr: string): Date | null {
  // Taskwarrior compact format: 20260422T015357Z → 2026-04-22T01:53:57Z
  const iso = dateStr.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, "$1-$2-$3T$4:$5:$6Z");
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getISOWeek(date: Date): number {
  const tmp = new Date(date);
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 4 - (tmp.getDay() || 7));
  const yearStart = new Date(tmp.getFullYear(), 0, 1);
  return Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
}
