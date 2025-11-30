// src/components/ArticleList.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './ArticleList.css';

function ArticleList() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);


  // 加载文章列表
  useEffect(() => {
    async function fetchArticles() {
      try {
        console.log('📚 正在加载文章列表...');
        const response = await fetch('/api/articles');
        const result = await response.json();
        
        if (result.success) {
          setArticles(result.data);
          console.log(`✅ 成功加载 ${result.data.length} 篇文章`);
        } else {
          console.error('❌ 加载文章列表失败:', result.error);
        }
      } catch (error) {
        console.error('❌ 网络错误:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchArticles();
  }, [refreshKey]);

  const refreshArticles = () => {
    setRefreshKey(prev => prev + 1);
  };

  // 显示加载中
  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>正在加载文章...</p>
      </div>
    );
  }

  // 显示文章列表
  return (
    <div className="article-list">
      <header className="header">
        <h1>📝 我的博客</h1>
        <p>欢迎阅读我的文章</p>
        <div className="admin-link">
            <a href="/admin" className="btn btn-admin">管理文章</a>
            <button onClick={refreshArticles} className="btn btn-refresh">
                🔄 刷新
            </button>
        </div>
      </header>

      <div className="articles-container">
        {articles.length === 0 ? (
          <div className="empty-state">
            <h3>还没有文章</h3>
            <p>快去创建第一篇文章吧！</p>
          </div>
        ) : (
          articles.map(article => (
            <article key={article.id} className="article-card">
              <h2>
                <Link to={`/article/${article.id}`}>
                  {article.title}
                </Link>
              </h2>
              <div className="article-meta">
                <time>
                  发布时间: {new Date(article.created_at).toLocaleDateString()}
                </time>
              </div>
              <div className="article-actions">
                <Link 
                  to={`/article/${article.id}`} 
                  className="btn btn-primary"
                >
                  阅读全文
                </Link>
              </div>
            </article>
          ))
        )}
      </div>

      <footer className="footer">
        <p>© 2024 我的博客 - 使用 React + Express 构建</p>
      </footer>
    </div>
  );
}

export default ArticleList;