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

// ---------- Insights ----------

export interface NeededScore {
  needed: number; // raw score needed on the assessment
  neededPct: number; // as % of the assessment maximum
  alreadyThere: boolean; // target already reached without this assessment
  possible: boolean; // reachable with a score at or below the maximum
}

/**
 * What the student must score on one assessment to finish on `targetPct` of the whole course.
 * Every OTHER ungraded piece of work is assumed to score zero, which keeps the answer conservative.
 */
export function neededScore(course: Course, studentId: string, assessmentId: string, targetPct: number): NeededScore | null {
  const a = course.assessments.find((x) => x.id === assessmentId);
  if (!a || a.max <= 0 || a.weight <= 0) return null;
  let earnedOther = 0;
  let total = 0;
  for (const x of course.assessments) {
    total += x.weight;
    if (x.id === a.id) continue;
    const v = course.scores[x.id]?.[studentId];
    if (v !== null && v !== undefined && x.max > 0) earnedOther += (v / x.max) * x.weight;
  }
  if (course.attendanceWeight > 0) {
    total += course.attendanceWeight;
    const att = attendanceStats(course, studentId);
    if (att.pct !== null) earnedOther += (att.pct / 100) * course.attendanceWeight;
  }
  const pointsNeeded = (targetPct / 100) * total - earnedOther;
  const needed = Math.max(0, (pointsNeeded / a.weight) * a.max);
  return {
    needed,
    neededPct: (needed / a.max) * 100,
    alreadyThere: pointsNeeded <= 0,
    possible: needed <= a.max + 1e-9,
  };
}

/** Standing of each student after adding `shift` percentage points (capped at 100), counted by letter. */
export function curvePreview(course: Course, shift: number): { letter: string; before: number; after: number }[] {
  const results = classResults(course).filter((r) => r.standing !== null);
  return course.scale.map((band) => ({
    letter: band.letter,
    before: results.filter((r) => letterFor(r.standing, course.scale)?.letter === band.letter).length,
    after: results.filter((r) => letterFor(Math.min(100, (r.standing as number) + shift), course.scale)?.letter === band.letter).length,
  }));
}

export interface Group {
  members: Student[];
  avg: number | null;
}

/** Balanced project groups: students ranked by standing are dealt out in a snake pattern. */
export function balancedGroups(course: Course, count: number): Group[] {
  const k = Math.max(1, Math.min(count, course.students.length || 1));
  const results = new Map(classResults(course).map((r) => [r.studentId, r.standing]));
  const ranked = [...course.students].sort(
    (a, b) => (results.get(b.id) ?? -1) - (results.get(a.id) ?? -1) || a.name.localeCompare(b.name),
  );
  const groups: Student[][] = Array.from({ length: k }, () => []);
  ranked.forEach((s, i) => {
    const round = Math.floor(i / k);
    const pos = i % k;
    groups[round % 2 === 0 ? pos : k - 1 - pos].push(s);
  });
  return groups.map((members) => {
    const vals = members.map((m) => results.get(m.id)).filter((x): x is number => x !== null && x !== undefined);
    return { members, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null };
  });
}

/** Colour for a 0-100 value: red -> amber -> green. */
export function heatColor(pct: number | null): string {
  if (pct === null) return 'transparent';
  const p = Math.max(0, Math.min(100, pct));
  return `hsl(${Math.round(p * 1.2)}, 62%, ${p > 50 ? 38 : 42}%)`;
}

export function weekStart(iso: string): string {
  const d = parseISO(iso);
  const back = (d.getDay() + 6) % 7; // Monday start
  d.setDate(d.getDate() - back);
  return toISO(d);
}

// ---------- Demo data ----------

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEMO_NAMES = [
  'Ama Doe', 'Kofi Mensah', 'Zainab Kamara', 'Joseph Tarpeh', 'Marie Gbowee', 'Emmanuel Kollie', 'Fatu Sirleaf',
  'Samuel Nyenpan', 'Comfort Wiles', 'Prince Dolo', 'Hawa Johnson', 'Abraham Toe', 'Grace Flomo', 'Moses Kpoto',
  'Mariama Sesay', 'Daniel Weah', 'Esther Boakai', 'Patrick Quiah', 'Naomi Cooper', 'Isaac Browne', 'Alieu Barry',
  'Rebecca Davies', 'Jerome Gaye', 'Musu Kromah', 'Peter Zayzay', 'Janet Harmon', 'Augustine Lomax', 'Bintu Fofana',
  'Henry Yeanay', 'Victoria Massaquoi', 'Oliver Tubman', 'Satta Konneh', 'Benjamin Saye', 'Josephine Dennis', 'Thomas Gartor',
];

/** A realistic sample class so every screen has something to show. Deterministic. */
export function demoCourse(lecturer: string): Course {
  const rnd = mulberry32(303);
  const c = blankCourse(lecturer);
  c.code = 'DEMO 303';
  c.title = 'Fundamentals of Environmental Monitoring (sample class)';
  c.semester = 'Sample data';
  c.room = 'AB2-7W';
  c.time = '14:00';
  c.weeks = 8;
  c.attendanceWeight = 5;
  const start = new Date();
  start.setDate(start.getDate() - 28);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // a Monday four-plus weeks ago
  c.startDate = toISO(start);
  c.students = DEMO_NAMES.map((name, i) => ({
    id: uid(),
    studentNo: String(1001 + i),
    name,
    email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
    pin: genPin(),
  }));
  c.sessions = generateSessions(c);
  const topics = ['Introduction to monitoring', 'Sampling design', 'Water quality indicators', 'Air quality and AQI', 'Soil sampling', 'QA/QC and calibration', 'Data analysis', 'Reporting'];
  c.sessions.forEach((s, i) => { s.topic = topics[Math.floor(i / 3)] ?? ''; });
  const today = todayISO();
  const ability = c.students.map(() => 0.45 + rnd() * 0.5);
  const diligence = c.students.map(() => 0.55 + rnd() * 0.45);
  c.sessions.filter((s) => s.date <= today).forEach((s) => {
    c.students.forEach((st, i) => {
      const r = rnd();
      s.records[st.id] = r < diligence[i] - 0.1 ? 'P' : r < diligence[i] ? 'L' : r < diligence[i] + 0.25 ? 'A' : 'E';
    });
  });
  c.assessments = [
    { id: 'd1', name: 'Assignment 1', category: 'Assignment', max: 10, weight: 10 },
    { id: 'd2', name: 'Test One', category: 'Test', max: 20, weight: 20 },
    { id: 'd3', name: 'Mid-Term Exam', category: 'Mid-Term', max: 50, weight: 30 },
    { id: 'd4', name: 'Final Exam', category: 'Final Exam', max: 100, weight: 35 },
  ];
  c.scores = { d1: {}, d2: {}, d3: {}, d4: {} };
  c.students.forEach((st, i) => {
    for (const a of c.assessments.slice(0, 3)) {
      const skip = rnd() < 0.04; // a couple of missing scores to show up in the at-risk list
      c.scores[a.id][st.id] = skip ? null : Math.round(Math.min(1, Math.max(0.1, ability[i] + (rnd() - 0.5) * 0.3)) * a.max * 2) / 2;
    }
  });
  c.announcements = [{ id: uid(), title: 'Welcome to the sample class', body: 'This is demo data. Delete the course from Course settings when you are done exploring.', date: today, pinned: true }];
  return c;
}
