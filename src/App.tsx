import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Dashboard } from './Pages/Dashboard';
import { Planner } from './Pages/Planner';
import { RoomBuilder } from './Pages/RoomBuilder/RoomBuilder';
import { Login } from './Pages/Auth/Login';
import { Register } from './Pages/Auth/Register';
import { Profile } from './Pages/Profile';
import { AuthProvider } from './store/AuthContext';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/room-builder" element={<RoomBuilder />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
