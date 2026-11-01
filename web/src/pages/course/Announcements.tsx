import { useState } from 'react';
import type { Course } from '../../types';
import { todayISO, uid } from '../../logic';
import { updateCourse } from '../../store';

export default function Announcements({ course }: { course: Course }) {
  const [f, setF] = useState({ title: '', body: '', pinned: false });
  const list = [...course.announcements].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.date.localeCompare(a.date));
  return (
    <>
      <div className="card">
        <h2>New announcement</h2>
        <div className="grid">
          <label>Title<input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
          <label>Message<textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></label>
          <label className="inline"><input type="checkbox" checked={f.pinned} onChange={(e) => setF({ ...f, pinned: e.target.checked })} /> Pin to the top</label>
          <div><button className="primary" disabled={!f.title.trim()} onClick={() => { updateCourse(course.id, (c) => { c.announcements.push({ id: uid(), title: f.title.trim(), body: f.body.trim(), date: todayISO(), pinned: f.pinned }); }); setF({ title: '', body: '', pinned: false }); }}>Post</button></div>
        </div>
        <p className="muted small">Students see announcements the next time you send them a fresh share file (Share with students tab).</p>
      </div>
      {list.map((a) => (
        <div className="card" key={a.id}>
          <div className="row between">
            <b>{a.pinned && '📌 '}{a.title} <span className="muted small">{a.date}</span></b>
            <div className="row">
              <button className="small" onClick={() => updateCourse(course.id, (c) => { const x = c.announcements.find((y) => y.id === a.id); if (x) x.pinned = !x.pinned; })}>{a.pinned ? 'Unpin' : 'Pin'}</button>
              <button className="small danger" onClick={() => updateCourse(course.id, (c) => { c.announcements = c.announcements.filter((y) => y.id !== a.id); })}>Delete</button>
            </div>
          </div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{a.body}</div>
        </div>
      ))}
    </>
  );
}
