import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage";
import S7 from './components/s7/S7';
import Header from '../src/components/Header';

const App = () => {
  return (
      <Router>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/s7" element={<S7 />} />
          </Routes>
      </Router>
  );
};

export default App;
