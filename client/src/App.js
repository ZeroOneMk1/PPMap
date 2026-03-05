import './App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './Components/Login/Login';
import Dashboard from './Components/Dashboard/Dashboard';
import EditAccount from './Components/EditAccount/EditAccount'; // Import here
import JoinRelationship from './Components/JoinRelationship/JoinRelationship';

function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <h1> PPMap </h1>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/edit-account" element={<EditAccount />} />
          <Route path="/join-relationship/:uuid" element={<JoinRelationship />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;