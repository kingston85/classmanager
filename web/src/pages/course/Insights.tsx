import { useState } from 'react';
import type { Course } from '../../types';
import { classResults, curvePreview, heatColor, neededScore, round } from '../../logic';

export default function Insights({ course }: { course: Course }) {
  const results = classResults(course);
  const byId = new Map(results.map((r) => [r.studentId, r]));
  const sessions = [...course.sessions].filter((s) => Object.keys(s.records).length > 0).sort((a, b) => a.date.localeCompare(b.date));
  const [shift, setShift] = useState(0);
  const [target, setTarget] = useState(70);
  const [aid, setAid] = useState(course.assessments.find((a) => !course.students.every((s) => course.scores[a.id]?.[s.id] != null))?.id ?? course.assessments[course.assessments.length - 1]?.id ?? '');
  const curve = curvePreview(course, shift);
  const peak = Math.max(1, ...curve.flatMap((c) => [c.before, c.after]));

  if (course.students.length === 0) return <div className="card empty">Add students first.</div>;

  const attColor: Record<string, string> = { P: 'var(--ok)', L: 'var(--warn)', A: 'var(--bad)', E: 'var(--brand-2)' };
  const ordered = [...course.students].sort((a, b) => (byId.get(b.id)?.standing ?? -1) - (byId.get(a.id)?.standing ?? -1));

  return (
    <>
      <div className="card">
        <h2>Score heat map</h2>
        <p className="muted small" style={{ marginTop: 0 }}>Students ranked best to weakest. Each cell is the percentage scored; grey means not graded.</p>
        {course.assessments.length === 0 ? <div className="empty">No assessments yet.</div> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Student</th>{course.assessments.map((a) => <th key={a.id} className="center">{a.name}</th>)}<th className="center">Standing</th></tr></thead>
            <tbody>
              {ordered.map((s) => {
                const r = byId.get(s.id)!;
                return (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    {course.assessments.map((a) => {
                      const v = course.scores[a.id]?.[s.id];
                      const pct = v === null || v === undefined ? null : (v / a.max) * 100;
                      return <td key={a.id} className="center" style={{ background: heatColor(pct), color: pct === null ? 'var(--muted)' : '#fff', minWidth: 70 }}>{pct === null ? '–' : round(pct, 0)}</td>;
                    })}
                    <td className="center" style={{ background: heatColor(r.standing), color: r.standing === null ? 'var(--muted)' : '#fff', fontWeight: 700 }}>{r.standing === null ? '–' : round(r.standing, 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </div>

      <div className="card">
        <h2>Attendance heat map</h2>
        {sessions.length === 0 ? <div className="empty">Mark attendance for at least one session.</div> : (
          <>
            <div className="row small muted" style={{ marginBottom: '.5rem' }}>
              {Object.entries({ P: 'Present', L: 'Late', A: 'Absent', E: 'Excused' }).map(([k, label]) => (
                <span key={k}><span style={{ display: 'inline-block', width: 12, height: 12, background: attColor[k], borderRadius: 3, verticalAlign: -1 }} /> {label}</span>
              ))}
            </div>
            <div className="table-wrap"><table>
              <thead><tr><th>Student</th>{sessions.map((s) => <th key={s.id} className="center" style={{ padding: '.4rem .25rem' }}>{s.date.slice(5)}</th>)}<th className="center">%</th></tr></thead>
              <tbody>
                {course.students.map((st) => (
                  <tr key={st.id}>
                    <td>{st.name}</td>
                    {sessions.map((s) => {
                      const v = s.records[st.id];
                      return <td key={s.id} title={`${s.date}: ${v ?? 'not marked'}`} style={{ background: v ? attColor[v] : 'var(--soft)', padding: 0, minWidth: 26 }}><div style={{ height: 24 }} /></td>;
                    })}
                    <td className="center">{byId.get(st.id)?.attendancePct == null ? '–' : round(byId.get(st.id)!.attendancePct as number, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </>
        )}
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h2>What do I need on…?</h2>
          <p className="muted small" style={{ marginTop: 0 }}>For each student: the score needed on one assessment to finish the course on the target. Other ungraded work is assumed to score zero, so this is the safe estimate.</p>
          {course.assessments.length === 0 ? <div className="empty">No assessments yet.</div> : (
            <>
              <div className="row" style={{ marginBottom: '.6rem' }}>
                <label>Assessment
                  <select value={aid} onChange={(e) => setAid(e.target.value)}>{course.assessments.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                </label>
                <label>Target final %
                  <input type="number" className="num" style={{ width: 90 }} value={target} min={0} max={100} onChange={(e) => setTarget(Number(e.target.value))} />
                </label>
              </div>
              <div className="table-wrap" style={{ maxHeight: 360, overflow: 'auto' }}><table>
                <thead><tr><th>Student</th><th>Needs</th><th /></tr></thead>
                <tbody>
                  {course.students.map((s) => {
                    const a = course.assessments.find((x) => x.id === aid)!;
                    const n = neededScore(course, s.id, aid, target);
                    if (!n) return null;
                    return (
                      <tr key={s.id}>
                        <td>{s.name}</td>
                        <td>{n.alreadyThere ? 'Already there' : `${round(n.needed)} / ${a.max} (${round(n.neededPct, 0)}%)`}</td>
                        <td><span className={`pill ${n.alreadyThere ? 'ok' : n.possible ? (n.neededPct > 85 ? 'warn' : '') : 'bad'}`}>{n.alreadyThere ? 'safe' : n.possible ? (n.neededPct > 85 ? 'tough' : 'doable') : 'out of reach'}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            </>
          )}
        </div>

        <div className="card">
          <h2>Curve preview</h2>
          <p className="muted small" style={{ marginTop: 0 }}>See how adding points to everyone would change the grade distribution. This is a preview only; nothing is saved.</p>
          <label>Add <b>{shift}</b> percentage points
            <input type="range" min={0} max={15} step={0.5} value={shift} onChange={(e) => setShift(Number(e.target.value))} />
          </label>
          {curve.map((c) => (
            <div key={c.letter} className="row" style={{ margin: '.3rem 0' }}>
              <b style={{ width: 24 }}>{c.letter}</b>
              <div style={{ flex: 1 }}>
                <div style={{ background: 'var(--line)', height: 10, width: `${(c.before / peak) * 100}%`, borderRadius: 3 }} />
                <div style={{ background: 'var(--brand-2)', height: 10, width: `${(c.after / peak) * 100}%`, borderRadius: 3, marginTop: 2 }} />
              </div>
              <span className="small" style={{ width: 70 }}>{c.before} → <b>{c.after}</b></span>
            </div>
          ))}
          <div className="muted small">Grey = now · blue = with the curve</div>
        </div>
      </div>
    </>
  );
}
