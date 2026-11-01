import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { replaceWorkspace } from './store';
import { blankCourse, generateSessions } from './logic';

// Node has no browser storage; give the store an in-memory one.
const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage;

// Smoke test: every screen renders without throwing for a realistic course.
function seed() {
  const c = blankCourse('Dr. Test');
  c.id = 'c1';
  c.code = 'ESEM 303';
  c.title = 'Environmental Monitoring';
  c.startDate = '2026-09-07';
  c.weeks = 2;
  c.attendanceWeight = 5;
  c.students = [
    { id: 's1', studentNo: '1001', name: 'Ama Doe', pin: '111111', email: 'a@x.com' },
    { id: 's2', studentNo: '1002', name: 'Kofi Mensah', pin: '222222' },
  ];
  c.sessions = generateSessions(c);
  c.sessions[0].records = { s1: 'P', s2: 'A' };
  c.assessments = [{ id: 'a1', name: 'Test 1', category: 'Test', max: 20, weight: 20 }];
  c.scores = { a1: { s1: 18, s2: 5 } };
  c.announcements = [{ id: 'n1', title: 'Welcome', body: 'Hello', date: '2026-09-01', pinned: true }];
  replaceWorkspace({ version: 1, lecturerName: 'Dr. Test', courses: [c] });
}

describe('screens render', () => {
  const routes = [
    '/', '/student', '/settings', '/course/c1', '/course/c1/roster', '/course/c1/attendance',
    '/course/c1/gradebook', '/course/c1/analysis', '/course/c1/risk', '/course/c1/announcements',
    '/course/c1/share', '/course/c1/reports', '/course/c1/settings',
  ];
  for (const r of routes) {
    it(r, () => {
      seed();
      const html = renderToString(
        <MemoryRouter initialEntries={[r]}>
          <App />
        </MemoryRouter>,
      );
      expect(html.length).toBeGreaterThan(200);
      if (r.startsWith('/course/c1')) expect(html).toContain('ESEM 303');
    });
  }
});
