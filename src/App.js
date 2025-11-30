// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ArticleList from './components/ArticleList';
import ArticleDetail from './components/ArticleDetail';
import ArticleAdmin from './components/ArticleAdmin'; // 新增
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<ArticleList />} />
          <Route path="/article/:id" element={<ArticleDetail />} />
          <Route path="/admin" element={<ArticleAdmin />} /> {/* 新增管理后台路由 */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;