import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Dashboard } from './Pages/Dashboard';
import { Planner } from './Pages/Planner';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/planner" element={<Planner />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
