import type { Assessment, Course, GradeBand, Session, Status, Student } from './types';

export const DEFAULT_SCALE: GradeBand[] = [
  { min: 90, letter: 'A', points: 4 },
  { min: 80, letter: 'B', points: 3 },
  { min: 70, letter: 'C', points: 2 },
  { min: 60, letter: 'D', points: 1 },
  { min: 0, letter: 'F', points: 0 },
];

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function genPin(): string {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(100000 + (a[0] % 900000));
}

export function todayISO(): string {
  const d = new Date();
  return toISO(d);
}

export function toISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function round(n: number, dp = 1): number {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}

export function blankCourse(lecturer: string): Course {
  return {
    id: uid(),
    code: '',
    title: '',
    section: '1',
    credits: 3,
    semester: '',
    room: '',
    lecturer,
    days: [1, 3, 5],
    time: '09:00',
    startDate: todayISO(),
    weeks: 15,
    capacity: 40,
    attendanceWeight: 0,
    riskAttendance: 75,
    riskStanding: 60,
    scale: DEFAULT_SCALE.map((b) => ({ ...b })),
    students: [],
    sessions: [],
    assessments: [],
    scores: {},
    announcements: [],
    createdAt: new Date().toISOString(),
  };
}

export function letterFor(pct: number | null, scale: GradeBand[]): GradeBand | null {
  if (pct === null) return null;
  const sorted = [...scale].sort((a, b) => b.min - a.min);
  for (const band of sorted) if (pct + 1e-9 >= band.min) return band;
  return sorted[sorted.length - 1] ?? null;
}

/** Class sessions generated from the weekly schedule, starting at startDate. */
export function generateSessions(course: Course): Session[] {
  const out: Session[] = [];
  if (!course.days.length) return out;
  const start = parseISO(course.startDate);
  for (let i = 0; i < course.weeks * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (course.days.includes(d.getDay())) {
      out.push({ id: uid(), date: toISO(d), topic: '', records: {} });
    }
  }
  return out;
}

export interface AttendanceStats {
  present: number;
  late: number;
  absent: number;
  excused: number;
  counted: number; // sessions that count (marked and not excused)
  marked: number;
  pct: number | null;
}

export function attendanceStats(course: Course, studentId: string): AttendanceStats {
  let present = 0, late = 0, absent = 0, excused = 0;
  for (const s of course.sessions) {
    const st = s.records[studentId];
    if (st === 'P') present++;
    else if (st === 'L') late++;
    else if (st === 'A') absent++;
    else if (st === 'E') excused++;
  }
  const marked = present + late + absent + excused;
  const counted = present + late + absent;
  // Late counts as half a session.
  const pct = counted === 0 ? null : ((present + 0.5 * late) / counted) * 100;
  return { present, late, absent, excused, counted, marked, pct };
}

/** An assessment is "graded" once at least one score has been entered for it. */
export function isGraded(course: Course, a: Assessment): boolean {
  const row = course.scores[a.id];
  return !!row && Object.values(row).some((v) => v !== null && v !== undefined);
}

export interface StudentResult {
  studentId: string;
  earned: number; // weighted points earned so far
  gradedWeight: number; // weight of the work that has a score for this student
  totalWeight: number;
  standing: number | null; // earned / gradedWeight, in %
  projected: number | null; // earned / totalWeight, in % (ungraded work counts as zero)
  letter: string;
  points: number | null;
  attendancePct: number | null;
  rank: number | null;
}

export function studentResult(course: Course, studentId: string): StudentResult {
  let earned = 0;
  let gradedWeight = 0;
  let totalWeight = 0;
  for (const a of course.assessments) {
    totalWeight += a.weight;
    const v = course.scores[a.id]?.[studentId];
    if (v !== null && v !== undefined && a.max > 0) {
      earned += (v / a.max) * a.weight;
      gradedWeight += a.weight;
    }
  }
  const att = attendanceStats(course, studentId);
  if (course.attendanceWeight > 0) {
    totalWeight += course.attendanceWeight;
    if (att.pct !== null) {
      earned += (att.pct / 100) * course.attendanceWeight;
      gradedWeight += course.attendanceWeight;
    }
  }
  const standing = gradedWeight > 0 ? (earned / gradedWeight) * 100 : null;
  const projected = totalWeight > 0 ? (earned / totalWeight) * 100 : null;
  const band = letterFor(standing, course.scale);
  return {
    studentId,
    earned,
    gradedWeight,
    totalWeight,
    standing,
    projected,
    letter: band?.letter ?? '–',
    points: band?.points ?? null,
    attendancePct: att.pct,
    rank: null,
  };
}

