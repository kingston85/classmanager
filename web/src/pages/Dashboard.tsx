import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { mutate, useWorkspace } from '../store';
import { atRisk, blankCourse, DAY_NAMES, demoCourse, todayISO } from '../logic';

export default function Dashboard() {
  const w = useWorkspace();
  const nav = useNavigate();
  const [adding, setAdding] = useState(false);
  const today = new Date().getDay();
  const todays = w.courses.filter((c) => c.days.includes(today));

  function create(form: { code: string; title: string; section: string; semester: string }) {
    const c = blankCourse(w.lecturerName);
    Object.assign(c, form);
    mutate((ws) => { ws.courses.push(c); });
    setAdding(false);
    nav(`/course/${c.id}/settings`);
  }

  function loadDemo() {
    const c = demoCourse(w.lecturerName);
    mutate((ws) => { ws.courses.push(c); });
    nav(`/course/${c.id}`);
  }

  return (
    <>
      <div className="row between">
        <div>
          <h1>{w.lecturerName ? `Welcome, ${w.lecturerName}` : 'Your classes'}</h1>
          <div className="muted">{new Date().toDateString()}</div>
        </div>
        <button className="primary" onClick={() => setAdding(true)}>+ New course</button>
      </div>

      {!w.lecturerName && (
        <div className="notice" style={{ marginTop: '1rem' }}>
          Set your name in <Link to="/settings">Settings</Link> so it appears on reports and student share files.
        </div>
      )}

      {adding && <NewCourse onCancel={() => setAdding(false)} onCreate={create} />}

      {todays.length > 0 && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h2>Today’s classes</h2>
          {todays.map((c) => (
            <div key={c.id} className="row between" style={{ padding: '.3rem 0' }}>
              <span><b>{c.code}</b> {c.title} · {c.time} {c.room && `· ${c.room}`}</span>
              <Link to={`/course/${c.id}/attendance`}>Take attendance →</Link>
            </div>
          ))}
        </div>
      )}

      {w.courses.length === 0 && !adding ? (
        <div className="card empty">
          <h2>No courses yet</h2>
          <p>Create your first course, then paste in your class roster.</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="primary" onClick={() => setAdding(true)}>Create a course</button>
            <button onClick={loadDemo}>Try a sample class</button>
          </div>
        </div>
      ) : (
        <div className="grid cols-2" style={{ marginTop: '1rem' }}>
          {w.courses.map((c) => {
            const risk = atRisk(c).length;
            const graded = c.assessments.length;
            return (
              <Link key={c.id} to={`/course/${c.id}`} style={{ color: 'inherit' }}>
                <div className="card" style={{ height: '100%' }}>
                  <div className="row between">
                    <h2 style={{ margin: 0 }}>{c.code || 'Untitled'} <span className="muted small">§{c.section}</span></h2>
                    {risk > 0 && <span className="pill bad">{risk} at risk</span>}
                  </div>
                  <div>{c.title}</div>
                  <div className="muted small">
                    {c.days.map((d) => DAY_NAMES[d]).join('/')} {c.time} {c.room && `· ${c.room}`} · {c.semester}
                  </div>
                  <div className="row" style={{ marginTop: '.8rem', gap: '1.5rem' }}>
                    <div><div className="stat">{c.students.length}</div><div className="stat-label">students</div></div>
                    <div><div className="stat">{c.sessions.filter((s) => s.date <= todayISO()).length}</div><div className="stat-label">sessions held</div></div>
                    <div><div className="stat">{graded}</div><div className="stat-label">assessments</div></div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

function NewCourse(p: { onCancel: () => void; onCreate: (f: { code: string; title: string; section: string; semester: string }) => void }) {
  const [f, setF] = useState({ code: '', title: '', section: '1', semester: '' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="card" style={{ marginTop: '1rem' }}>
      <h2>New course</h2>
      <div className="form-grid">
        <label>Course code<input value={f.code} onChange={set('code')} placeholder="ESEM 303" autoFocus /></label>
        <label>Title<input value={f.title} onChange={set('title')} placeholder="Environmental Monitoring" /></label>
        <label>Section<input value={f.section} onChange={set('section')} /></label>
        <label>Semester<input value={f.semester} onChange={set('semester')} placeholder="Semester I 2026/2027" /></label>
      </div>
      <div className="row" style={{ marginTop: '.8rem' }}>
        <button className="primary" disabled={!f.code.trim()} onClick={() => p.onCreate(f)}>Create</button>
        <button onClick={p.onCancel}>Cancel</button>
      </div>
    </div>
  );
}
