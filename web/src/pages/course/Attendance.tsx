import { useEffect, useMemo, useState } from 'react';
import type { Course, Status } from '../../types';
import { attendanceStats, generateSessions, round, todayISO, uid } from '../../logic';
import { updateCourse } from '../../store';

const OPTS: Status[] = ['P', 'L', 'A', 'E'];

export default function Attendance({ course }: { course: Course }) {
  const sessions = useMemo(() => [...course.sessions].sort((a, b) => a.date.localeCompare(b.date)), [course.sessions]);
  const [sel, setSel] = useState<string>('');
  const [view, setView] = useState<'mark' | 'summary'>('mark');
  const [newDate, setNewDate] = useState(todayISO());

  useEffect(() => {
    if (sel && sessions.some((s) => s.id === sel)) return;
    const today = todayISO();
    const pick = sessions.find((s) => s.date >= today) ?? sessions[sessions.length - 1];
    setSel(pick?.id ?? '');
  }, [sessions, sel]);

  const session = sessions.find((s) => s.id === sel);

  function generate() {
    const existing = new Set(course.sessions.map((s) => s.date));
    const fresh = generateSessions(course).filter((s) => !existing.has(s.date));
    updateCourse(course.id, (c) => { c.sessions.push(...fresh); });
  }

  function addSession() {
    if (!newDate || course.sessions.some((s) => s.date === newDate)) { alert('A session already exists on that date.'); return; }
    const id = uid();
    updateCourse(course.id, (c) => { c.sessions.push({ id, date: newDate, topic: '', records: {} }); });
    setSel(id);
  }

  function setStatus(studentId: string, st: Status) {
    updateCourse(course.id, (c) => {
      const s = c.sessions.find((x) => x.id === sel);
      if (!s) return;
      if (s.records[studentId] === st) delete s.records[studentId];
      else s.records[studentId] = st;
    });
  }

  function markAll(st: Status) {
    updateCourse(course.id, (c) => {
      const s = c.sessions.find((x) => x.id === sel);
      if (s) c.students.forEach((stu) => { s.records[stu.id] = st; });
    });
  }

  function pct(sid: string) {
    const s = course.sessions.find((x) => x.id === sid)!;
    const marked = course.students.filter((st) => s.records[st.id]);
    if (!marked.length) return null;
    const pres = marked.filter((st) => s.records[st.id] === 'P' || s.records[st.id] === 'L').length;
    return (pres / marked.length) * 100;
  }

  if (course.students.length === 0) return <div className="card empty">Add students in the Roster tab first.</div>;

  return (
    <>
      <div className="row between" style={{ marginBottom: '1rem' }}>
        <div className="seg">
          <button className={view === 'mark' ? 'on P' : ''} onClick={() => setView('mark')}>Mark attendance</button>
          <button className={view === 'summary' ? 'on P' : ''} onClick={() => setView('summary')}>Summary</button>
        </div>
        <div className="row">
          <button onClick={generate}>Generate sessions from schedule</button>
          <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          <button onClick={addSession}>+ Add session</button>
        </div>
      </div>

      {view === 'summary' ? (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Student</th><th>Present</th><th>Late</th><th>Absent</th><th>Excused</th><th>Attendance</th></tr></thead>
            <tbody>
              {course.students.map((s) => {
                const a = attendanceStats(course, s.id);
                const low = a.pct !== null && a.pct < course.riskAttendance;
                return (
                  <tr key={s.id}>
                    <td>{s.name} <span className="muted small">{s.studentNo}</span></td>
                    <td>{a.present}</td><td>{a.late}</td><td>{a.absent}</td><td>{a.excused}</td>
                    <td><span className={`pill ${a.pct === null ? '' : low ? 'bad' : 'ok'}`}>{a.pct === null ? '–' : `${round(a.pct)}%`}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : sessions.length === 0 ? (
        <div className="card empty">
          <p>No class sessions yet.</p>
          <button className="primary" onClick={generate}>Generate sessions from the schedule</button>
        </div>
      ) : (
        <div className="split">
          <div style={{ maxHeight: 560, overflow: 'auto' }}>
            {sessions.map((s) => {
              const p = pct(s.id);
              return (
                <div key={s.id} className={`list-item ${s.id === sel ? 'sel' : ''}`} onClick={() => setSel(s.id)}>
                  <div className="row between"><b>{s.date}</b><span className={`pill ${p === null ? '' : p >= 75 ? 'ok' : 'warn'}`}>{p === null ? 'unmarked' : `${round(p, 0)}% here`}</span></div>
                  <div className="muted small">{s.topic || 'No topic'}</div>
                </div>
              );
            })}
          </div>
          {session && (
            <div className="card">
              <div className="row between">
                <h2 style={{ margin: 0 }}>{session.date}</h2>
                <button className="small danger" onClick={() => { if (confirm('Delete this session and its attendance marks?')) updateCourse(course.id, (c) => { c.sessions = c.sessions.filter((x) => x.id !== sel); }); }}>Delete session</button>
              </div>
              <label style={{ margin: '.6rem 0' }}>Topic covered
                <input key={session.id} defaultValue={session.topic} onBlur={(e) => updateCourse(course.id, (c) => { const s = c.sessions.find((x) => x.id === sel); if (s) s.topic = e.target.value; })} />
              </label>
              <div className="row" style={{ marginBottom: '.6rem' }}>
                <button onClick={() => markAll('P')}>Everyone present</button>
                <button onClick={() => updateCourse(course.id, (c) => { const s = c.sessions.find((x) => x.id === sel); if (s) s.records = {}; })}>Clear</button>
                <span className="muted small">P = present · L = late (counts half) · A = absent · E = excused (not counted)</span>
              </div>
              <div className="table-wrap"><table>
                <tbody>
                  {course.students.map((s, i) => (
                    <tr key={s.id}>
                      <td className="muted">{i + 1}</td>
                      <td>{s.name} <span className="muted small">{s.studentNo}</span></td>
                      <td className="right">
                        <div className="seg">
                          {OPTS.map((o) => (
                            <button key={o} className={session.records[s.id] === o ? `on ${o}` : ''} onClick={() => setStatus(s.id, o)}>{o}</button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
