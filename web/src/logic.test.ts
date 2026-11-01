import { describe, expect, it } from 'vitest';
import {
  assessmentStats, atRisk, attendanceStats, blankCourse, classResults, generateSessions,
  letterFor, parseCSV, parseRoster, studentResult, toCSV, DEFAULT_SCALE,
} from './logic';
import { buildShareBundle, openEntry } from './share';
import type { Course } from './types';

function sample(): Course {
  const c = blankCourse('Dr. Test');
  c.code = 'ESEM 303';
  c.startDate = '2026-09-07'; // a Monday
  c.weeks = 2;
  c.students = [
    { id: 's1', studentNo: '1001', name: 'Ama', pin: '111111' },
    { id: 's2', studentNo: '1002', name: 'Kofi', pin: '222222' },
    { id: 's3', studentNo: '1003', name: 'Zainab', pin: '333333' },
  ];
  c.assessments = [
    { id: 'a1', name: 'Test 1', category: 'Test', max: 20, weight: 20 },
    { id: 'a2', name: 'Final', category: 'Exam', max: 100, weight: 80 },
  ];
  c.scores = { a1: { s1: 18, s2: 10, s3: 18 }, a2: {} };
  return c;
}

describe('grading', () => {
  it('maps percentages to letters using the scale', () => {
    expect(letterFor(95, DEFAULT_SCALE)?.letter).toBe('A');
    expect(letterFor(89.9, DEFAULT_SCALE)?.letter).toBe('B');
    expect(letterFor(60, DEFAULT_SCALE)?.letter).toBe('D');
    expect(letterFor(12, DEFAULT_SCALE)?.letter).toBe('F');
    expect(letterFor(null, DEFAULT_SCALE)).toBeNull();
  });

  it('computes standing over graded work and projected over all work', () => {
    const c = sample();
    const r = studentResult(c, 's1');
    expect(r.earned).toBeCloseTo(18);
    expect(r.standing).toBeCloseTo(90);
    expect(r.projected).toBeCloseTo(18);
    expect(r.letter).toBe('A');
  });

  it('treats a missing score as not-yet-graded but an explicit 0 as zero', () => {
    const c = sample();
    c.scores.a1.s2 = null;
    expect(studentResult(c, 's2').standing).toBeNull();
    c.scores.a1.s2 = 0;
    expect(studentResult(c, 's2').standing).toBe(0);
  });

  it('ranks with ties sharing a position', () => {
    const c = sample();
    const res = classResults(c);
    expect(res.find((r) => r.studentId === 's1')?.rank).toBe(1);
    expect(res.find((r) => r.studentId === 's3')?.rank).toBe(1);
    expect(res.find((r) => r.studentId === 's2')?.rank).toBe(3);
  });

  it('includes attendance as a weighted component when set', () => {
    const c = sample();
    c.attendanceWeight = 20;
    c.sessions = [
      { id: 'x1', date: '2026-09-07', topic: '', records: { s1: 'P' } },
      { id: 'x2', date: '2026-09-09', topic: '', records: { s1: 'A' } },
    ];
    const r = studentResult(c, 's1');
    expect(r.attendancePct).toBe(50);
    expect(r.gradedWeight).toBe(40);
    expect(r.earned).toBeCloseTo(18 + 10);
    expect(r.totalWeight).toBe(120);
  });
});

describe('attendance', () => {
  it('counts late as half and ignores excused', () => {
    const c = sample();
    c.sessions = ['P', 'L', 'A', 'E'].map((s, i) => ({
      id: 'q' + i, date: `2026-09-0${i + 1}`, topic: '', records: { s1: s as 'P' },
    }));
    const a = attendanceStats(c, 's1');
    expect(a.counted).toBe(3);
    expect(a.pct).toBeCloseTo(50);
  });

  it('generates sessions on the scheduled weekdays only', () => {
    const c = sample(); // Mon/Wed/Fri, 2 weeks
    const s = generateSessions(c);
    expect(s).toHaveLength(6);
    expect(s[0].date).toBe('2026-09-07');
    expect(s[5].date).toBe('2026-09-18');
  });
});

describe('analysis and risk', () => {
  it('computes assessment statistics', () => {
    const c = sample();
    const st = assessmentStats(c, c.assessments[0])!;
    expect(st.n).toBe(3);
    expect(st.mean).toBeCloseTo(46 / 3);
    expect(st.median).toBe(18);
    expect(st.high).toBe(18);
    expect(st.low).toBe(10);
    expect(st.histogram.reduce((a, b) => a + b, 0)).toBe(3);
    expect(assessmentStats(c, c.assessments[1])).toBeNull();
  });

  it('flags low standing and missing scores', () => {
    const c = sample();
    c.scores.a1.s3 = null;
    const flagged = atRisk(c);
    const names = flagged.map((f) => f.student.name);
    expect(names).toContain('Kofi'); // 50 % standing
    expect(names).toContain('Zainab'); // missing graded score
    expect(names).not.toContain('Ama');
  });
});

describe('csv', () => {
  it('round-trips quotes and commas', () => {
    const rows = [['a', 'b,c', 'd"e'], ['1', '', '3']];
    expect(parseCSV(toCSV(rows))).toEqual(rows);
  });

  it('parses a roster with or without header', () => {
    const withHeader = parseRoster('Student No,Name,Email\n1001,Ama Doe,ama@x.com\n1002,Kofi Mensah');
    expect(withHeader).toHaveLength(2);
    expect(withHeader[0]).toMatchObject({ studentNo: '1001', name: 'Ama Doe', email: 'ama@x.com' });
    expect(parseRoster('1001\tAma Doe')).toHaveLength(1);
  });
});

describe('share bundle', () => {
  it('lets a student open only their own record with the right PIN', async () => {
    const c = sample();
    const bundle = await buildShareBundle(c);
    expect(bundle.entries).toHaveLength(3);
    const mine = await openEntry(bundle, '1001', '111111');
    expect(mine?.name).toBe('Ama');
    expect(mine?.letter).toBe('A');
    expect(await openEntry(bundle, '1001', '222222')).toBeNull();
    expect(await openEntry(bundle, '9999', '111111')).toBeNull();
    expect(JSON.stringify(bundle)).not.toContain('Kofi');
  });
});
