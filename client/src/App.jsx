import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import Whiteboard from './components/Whiteboard';
import JoinRoom from './components/JoinRoom';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/room/:roomId" element={<Whiteboard />} />
        <Route path="/join/:roomId" element={<JoinRoom />} />
      </Routes>
    </Router>
  );
}

export default App;
