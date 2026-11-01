import { useState } from 'react';
import type { Course } from '../../types';
import { balancedGroups, download, round, toCSV, todayISO } from '../../logic';

export default function Groups({ course }: { course: Course }) {
  const [count, setCount] = useState(Math.max(2, Math.round(course.students.length / 5)) || 2);
  if (course.students.length < 2) return <div className="card empty">Add at least two students to form groups.</div>;
  const groups = balancedGroups(course, count);

  function exportCSV() {
    const rows: unknown[][] = [['Group', 'Student no.', 'Name']];
    groups.forEach((g, i) => g.members.forEach((m) => rows.push([`Group ${i + 1}`, m.studentNo, m.name])));
    download(`${course.code.replace(/\s+/g, '')}-groups-${todayISO()}.csv`, toCSV(rows), 'text/csv');
  }

  return (
    <>
      <div className="card no-print">
        <h2>Balanced project groups</h2>
        <p className="muted small" style={{ marginTop: 0 }}>Students are ranked by current standing and dealt out in a snake pattern (1→N, then N→1), so every group gets a similar mix of strong and struggling students and a similar average.</p>
        <div className="row">
          <label>Number of groups<input type="number" min={2} max={Math.max(2, course.students.length)} value={count} onChange={(e) => setCount(Math.max(2, Number(e.target.value) || 2))} style={{ width: 100 }} /></label>
          <span className="muted small">≈ {Math.round(course.students.length / count)} per group</span>
          <button onClick={exportCSV}>Download CSV</button>
          <button className="primary" onClick={() => window.print()}>🖨 Print</button>
        </div>
      </div>
      <div className="grid cols-3">
        {groups.map((g, i) => (
          <div className="card slip" key={i} style={{ margin: 0 }}>
            <div className="row between"><h3 style={{ margin: 0 }}>Group {i + 1}</h3><span className="pill">avg {g.avg === null ? '–' : round(g.avg, 0) + '%'}</span></div>
            <ol style={{ margin: '.5rem 0 0', paddingLeft: '1.2rem' }}>
              {g.members.map((m) => <li key={m.id}>{m.name} <span className="muted small">{m.studentNo}</span></li>)}
            </ol>
          </div>
        ))}
      </div>
    </>
  );
}
