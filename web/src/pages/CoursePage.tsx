import { NavLink, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useCourse } from '../store';
import Overview from './course/Overview';
import Roster from './course/Roster';
import Attendance from './course/Attendance';
import Gradebook from './course/Gradebook';
import Analysis from './course/Analysis';
import Risk from './course/Risk';
import Announcements from './course/Announcements';
import Share from './course/Share';
import Reports from './course/Reports';
import CourseSettings from './course/CourseSettings';

const TABS: [string, string][] = [
  ['', 'Overview'], ['roster', 'Roster'], ['attendance', 'Attendance'], ['gradebook', 'Gradebook'],
  ['analysis', 'Analysis'], ['risk', 'At-risk'], ['announcements', 'Announcements'],
  ['share', 'Share with students'], ['reports', 'Reports'], ['settings', 'Course settings'],
];

export default function CoursePage() {
  const { id } = useParams();
  const course = useCourse(id);
  if (!course) return <Navigate to="/" replace />;
  return (
    <>
      <div className="no-print">
        <h1>{course.code} <span className="muted small">§{course.section}</span> — {course.title || 'Untitled course'}</h1>
        <div className="muted">{course.semester}</div>
        <div className="tabs">
          {TABS.map(([path, label]) => (
            <NavLink key={path} to={`/course/${course.id}${path ? '/' + path : ''}`} end className={({ isActive }) => (isActive ? 'active' : '')}>
              {label}
            </NavLink>
          ))}
        </div>
      </div>
      <Routes>
        <Route index element={<Overview course={course} />} />
        <Route path="roster" element={<Roster course={course} />} />
        <Route path="attendance" element={<Attendance course={course} />} />
        <Route path="gradebook" element={<Gradebook course={course} />} />
        <Route path="analysis" element={<Analysis course={course} />} />
        <Route path="risk" element={<Risk course={course} />} />
        <Route path="announcements" element={<Announcements course={course} />} />
        <Route path="share" element={<Share course={course} />} />
        <Route path="reports" element={<Reports course={course} />} />
        <Route path="settings" element={<CourseSettings course={course} />} />
      </Routes>
    </>
  );
}
