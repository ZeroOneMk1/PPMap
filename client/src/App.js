import './App.css';
import './common.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './Components/Login/Login';
import Dashboard from './Components/Dashboard/Dashboard';
import JoinRelationship from './Components/JoinRelationship/JoinRelationship';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/join-relationship/:uuid" element={<JoinRelationship />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
