import { useState } from 'react';
import type { Course } from '../../types';
import { buildShareBundle } from '../../share';
import { download, todayISO } from '../../logic';

export default function Share({ course }: { course: Course }) {
  const [busy, setBusy] = useState(false);

  async function publish() {
    setBusy(true);
    try {
      const bundle = await buildShareBundle(course);
      const name = `${course.code.replace(/\s+/g, '')}-S${course.section}-share-${todayISO()}.json`;
      download(name, JSON.stringify(bundle), 'application/json');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="card no-print">
        <h2>Student share file</h2>
        <ol>
          <li>Print the PIN slips below (or message each student their PIN privately).</li>
          <li>Download the share file and send it to the class (WhatsApp group, email, shared drive). It is safe to share widely: each student’s record is encrypted with their own PIN, so nobody can read anyone else’s grades.</li>
          <li>Students open <b>Student</b> in this app, load the file, and sign in with their student number and PIN.</li>
        </ol>
        <p className="muted small">The file is a snapshot. Send a fresh one after you enter new attendance or scores, or post an announcement.</p>
        <div className="row">
          <button className="primary" disabled={busy || course.students.length === 0} onClick={publish}>{busy ? 'Encrypting…' : 'Download share file'}</button>
          <button onClick={() => window.print()} disabled={course.students.length === 0}>Print PIN slips</button>
        </div>
      </div>
      <div className="card">
        <h2 className="no-print">PIN slips</h2>
        <div className="grid cols-3">
          {course.students.map((s) => (
            <div key={s.id} className="slip card" style={{ margin: 0 }}>
              <b>{course.code} §{course.section}</b>
              <div>{s.name}</div>
              <div className="small">Student no.: {s.studentNo}</div>
              <div>PIN: <span className="pin"><b>{s.pin}</b></span></div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
