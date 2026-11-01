import { NavLink, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import CoursePage from './pages/CoursePage';
import StudentPortal from './pages/StudentPortal';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <>
      <header className="topbar">
        <NavLink to="/" className="brand">📚 ClassManager</NavLink>
        <nav>
          <NavLink to="/" end>Lecturer</NavLink>
          <NavLink to="/student">Student</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/course/:id/*" element={<CoursePage />} />
          <Route path="/student" element={<StudentPortal />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </main>
    </>
  );
}
