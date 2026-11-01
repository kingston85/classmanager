import { Link } from 'react-router-dom';
import type { Course } from '../../types';
import { assessmentStats, atRisk, attendanceStats, classResults, round, todayISO } from '../../logic';

export default function Overview({ course }: { course: Course }) {
  const results = classResults(course);
  const standings = results.map((r) => r.standing).filter((x): x is number => x !== null);
  const avg = standings.length ? standings.reduce((a, b) => a + b, 0) / standings.length : null;
  const held = course.sessions.filter((s) => s.date <= todayISO() && Object.keys(s.records).length > 0);
  const attPcts = course.students.map((s) => attendanceStats(course, s.id).pct).filter((x): x is number => x !== null);
  const attAvg = attPcts.length ? attPcts.reduce((a, b) => a + b, 0) / attPcts.length : null;
  const risk = atRisk(course);
  const totalWeight = course.assessments.reduce((s, a) => s + a.weight, 0) + course.attendanceWeight;
  const dist = course.scale.map((b) => ({ ...b, n: results.filter((r) => r.letter === b.letter).length }));
  const next = course.sessions.filter((s) => s.date >= todayISO()).sort((a, b) => a.date.localeCompare(b.date))[0];

  return (
    <>
      {course.students.length === 0 && (
        <div className="notice">Start by <Link to="roster">adding your class roster</Link>, then <Link to="settings">check the schedule</Link> and generate class sessions.</div>
      )}
      {Math.abs(totalWeight - 100) > 0.01 && course.assessments.length > 0 && (
        <div className="notice">Assessment weights add up to <b>{round(totalWeight, 2)}%</b>, not 100%. Standings still work (they are scaled to the graded work), but check your syllabus in <Link to="gradebook">Gradebook</Link>.</div>
      )}
      <div className="grid cols-3">
        <div className="card"><div className="stat">{course.students.length}<span className="muted small"> / {course.capacity}</span></div><div className="stat-label">Enrolled</div></div>
        <div className="card"><div className="stat">{avg === null ? '–' : `${round(avg)}%`}</div><div className="stat-label">Average standing</div></div>
        <div className="card"><div className="stat">{attAvg === null ? '–' : `${round(attAvg)}%`}</div><div className="stat-label">Average attendance ({held.length} sessions marked)</div></div>
        <div className="card"><div className="stat">{risk.length}</div><div className="stat-label"><Link to="risk">Students at risk</Link></div></div>
      </div>
      <div className="grid cols-2">
        <div className="card">
          <h2>Grade distribution</h2>
          {standings.length === 0 ? <div className="muted">No scores entered yet.</div> : dist.map((d) => (
            <div key={d.letter} className="row" style={{ margin: '.25rem 0' }}>
              <b style={{ width: 24 }}>{d.letter}</b>
              <div style={{ flex: 1, background: 'var(--soft)', borderRadius: 4, height: 16 }}>
                <div style={{ width: `${(d.n / Math.max(1, results.length)) * 100}%`, background: 'var(--brand-2)', height: '100%', borderRadius: 4 }} />
              </div>
              <span style={{ width: 28 }} className="right">{d.n}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <h2>Assessments</h2>
          {course.assessments.length === 0 && <div className="muted">None yet. Add them in <Link to="gradebook">Gradebook</Link>.</div>}
          {course.assessments.map((a) => {
            const s = assessmentStats(course, a);
            return (
              <div key={a.id} className="row between" style={{ padding: '.2rem 0' }}>
                <span>{a.name} <span className="muted small">({a.weight}%)</span></span>
                <span className="muted small">{s ? `avg ${round((s.mean / a.max) * 100)}% · ${s.n} graded` : 'not graded'}</span>
              </div>
            );
          })}
          {next && <div className="muted small" style={{ marginTop: '.8rem' }}>Next class: {next.date} {course.time}</div>}
        </div>
      </div>
    </>
  );
}