/** Results for every student, with competition ranking (ties share a rank). */
export function classResults(course: Course): StudentResult[] {
  const results = course.students.map((s) => studentResult(course, s.id));
  const ranked = results
    .filter((r) => r.standing !== null)
    .sort((a, b) => (b.standing as number) - (a.standing as number));
  let lastRank = 0;
  ranked.forEach((r, i) => {
    if (i > 0 && Math.abs((r.standing as number) - (ranked[i - 1].standing as number)) < 1e-9) {
      r.rank = lastRank;
    } else {
      r.rank = i + 1;
      lastRank = i + 1;
    }
  });
  return results;
}

export interface AssessmentStats {
  n: number;
  mean: number;
  median: number;
  high: number;
  low: number;
  sd: number;
  passRate: number; // % of scores at or above 60 % of max
  histogram: number[]; // 10 bins of 10 % each (last bin includes 100 %)
}

export function assessmentStats(course: Course, a: Assessment): AssessmentStats | null {
  const row = course.scores[a.id] ?? {};
  const ids = new Set(course.students.map((s) => s.id));
  const vals = Object.entries(row)
    .filter(([id, v]) => ids.has(id) && v !== null && v !== undefined && a.max > 0)
    .map(([, v]) => v as number);
  if (!vals.length) return null;
  const n = vals.length;
  const mean = vals.reduce((s, v) => s + v, 0) / n;
  const sorted = [...vals].sort((x, y) => x - y);
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  const histogram = new Array(10).fill(0);
  for (const v of vals) {
    const bin = Math.min(9, Math.max(0, Math.floor((v / a.max) * 10)));
    histogram[bin]++;
  }
  const passRate = (vals.filter((v) => v / a.max >= 0.6).length / n) * 100;
  return { n, mean, median, high: sorted[n - 1], low: sorted[0], sd, passRate, histogram };
}

export interface RiskEntry {
  student: Student;
  reasons: string[];
  attendancePct: number | null;
  standing: number | null;
  severity: number;
}

export function atRisk(course: Course): RiskEntry[] {
  const out: RiskEntry[] = [];
  for (const s of course.students) {
    const r = studentResult(course, s.id);
    const reasons: string[] = [];
    let severity = 0;
    if (r.attendancePct !== null && r.attendancePct < course.riskAttendance) {
      reasons.push(`Attendance ${round(r.attendancePct)}% (below ${course.riskAttendance}%)`);
      severity += course.riskAttendance - r.attendancePct;
    }
    if (r.standing !== null && r.standing < course.riskStanding) {
      reasons.push(`Standing ${round(r.standing)}% (below ${course.riskStanding}%)`);
      severity += course.riskStanding - r.standing;
    }
    const missing = course.assessments.filter(
      (a) => isGraded(course, a) && (course.scores[a.id]?.[s.id] ?? null) === null,
    ).length;
    if (missing > 0) {
      reasons.push(`${missing} graded assessment${missing > 1 ? 's' : ''} with no score`);
      severity += missing * 5;
    }
    if (reasons.length) {
      out.push({ student: s, reasons, attendancePct: r.attendancePct, standing: r.standing, severity });
    }
  }
  return out.sort((a, b) => b.severity - a.severity);
}

// ---------- CSV ----------

export function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
}

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',' || c === '\t') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows.map((r) => r.map((x) => x.trim()));
}

/** Parse pasted roster lines: "studentNo, name[, email[, phone]]" (header row optional). */
export function parseRoster(text: string): { studentNo: string; name: string; email?: string; phone?: string }[] {
  const rows = parseCSV(text);
  const out: { studentNo: string; name: string; email?: string; phone?: string }[] = [];
  rows.forEach((r, i) => {
    if (i === 0 && /^(student|id|no|#)/i.test(r[0]) && /name/i.test(r[1] ?? '')) return;
    if (r.length < 2 || !r[0] || !r[1]) return;
    out.push({ studentNo: r[0], name: r[1], email: r[2] || undefined, phone: r[3] || undefined });
  });
  return out;
}

export function download(filename: string, content: string, mime = 'text/plain'): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function statusLabel(s: Status | undefined): string {
  return s === 'P' ? 'Present' : s === 'A' ? 'Absent' : s === 'L' ? 'Late' : s === 'E' ? 'Excused' : '—';
}
