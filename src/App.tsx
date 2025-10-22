import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import CreateCharacter from './page/CreateCharacter';
import Main from './page/Main';
import Home from './page/Home';

function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Home />} />
        <Route path="/createCharacter" element={<CreateCharacter />} />
        <Route path="/main" element={<Main />} />
      </Routes>
  </BrowserRouter>
  )
}

export default App
