import type { Course, ShareBundle, ShareEntry, StudentView } from './types';
import { attendanceStats, classResults, studentResult } from './logic';

// Share-file crypto: PBKDF2-HMAC-SHA256 (100,000 iterations) -> AES-256-GCM.
// The flutter app (app/lib/services/share_service.dart) implements the same format.
export const PBKDF2_ITERATIONS = 100_000;

export function b64(bytes: ArrayBuffer | Uint8Array): string {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s);
}

export function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function buildStudentView(course: Course, studentId: string): StudentView {
  const st = course.students.find((s) => s.id === studentId)!;
  const results = classResults(course);
  const mine = results.find((r) => r.studentId === studentId) ?? studentResult(course, studentId);
  const att = attendanceStats(course, studentId);
  return {
    name: st.name,
    studentNo: st.studentNo,
    attendance: [...course.sessions]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => ({ date: s.date, topic: s.topic, status: s.records[studentId] ?? '' })),
    attendancePct: att.pct,
    assessments: course.assessments.map((a) => ({
      name: a.name,
      category: a.category,
      max: a.max,
      weight: a.weight,
      score: course.scores[a.id]?.[studentId] ?? null,
      date: a.date,
    })),
    standing: mine.standing,
    projected: mine.projected,
    letter: mine.letter,
    rank: mine.rank,
    classSize: course.students.length,
  };
}

export async function buildShareBundle(course: Course): Promise<ShareBundle> {
  const entries: ShareEntry[] = [];
  for (const s of course.students) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(s.pin, salt);
    const plain = new TextEncoder().encode(JSON.stringify(buildStudentView(course, s.id)));
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, plain);
    entries.push({ studentNo: s.studentNo, salt: b64(salt), iv: b64(iv), data: b64(cipher) });
  }
  return {
    format: 'classmanager-share',
    v: 1,
    publishedAt: new Date().toISOString(),
    course: {
      code: course.code,
      title: course.title,
      section: course.section,
      semester: course.semester,
      lecturer: course.lecturer,
      room: course.room,
      time: course.time,
    },
    announcements: [...course.announcements].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.date.localeCompare(a.date)),
    entries,
  };
}

export function isShareBundle(x: unknown): x is ShareBundle {
  const b = x as ShareBundle;
  return !!b && b.format === 'classmanager-share' && b.v === 1 && Array.isArray(b.entries);
}

/** Returns the student's record, or null when the student number or PIN is wrong. */
export async function openEntry(bundle: ShareBundle, studentNo: string, pin: string): Promise<StudentView | null> {
  const entry = bundle.entries.find((e) => e.studentNo.trim().toLowerCase() === studentNo.trim().toLowerCase());
  if (!entry) return null;
  try {
    const key = await deriveKey(pin.trim(), unb64(entry.salt));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(entry.iv) as BufferSource }, key, unb64(entry.data) as BufferSource);
    return JSON.parse(new TextDecoder().decode(plain)) as StudentView;
  } catch {
    return null;
  }
}
