import { useState } from 'react';
import type { Course } from '../../types';
import { genPin, parseRoster, uid } from '../../logic';
import { updateCourse } from '../../store';

export default function Roster({ course }: { course: Course }) {
  const [paste, setPaste] = useState('');
  const [msg, setMsg] = useState('');
  const [q, setQ] = useState('');
  const [one, setOne] = useState({ studentNo: '', name: '', email: '' });

  function addMany(rows: { studentNo: string; name: string; email?: string; phone?: string }[]) {
    let added = 0, skipped = 0;
    updateCourse(course.id, (c) => {
      for (const r of rows) {
        if (c.students.some((s) => s.studentNo.toLowerCase() === r.studentNo.toLowerCase())) { skipped++; continue; }
        c.students.push({ id: uid(), studentNo: r.studentNo, name: r.name, email: r.email, phone: r.phone, pin: genPin() });
        added++;
      }
      c.students.sort((a, b) => a.name.localeCompare(b.name));
    });
    setMsg(`Added ${added} student${added === 1 ? '' : 's'}${skipped ? `, skipped ${skipped} duplicate student number${skipped === 1 ? '' : 's'}` : ''}.`);
  }

  function edit(id: string, key: 'studentNo' | 'name' | 'email' | 'phone', value: string) {
    updateCourse(course.id, (c) => {
      const s = c.students.find((x) => x.id === id);
      if (s) (s as unknown as Record<string, string>)[key] = value;
    });
  }

  function remove(id: string, name: string) {
    if (!confirm(`Remove ${name}? Their attendance and scores for this course will be deleted.`)) return;
    updateCourse(course.id, (c) => {
      c.students = c.students.filter((s) => s.id !== id);
      c.sessions.forEach((s) => delete s.records[id]);
      Object.values(c.scores).forEach((row) => delete row[id]);
    });
  }

  const shown = course.students.filter((s) => (s.name + s.studentNo).toLowerCase().includes(q.toLowerCase()));
  const over = course.students.length > course.capacity;

  return (
    <>
      <div className="grid cols-2">
        <div className="card">
          <h2>Add one student</h2>
          <div className="form-grid">
            <label>Student no.<input value={one.studentNo} onChange={(e) => setOne({ ...one, studentNo: e.target.value })} /></label>
            <label>Full name<input value={one.name} onChange={(e) => setOne({ ...one, name: e.target.value })} /></label>
            <label>Email (optional)<input value={one.email} onChange={(e) => setOne({ ...one, email: e.target.value })} /></label>
          </div>
          <button className="primary" style={{ marginTop: '.7rem' }} disabled={!one.studentNo.trim() || !one.name.trim()}
            onClick={() => { addMany([{ studentNo: one.studentNo.trim(), name: one.name.trim(), email: one.email.trim() || undefined }]); setOne({ studentNo: '', name: '', email: '' }); }}>
            Add
          </button>
        </div>
        <div className="card">
          <h2>Paste a roster</h2>
          <p className="muted small" style={{ marginTop: 0 }}>One student per line: <code>student no, name, email, phone</code>. Copy straight from the faculty portal or a spreadsheet; commas and tabs both work.</p>
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'1001, Ama Doe, ama@example.com\n1002, Kofi Mensah'} />
          <div className="row" style={{ marginTop: '.5rem' }}>
            <button className="primary" disabled={!paste.trim()} onClick={() => { addMany(parseRoster(paste)); setPaste(''); }}>Import</button>
          </div>
        </div>
      </div>
      {msg && <div className="notice">{msg}</div>}
      {over && <div className="notice">Enrollment ({course.students.length}) is above the section cap of {course.capacity}.</div>}

      <div className="card">
        <div className="row between" style={{ marginBottom: '.6rem' }}>
          <h2 style={{ margin: 0 }}>Students ({course.students.length})</h2>
          <div className="row">
            <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
            <button onClick={() => { if (confirm('Generate new PINs for every student? Share files you already sent will stop opening.')) updateCourse(course.id, (c) => c.students.forEach((s) => { s.pin = genPin(); })); }}>Reset all PINs</button>
          </div>
        </div>
        {course.students.length === 0 ? <div className="empty">No students yet.</div> : (
          <div className="table-wrap"><table>
            <thead><tr><th>#</th><th>Student no.</th><th>Name</th><th>Email</th><th>Phone</th><th>PIN</th><th /></tr></thead>
            <tbody>
              {shown.map((s, i) => (
                <tr key={s.id}>
                  <td className="muted">{i + 1}</td>
                  <td><input defaultValue={s.studentNo} onBlur={(e) => e.target.value.trim() && edit(s.id, 'studentNo', e.target.value.trim())} /></td>
                  <td><input defaultValue={s.name} onBlur={(e) => e.target.value.trim() && edit(s.id, 'name', e.target.value.trim())} /></td>
                  <td><input defaultValue={s.email ?? ''} onBlur={(e) => edit(s.id, 'email', e.target.value.trim())} /></td>
                  <td><input defaultValue={s.phone ?? ''} onBlur={(e) => edit(s.id, 'phone', e.target.value.trim())} /></td>
                  <td className="pin">{s.pin}</td>
                  <td><button className="small danger" onClick={() => remove(s.id, s.name)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </>
  );
}
