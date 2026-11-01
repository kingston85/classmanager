import { useState } from 'react';
import type { Course } from '../../types';
import { attendanceStats, classResults, download, round, statusLabel, toCSV, todayISO } from '../../logic';
import { buildStudentView } from '../../share';

type Mode = 'none' | 'registrar' | 'signin' | 'student';

export default function Reports({ course }: { course: Course }) {
  const [mode, setMode] = useState<Mode>('none');
  const [sid, setSid] = useState(course.students[0]?.id ?? '');
  const results = classResults(course);
  const byId = new Map(results.map((r) => [r.studentId, r]));
  const slug = course.code.replace(/\s+/g, '');

  function gradebookCSV() {
    const head = ['Student no.', 'Name', ...course.assessments.map((a) => `${a.name} (/${a.max}, ${a.weight}%)`), 'Attendance %', 'Standing %', 'Projected %', 'Grade', 'Rank'];
    const rows = course.students.map((s) => {
      const r = byId.get(s.id)!;
      return [s.studentNo, s.name, ...course.assessments.map((a) => course.scores[a.id]?.[s.id] ?? ''), r.attendancePct === null ? '' : round(r.attendancePct), r.standing === null ? '' : round(r.standing, 2), r.projected === null ? '' : round(r.projected, 2), r.letter, r.rank ?? ''];
    });
    download(`${slug}-gradebook-${todayISO()}.csv`, toCSV([head, ...rows]), 'text/csv');
  }

  function attendanceCSV() {
    const sessions = [...course.sessions].sort((a, b) => a.date.localeCompare(b.date));
    const head = ['Student no.', 'Name', ...sessions.map((s) => s.date), 'Present', 'Late', 'Absent', 'Excused', 'Attendance %'];
    const rows = course.students.map((s) => {
      const a = attendanceStats(course, s.id);
      return [s.studentNo, s.name, ...sessions.map((x) => x.records[s.id] ?? ''), a.present, a.late, a.absent, a.excused, a.pct === null ? '' : round(a.pct)];
    });
    download(`${slug}-attendance-${todayISO()}.csv`, toCSV([head, ...rows]), 'text/csv');
  }

  const header = (
    <div style={{ marginBottom: '.8rem' }}>
      <h2 style={{ marginBottom: 0 }}>University grade sheet — {course.code} {course.title}</h2>
      <div className="small">Section {course.section} · {course.semester} · {course.credits} credit hours · Lecturer: {course.lecturer || '________'} · {todayISO()}</div>
    </div>
  );

  return (
    <>
      <div className="card no-print">
        <h2>Export and print</h2>
        <div className="row">
          <button onClick={gradebookCSV}>Gradebook (CSV)</button>
          <button onClick={attendanceCSV}>Attendance register (CSV)</button>
          <button className={mode === 'registrar' ? 'primary' : ''} onClick={() => setMode('registrar')}>Registrar grade sheet</button>
          <button className={mode === 'signin' ? 'primary' : ''} onClick={() => setMode('signin')}>Sign-in sheet</button>
          <button className={mode === 'student' ? 'primary' : ''} onClick={() => setMode('student')}>Student report</button>
          {mode !== 'none' && <button className="primary" onClick={() => window.print()}>🖨 Print</button>}
        </div>
        {mode === 'student' && (
          <label style={{ marginTop: '.8rem', maxWidth: 360 }}>Student
            <select value={sid} onChange={(e) => setSid(e.target.value)}>{course.students.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.studentNo})</option>)}</select>
          </label>
        )}
      </div>

      {mode === 'registrar' && (
        <div className="card">
          {header}
          <table>
            <thead><tr><th>#</th><th>Student no.</th><th>Name</th><th>Standing %</th><th>Grade</th><th>Points</th></tr></thead>
            <tbody>
              {course.students.map((s, i) => {
                const r = byId.get(s.id)!;
                return <tr key={s.id}><td>{i + 1}</td><td>{s.studentNo}</td><td>{s.name}</td><td>{r.standing === null ? '' : round(r.standing)}</td><td>{r.letter}</td><td>{r.points ?? ''}</td></tr>;
              })}
            </tbody>
          </table>
          <div className="small" style={{ marginTop: '1.5rem' }}>Lecturer signature: ______________________ &nbsp; Date: ____________</div>
        </div>
      )}

      {mode === 'signin' && (
        <div className="card">
          {header}
          <table>
            <thead><tr><th>#</th><th>Student no.</th><th>Name</th><th style={{ width: '30%' }}>Signature</th></tr></thead>
            <tbody>
              {course.students.map((s, i) => <tr key={s.id} style={{ height: 30 }}><td>{i + 1}</td><td>{s.studentNo}</td><td>{s.name}</td><td /></tr>)}
            </tbody>
          </table>
        </div>
      )}

      {mode === 'student' && sid && course.students.some((s) => s.id === sid) && <StudentReport course={course} sid={sid} />}
    </>
  );
}

function StudentReport({ course, sid }: { course: Course; sid: string }) {
  const v = buildStudentView(course, sid);
  return (
    <div className="card">
      <h2 style={{ marginBottom: 0 }}>Progress report — {v.name} ({v.studentNo})</h2>
      <div className="small" style={{ marginBottom: '.8rem' }}>{course.code} {course.title} · Section {course.section} · {course.semester} · {todayISO()}</div>
      <p>
        <b>Current standing:</b> {v.standing === null ? '–' : `${round(v.standing)}% (${v.letter})`} &nbsp;
        <b>Attendance:</b> {v.attendancePct === null ? '–' : `${round(v.attendancePct)}%`} &nbsp;
        <b>Rank:</b> {v.rank ? `${v.rank} of ${v.classSize}` : '–'}
      </p>
      <table>
        <thead><tr><th>Assessment</th><th>Weight</th><th>Score</th><th>%</th></tr></thead>
        <tbody>
          {v.assessments.map((a, i) => <tr key={i}><td>{a.name}</td><td>{a.weight}%</td><td>{a.score === null ? 'not graded' : `${a.score}/${a.max}`}</td><td>{a.score === null ? '' : round((a.score / a.max) * 100)}</td></tr>)}
        </tbody>
      </table>
      <h3 style={{ marginTop: '1rem' }}>Attendance</h3>
      <table>
        <thead><tr><th>Date</th><th>Topic</th><th>Status</th></tr></thead>
        <tbody>{v.attendance.filter((a) => a.status).map((a, i) => <tr key={i}><td>{a.date}</td><td>{a.topic}</td><td>{statusLabel(a.status || undefined)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
