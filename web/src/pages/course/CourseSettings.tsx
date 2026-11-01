import { useNavigate } from 'react-router-dom';
import type { Course } from '../../types';
import { DAY_NAMES, DEFAULT_SCALE, generateSessions } from '../../logic';
import { mutate, updateCourse } from '../../store';

export default function CourseSettings({ course }: { course: Course }) {
  const nav = useNavigate();
  const set = <K extends keyof Course>(k: K, v: Course[K]) => updateCourse(course.id, (c) => { c[k] = v; });
  const text = (k: 'code' | 'title' | 'section' | 'semester' | 'room' | 'lecturer' | 'time' | 'startDate') => (
    <input key={course[k]} defaultValue={course[k]} onBlur={(e) => e.target.value !== course[k] && set(k, e.target.value as Course[typeof k])} />
  );
  const num = (k: 'credits' | 'weeks' | 'capacity' | 'attendanceWeight' | 'riskAttendance' | 'riskStanding') => (
    <input type="number" min="0" key={course[k]} defaultValue={course[k]} onBlur={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n >= 0 && n !== course[k]) set(k, n as Course[typeof k]); }} />
  );

  function regenerate() {
    if (!confirm('Replace all UNMARKED sessions with a fresh schedule? Sessions that already have attendance are kept.')) return;
    updateCourse(course.id, (c) => {
      const kept = c.sessions.filter((s) => Object.keys(s.records).length > 0);
      const keptDates = new Set(kept.map((s) => s.date));
      c.sessions = [...kept, ...generateSessions(c).filter((s) => !keptDates.has(s.date))];
    });
  }

  function setBand(i: number, key: 'min' | 'letter' | 'points', value: string) {
    updateCourse(course.id, (c) => {
      const b = c.scale[i];
      if (key === 'letter') b.letter = value.trim() || b.letter;
      else { const n = Number(value); if (Number.isFinite(n)) b[key] = n; }
    });
  }

  return (
    <>
      <div className="card">
        <h2>Course details</h2>
        <div className="form-grid">
          <label>Code{text('code')}</label>
          <label>Title{text('title')}</label>
          <label>Section{text('section')}</label>
          <label>Semester{text('semester')}</label>
          <label>Room{text('room')}</label>
          <label>Lecturer{text('lecturer')}</label>
          <label>Credit hours{num('credits')}</label>
          <label>Section cap{num('capacity')}</label>
        </div>
      </div>

      <div className="card">
        <h2>Schedule</h2>
        <div className="row" style={{ marginBottom: '.7rem' }}>
          {DAY_NAMES.map((d, i) => (
            <label key={d} className="inline">
              <input type="checkbox" checked={course.days.includes(i)} onChange={(e) => set('days', e.target.checked ? [...course.days, i].sort() : course.days.filter((x) => x !== i))} /> {d}
            </label>
          ))}
        </div>
        <div className="form-grid">
          <label>Class time<input type="time" key={course.time} defaultValue={course.time} onBlur={(e) => set('time', e.target.value)} /></label>
          <label>First class<input type="date" key={course.startDate} defaultValue={course.startDate} onBlur={(e) => set('startDate', e.target.value)} /></label>
          <label>Teaching weeks{num('weeks')}</label>
        </div>
        <div className="row" style={{ marginTop: '.7rem' }}>
          <button onClick={regenerate}>Regenerate unmarked sessions</button>
          <span className="muted small">{course.sessions.length} sessions currently</span>
        </div>
      </div>

      <div className="card">
        <h2>Grading and alerts</h2>
        <div className="form-grid">
          <label>Attendance counts for (% of grade, 0 = off){num('attendanceWeight')}</label>
          <label>Flag attendance below (%){num('riskAttendance')}</label>
          <label>Flag standing below (%){num('riskStanding')}</label>
        </div>
        <h3 style={{ marginTop: '1rem' }}>Grade scale</h3>
        <div className="table-wrap"><table style={{ maxWidth: 420 }}>
          <thead><tr><th>Minimum %</th><th>Letter</th><th>Points</th></tr></thead>
          <tbody>
            {course.scale.map((b, i) => (
              <tr key={i}>
                <td><input className="num" type="number" defaultValue={b.min} onBlur={(e) => setBand(i, 'min', e.target.value)} /></td>
                <td><input className="num" defaultValue={b.letter} onBlur={(e) => setBand(i, 'letter', e.target.value)} /></td>
                <td><input className="num" type="number" step="0.1" defaultValue={b.points} onBlur={(e) => setBand(i, 'points', e.target.value)} /></td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <div className="row" style={{ marginTop: '.6rem' }}>
          <button onClick={() => set('scale', DEFAULT_SCALE.map((b) => ({ ...b })))}>Reset to A/B/C/D/F (90/80/70/60)</button>
        </div>
      </div>

      <div className="card">
        <h2>Danger zone</h2>
        <button className="danger" onClick={() => {
          if (confirm(`Delete ${course.code} and all of its students, attendance and scores? This cannot be undone.`)) {
            mutate((w) => { w.courses = w.courses.filter((c) => c.id !== course.id); });
            nav('/');
          }
        }}>Delete this course</button>
      </div>
    </>
  );
}
