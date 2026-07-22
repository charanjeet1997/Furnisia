import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Dashboard } from './Pages/Dashboard';
import { Planner } from './Pages/Planner';
import { RoomBuilder } from './Pages/RoomBuilder/RoomBuilder';
import { ThemeToggle } from './Components/UI/ThemeToggle';

function App() {
  return (
    <BrowserRouter>
      <ThemeToggle />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/room-builder" element={<RoomBuilder />} />
        <Route path="/planner" element={<Planner />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
