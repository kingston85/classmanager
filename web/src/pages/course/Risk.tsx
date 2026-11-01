import type { Course } from '../../types';
import { atRisk, round } from '../../logic';

export default function Risk({ course }: { course: Course }) {
  const list = atRisk(course);
  return (
    <div className="card">
      <h2>Students needing attention</h2>
      <p className="muted small">Flagged when attendance is below {course.riskAttendance}%, standing is below {course.riskStanding}%, or a graded assessment has no score. Change the thresholds in Course settings.</p>
      {list.length === 0 ? <div className="empty">🎉 Nobody is flagged right now.</div> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Student</th><th>Attendance</th><th>Standing</th><th>Why</th><th>Contact</th></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.student.id}>
                <td><b>{r.student.name}</b> <span className="muted small">{r.student.studentNo}</span></td>
                <td>{r.attendancePct === null ? '–' : `${round(r.attendancePct, 0)}%`}</td>
                <td>{r.standing === null ? '–' : `${round(r.standing, 0)}%`}</td>
                <td style={{ whiteSpace: 'normal' }}>{r.reasons.map((x, i) => <div key={i}>• {x}</div>)}</td>
                <td>
                  {r.student.email && <a href={`mailto:${r.student.email}?subject=${encodeURIComponent(`${course.code}: checking in`)}`}>Email</a>}
                  {r.student.email && r.student.phone && ' · '}
                  {r.student.phone && <a href={`tel:${r.student.phone}`}>Call</a>}
                  {!r.student.email && !r.student.phone && <span className="muted">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}
