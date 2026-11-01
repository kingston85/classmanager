import type { Course } from '../../types';
import { assessmentStats, round } from '../../logic';

export default function Analysis({ course }: { course: Course }) {
  const rows = course.assessments.map((a) => ({ a, s: assessmentStats(course, a) })).filter((x) => x.s);
  if (rows.length === 0) return <div className="card empty">Enter scores in the Gradebook to see item analysis.</div>;
  return (
    <div className="grid cols-2">
      {rows.map(({ a, s }) => {
        const st = s!;
        const peak = Math.max(...st.histogram, 1);
        return (
          <div className="card" key={a.id}>
            <h2>{a.name} <span className="muted small">/{a.max} · {a.weight}%</span></h2>
            <div className="row" style={{ gap: '1.2rem', marginBottom: '.8rem' }}>
              <div><div className="stat">{round((st.mean / a.max) * 100)}%</div><div className="stat-label">mean ({round(st.mean)})</div></div>
              <div><div className="stat">{round(st.median)}</div><div className="stat-label">median</div></div>
              <div><div className="stat">{st.high}/{st.low}</div><div className="stat-label">high / low</div></div>
              <div><div className="stat">{round(st.passRate, 0)}%</div><div className="stat-label">≥ 60% of max</div></div>
            </div>
            <div className="bars" style={{ marginTop: '1.2rem' }}>
              {st.histogram.map((n, i) => (
                <div key={i} style={{ height: `${(n / peak) * 100}%` }}>{n > 0 && <span>{n}</span>}</div>
              ))}
            </div>
            <div className="bar-labels">{st.histogram.map((_, i) => <span key={i}>{i * 10}</span>)}</div>
            <div className="muted small" style={{ marginTop: '.4rem' }}>{st.n} of {course.students.length} graded · std. dev. {round(st.sd, 2)} · histogram in 10% bands of the maximum</div>
          </div>
        );
      })}
    </div>
  );
}
