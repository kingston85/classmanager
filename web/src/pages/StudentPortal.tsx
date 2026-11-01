import { useEffect, useState } from 'react';
import type { ShareBundle, StudentView } from '../types';
import { isShareBundle, openEntry } from '../share';
import { round, statusLabel } from '../logic';

const KEY = 'classmanager.student.bundle.v1';

export default function StudentPortal() {
  const [bundle, setBundle] = useState<ShareBundle | null>(null);
  const [studentNo, setStudentNo] = useState('');
  const [pin, setPin] = useState('');
  const [view, setView] = useState<StudentView | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const b = JSON.parse(raw);
        if (isShareBundle(b)) setBundle(b);
      }
      setStudentNo(localStorage.getItem(KEY + '.no') ?? '');
    } catch { /* ignore */ }
  }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const b = JSON.parse(await f.text());
      if (!isShareBundle(b)) throw new Error('bad');
      setBundle(b);
      setView(null);
      setErr('');
      localStorage.setItem(KEY, JSON.stringify(b));
    } catch {
      setErr('That file is not a ClassManager share file.');
    }
    e.target.value = '';
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (!bundle) return;
    setBusy(true);
    setErr('');
    const v = await openEntry(bundle, studentNo, pin);
    setBusy(false);
    if (!v) { setErr('Student number or PIN not recognised for this class.'); return; }
    localStorage.setItem(KEY + '.no', studentNo);
    setView(v);
    setPin('');
  }

  function forget() {
    localStorage.removeItem(KEY);
    setBundle(null);
    setView(null);
  }

  return (
    <>
      <h1>Student portal</h1>
      <p className="muted">View your attendance, scores and class announcements. Your lecturer sends you a share file and a personal PIN; everything is stored and decrypted on this device only.</p>

      {!bundle && (
        <div className="card">
          <h2>1. Load your class file</h2>
          <input type="file" accept=".json,application/json" onChange={onFile} />
          {err && <p className="error">{err}</p>}
        </div>
      )}

      {bundle && !view && (
        <div className="card" style={{ maxWidth: 480 }}>
          <h2>{bundle.course.code} — {bundle.course.title}</h2>
          <div className="muted small">Section {bundle.course.section} · {bundle.course.lecturer} · updated {new Date(bundle.publishedAt).toLocaleDateString()}</div>
          <form onSubmit={login} className="grid" style={{ marginTop: '1rem' }}>
            <label>Student number<input value={studentNo} onChange={(e) => setStudentNo(e.target.value)} autoComplete="username" required /></label>
            <label>PIN<input value={pin} onChange={(e) => setPin(e.target.value)} type="password" inputMode="numeric" autoComplete="current-password" required /></label>
            {err && <div className="error">{err}</div>}
            <div className="row">
              <button className="primary" disabled={busy}>{busy ? 'Opening…' : 'Open my record'}</button>
              <label className="inline"><span className="btn" style={{ cursor: 'pointer' }}>Load newer file<input type="file" accept=".json" onChange={onFile} hidden /></span></label>
              <button type="button" onClick={forget}>Remove class</button>
            </div>
          </form>
          <Announcements b={bundle} />
        </div>
      )}

      {bundle && view && (
        <>
          <div className="row between">
            <div>
              <h2 style={{ margin: 0 }}>{view.name} <span className="muted small">#{view.studentNo}</span></h2>
              <div className="muted small">{bundle.course.code} — {bundle.course.title} · Section {bundle.course.section}</div>
            </div>
            <button onClick={() => setView(null)}>Lock</button>
          </div>
          <div className="grid cols-3" style={{ margin: '1rem 0' }}>
            <div className="card"><div className="stat">{view.standing === null ? '–' : `${round(view.standing)}%`}</div><div className="stat-label">Current standing ({view.letter})</div></div>
            <div className="card"><div className="stat">{view.projected === null ? '–' : `${round(view.projected)}%`}</div><div className="stat-label">Of total course so far</div></div>
            <div className="card"><div className="stat">{view.attendancePct === null ? '–' : `${round(view.attendancePct)}%`}</div><div className="stat-label">Attendance</div></div>
            <div className="card"><div className="stat">{view.rank ? `${view.rank}/${view.classSize}` : '–'}</div><div className="stat-label">Class rank</div></div>
          </div>

          <div className="card">
            <h2>Assessments</h2>
            <div className="table-wrap"><table>
              <thead><tr><th>Assessment</th><th>Type</th><th>Weight</th><th>Score</th><th>%</th></tr></thead>
              <tbody>
                {view.assessments.map((a, i) => (
                  <tr key={i}>
                    <td>{a.name}</td><td>{a.category}</td><td>{a.weight}%</td>
                    <td>{a.score === null ? <span className="muted">not graded</span> : `${a.score} / ${a.max}`}</td>
                    <td>{a.score === null || !a.max ? '' : `${round((a.score / a.max) * 100)}%`}</td>
                  </tr>
                ))}
                {view.assessments.length === 0 && <tr><td colSpan={5} className="muted">No assessments yet.</td></tr>}
              </tbody>
            </table></div>
          </div>

          <div className="card">
            <h2>Attendance record</h2>
            <div className="table-wrap" style={{ maxHeight: 360, overflow: 'auto' }}><table>
              <thead><tr><th>Date</th><th>Topic</th><th>Status</th></tr></thead>
              <tbody>
                {view.attendance.map((a, i) => (
                  <tr key={i}>
                    <td>{a.date}</td><td>{a.topic}</td>
                    <td><span className={`pill ${a.status === 'P' ? 'ok' : a.status === 'A' ? 'bad' : a.status === 'L' ? 'warn' : ''}`}>{statusLabel(a.status || undefined)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
          <Announcements b={bundle} />
        </>
      )}
    </>
  );
}

function Announcements({ b }: { b: ShareBundle }) {
  if (!b.announcements.length) return null;
  return (
    <div style={{ marginTop: '1rem' }}>
      <h2>Announcements</h2>
      {b.announcements.map((a) => (
        <div key={a.id} className="notice">
          <b>{a.pinned && '📌 '}{a.title}</b> <span className="muted small">{a.date}</span>
          <div style={{ whiteSpace: 'pre-wrap' }}>{a.body}</div>
        </div>
      ))}
    </div>
  );
}
