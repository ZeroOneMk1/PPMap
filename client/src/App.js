import './App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './Components/Login/Login';
import Dashboard from './Components/Dashboard';
import JoinRelationship from './Components/JoinRelationship';

function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <h1> PPMap </h1>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/join-relationship/:uuid" element={<JoinRelationship />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
