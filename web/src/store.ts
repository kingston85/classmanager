import { useSyncExternalStore } from 'react';
import type { Course, Workspace } from './types';
import { DEFAULT_SCALE } from './logic';

const KEY = 'classmanager.workspace.v1';

function empty(): Workspace {
  return { version: 1, lecturerName: '', courses: [] };
}

function load(): Workspace {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    return normalize(JSON.parse(raw));
  } catch {
    return empty();
  }
}

/** Fill in any fields missing from older or hand-edited backups. */
export function normalize(w: Partial<Workspace>): Workspace {
  const courses: Course[] = ((w.courses ?? []) as Partial<Course>[]).map((c) => ({
    section: '1', credits: 3, semester: '', room: '', lecturer: '', days: [1, 3, 5], time: '09:00',
    startDate: new Date().toISOString().slice(0, 10), weeks: 15, capacity: 40, attendanceWeight: 0,
    riskAttendance: 75, riskStanding: 60, scale: DEFAULT_SCALE.map((b) => ({ ...b })),
    students: [], sessions: [], assessments: [], scores: {}, announcements: [],
    createdAt: new Date().toISOString(),
    ...c,
  }) as Course);
  return { version: 1, lecturerName: w.lecturerName ?? '', courses };
}

let state: Workspace = load();
const listeners = new Set<() => void>();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    alert('Could not save: browser storage is full or blocked. Export a backup from Settings.');
  }
}

export function getState(): Workspace {
  return state;
}

export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function mutate(fn: (w: Workspace) => void): void {
  const next = structuredClone(state);
  fn(next);
  state = next;
  save();
  listeners.forEach((l) => l());
}

export function replaceWorkspace(w: Workspace): void {
  state = normalize(w);
  save();
  listeners.forEach((l) => l());
}

export function useWorkspace(): Workspace {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function useCourse(id: string | undefined): Course | undefined {
  const w = useWorkspace();
  return w.courses.find((c) => c.id === id);
}

export function updateCourse(id: string, fn: (c: Course) => void): void {
  mutate((w) => {
    const c = w.courses.find((x) => x.id === id);
    if (c) fn(c);
  });
}
