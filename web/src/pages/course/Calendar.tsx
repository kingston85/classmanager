import type { Course } from '../../types';
import { DAY_NAMES, parseISO, todayISO, weekStart } from '../../logic';

export default function Calendar({ course }: { course: Course }) {
  if (course.sessions.length === 0 && course.assessments.every((a) => !a.date)) {
    return <div className="card empty">Generate sessions from the schedule (Attendance tab) to see the course calendar.</div>;
  }
  const today = todayISO();
  const weeks = new Map<string, { sessions: typeof course.sessions; assessments: typeof course.assessments }>();
  const slot = (d: string) => {
    const k = weekStart(d);
    if (!weeks.has(k)) weeks.set(k, { sessions: [], assessments: [] });
    return weeks.get(k)!;
  };
  course.sessions.forEach((s) => slot(s.date).sessions.push(s));
  course.assessments.filter((a) => a.date).forEach((a) => slot(a.date as string).assessments.push(a));
  const keys = [...weeks.keys()].sort();
  const thisWeek = weekStart(today);

  return (
    <div className="grid">
      {keys.map((k, i) => {
        const w = weeks.get(k)!;
        const current = k === thisWeek;
        return (
          <div key={k} className="card" style={{ margin: 0, borderColor: current ? 'var(--brand)' : undefined, borderWidth: current ? 2 : 1 }}>
            <div className="row between">
              <h3 style={{ margin: 0 }}>Week {i + 1} <span className="muted small">from {k}</span></h3>
              {current && <span className="pill ok">this week</span>}
            </div>
            {w.sessions.sort((a, b) => a.date.localeCompare(b.date)).map((s) => {
              const marked = Object.keys(s.records).length > 0;
              return (
                <div key={s.id} className="row" style={{ padding: '.2rem 0' }}>
                  <b style={{ width: 90 }}>{DAY_NAMES[parseISO(s.date).getDay()]} {s.date.slice(5)}</b>
                  <span style={{ flex: 1 }}>{s.topic || <span className="muted">No topic yet</span>}</span>
                  <span className={`pill ${marked ? 'ok' : s.date < today ? 'warn' : ''}`}>{marked ? 'attendance taken' : s.date < today ? 'not marked' : course.time}</span>
                </div>
              );
            })}
            {w.assessments.map((a) => (
              <div key={a.id} className="row" style={{ padding: '.2rem 0' }}>
                <b style={{ width: 90 }}>{a.date?.slice(5)}</b>
                <span style={{ flex: 1 }}>📝 {a.name} <span className="muted small">({a.weight}%)</span></span>
                <span className="pill bad">due</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
