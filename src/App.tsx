import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Dashboard } from './Pages/Dashboard';
import { Planner } from './Pages/Planner';
import { RoomBuilder } from './Pages/RoomBuilder/RoomBuilder';
import { VRRoom } from './Pages/VRRoom';
import { Login } from './Pages/Auth/Login';
import { Register } from './Pages/Auth/Register';
import { Profile } from './Pages/Profile';
import { About } from './Pages/About';
import { AuthProvider } from './store/AuthContext';

import { AnalyticsTracker } from './Components/AnalyticsTracker';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AnalyticsTracker />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/about" element={<About />} />
          <Route path="/room-builder" element={<RoomBuilder />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/vr-room" element={<VRRoom />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
