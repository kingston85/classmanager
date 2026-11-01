import { useRef } from 'react';
import { getState, mutate, replaceWorkspace } from '../store';
import { download, todayISO } from '../logic';
import { useWorkspace } from '../store';
import type { Workspace } from '../types';

export default function SettingsPage() {
  const w = useWorkspace();
  const fileRef = useRef<HTMLInputElement>(null);

  function backup() {
    download(`classmanager-backup-${todayISO()}.json`, JSON.stringify(getState(), null, 2), 'application/json');
  }

  async function restore(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text()) as Workspace;
      if (!Array.isArray(data.courses)) throw new Error('bad');
      if (!confirm(`Replace everything on this device with ${data.courses.length} course(s) from this backup?`)) return;
      replaceWorkspace(data);
    } catch {
      alert('That file is not a ClassManager backup.');
    }
    e.target.value = '';
  }

  return (
    <>
      <h1>Settings</h1>
      <div className="card">
        <h2>Lecturer</h2>
        <label style={{ maxWidth: 360 }}>Your name (shown on reports and share files)
          <input
            value={w.lecturerName}
            onChange={(e) => mutate((ws) => { ws.lecturerName = e.target.value; })}
            placeholder="Sahr Emmanuel"
          />
        </label>
      </div>
      <div className="card">
        <h2>Backup and restore</h2>
        <p className="muted">All data lives on this device. Export a backup regularly, and use it to move to another device.</p>
        <div className="row">
          <button className="primary" onClick={backup}>Download backup</button>
          <button onClick={() => fileRef.current?.click()}>Restore from backup…</button>
          <input ref={fileRef} type="file" accept=".json" hidden onChange={restore} />
        </div>
      </div>
      <div className="card">
        <h2>About</h2>
        <p className="muted">ClassManager works offline. Lecturers manage courses here; students open a personal, PIN-encrypted share file in the Student tab.</p>
      </div>
    </>
  );
}
