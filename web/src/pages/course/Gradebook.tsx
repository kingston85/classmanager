import { useState } from 'react';
import type { Course } from '../../types';
import { classResults, round, uid } from '../../logic';
import { updateCourse } from '../../store';

export default function Gradebook({ course }: { course: Course }) {
  const [a, setA] = useState({ name: '', category: 'Assignment', max: '100', weight: '10', date: '' });
  const results = classResults(course);
  const byId = new Map(results.map((r) => [r.studentId, r]));
  const totalWeight = course.assessments.reduce((s, x) => s + x.weight, 0) + course.attendanceWeight;

  function addAssessment() {
    const max = Number(a.max), weight = Number(a.weight);
    if (!a.name.trim() || !(max > 0) || !(weight >= 0)) return;
    updateCourse(course.id, (c) => {
      c.assessments.push({ id: uid(), name: a.name.trim(), category: a.category.trim() || 'Assessment', max, weight, date: a.date || undefined });
    });
    setA({ ...a, name: '' });
  }

  function editAssessment(id: string, patch: Partial<{ name: string; category: string; max: number; weight: number; date: string }>) {
    updateCourse(course.id, (c) => {
      const x = c.assessments.find((y) => y.id === id);
      if (x) Object.assign(x, patch);
    });
  }

  function removeAssessment(id: string, name: string) {
    if (!confirm(`Delete "${name}" and all of its scores?`)) return;
    updateCourse(course.id, (c) => {
      c.assessments = c.assessments.filter((x) => x.id !== id);
      delete c.scores[id];
    });
  }

  function setScore(aid: string, sid: string, raw: string, max: number) {
    const t = raw.trim();
    updateCourse(course.id, (c) => {
      c.scores[aid] ??= {};
      if (t === '') { c.scores[aid][sid] = null; return; }
      const n = Number(t);
      if (Number.isFinite(n) && n >= 0) c.scores[aid][sid] = Math.min(n, max * 2);
    });
  }

  return (
    <>
      <div className="card">
        <h2>Assessments</h2>
        <div className="muted small" style={{ marginBottom: '.6rem' }}>
          Weights are a percentage of the final grade. Total (including {course.attendanceWeight}% attendance):{' '}
          <b className={Math.abs(totalWeight - 100) < 0.01 ? '' : 'error'}>{round(totalWeight, 2)}%</b>
        </div>
        <div className="table-wrap"><table>
          <thead><tr><th>Name</th><th>Type</th><th>Max</th><th>Weight %</th><th>Date</th><th /></tr></thead>
          <tbody>
            {course.assessments.map((x) => (
              <tr key={x.id}>
                <td><input defaultValue={x.name} onBlur={(e) => e.target.value.trim() && editAssessment(x.id, { name: e.target.value.trim() })} /></td>
                <td><input defaultValue={x.category} onBlur={(e) => editAssessment(x.id, { category: e.target.value.trim() })} /></td>
                <td><input className="num" type="number" min="1" defaultValue={x.max} onBlur={(e) => Number(e.target.value) > 0 && editAssessment(x.id, { max: Number(e.target.value) })} /></td>
                <td><input className="num" type="number" min="0" step="0.5" defaultValue={x.weight} onBlur={(e) => Number(e.target.value) >= 0 && editAssessment(x.id, { weight: Number(e.target.value) })} /></td>
                <td><input type="date" defaultValue={x.date ?? ''} onBlur={(e) => editAssessment(x.id, { date: e.target.value })} /></td>
                <td><button className="small danger" onClick={() => removeAssessment(x.id, x.name)}>Delete</button></td>
              </tr>
            ))}
            <tr>
              <td><input placeholder="New assessment, e.g. Mid-Term" value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} /></td>
              <td><input list="cats" value={a.category} onChange={(e) => setA({ ...a, category: e.target.value })} />
                <datalist id="cats"><option>Assignment</option><option>Quiz</option><option>Test</option><option>Mid-Term</option><option>Project</option><option>Final Exam</option><option>Participation</option></datalist></td>
              <td><input className="num" type="number" value={a.max} onChange={(e) => setA({ ...a, max: e.target.value })} /></td>
              <td><input className="num" type="number" value={a.weight} onChange={(e) => setA({ ...a, weight: e.target.value })} /></td>
              <td><input type="date" value={a.date} onChange={(e) => setA({ ...a, date: e.target.value })} /></td>
              <td><button className="primary small" onClick={addAssessment}>Add</button></td>
            </tr>
          </tbody>
        </table></div>
      </div>

      <div className="card">
        <h2>Scores</h2>
        {course.students.length === 0 || course.assessments.length === 0 ? (
          <div className="empty">Add students and at least one assessment to start entering scores.</div>
        ) : (
          <div className="table-wrap" style={{ maxHeight: 600, overflow: 'auto' }}><table>
            <thead>
              <tr>
                <th>Student</th>
                {course.assessments.map((x) => <th key={x.id} title={`${x.weight}% of grade`}>{x.name}<div className="small">/{x.max}</div></th>)}
                <th>Attend.</th><th>Standing</th><th>Grade</th><th>Rank</th>
              </tr>
            </thead>
            <tbody>
              {course.students.map((s) => {
                const r = byId.get(s.id)!;
                return (
                  <tr key={s.id}>
                    <td>{s.name} <span className="muted small">{s.studentNo}</span></td>
                    {course.assessments.map((x) => (
                      <td key={x.id}>
                        <input className="num" inputMode="decimal" defaultValue={course.scores[x.id]?.[s.id] ?? ''}
                          key={`${x.id}-${s.id}-${course.scores[x.id]?.[s.id] ?? ''}`}
                          onBlur={(e) => { const cur = course.scores[x.id]?.[s.id] ?? ''; if (e.target.value !== String(cur)) setScore(x.id, s.id, e.target.value, x.max); }} />
                      </td>
                    ))}
                    <td>{r.attendancePct === null ? '–' : `${round(r.attendancePct, 0)}%`}</td>
                    <td><b>{r.standing === null ? '–' : `${round(r.standing)}%`}</b></td>
                    <td><span className={`pill ${r.letter === 'F' ? 'bad' : r.letter === 'D' ? 'warn' : r.letter === '–' ? '' : 'ok'}`}>{r.letter}</span></td>
                    <td>{r.rank ?? '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
        <p className="muted small">Leave a cell empty if the student has not been graded yet (it is skipped). Enter 0 for an actual zero. Standing is calculated over the work graded so far.</p>
      </div>
    </>
  );
}
