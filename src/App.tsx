/**
 * @fileoverview Application root — React Router v6 route configuration.
 * Three top-level routes: Host Dashboard, Attendee Join screen, and Attendee Live view.
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HostDashboard from './pages/HostDashboard';
import JoinSession from './pages/JoinSession';
import AttendeeDashboard from './pages/AttendeeDashboard';
import PresentQuiz from './pages/PresentQuiz';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Host: Create and manage sessions */}
        <Route path="/" element={<HostDashboard />} />

        {/* Attendee: Join entry screen (name + avatar) */}
        <Route path="/room/:roomCode" element={<JoinSession />} />

        {/* Attendee: Active session view */}
        <Route path="/room/:roomCode/live" element={<AttendeeDashboard />} />

        {/* Presenter: Public quiz display (projector screen) */}
        <Route path="/room/:roomCode/present" element={<PresentQuiz />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
