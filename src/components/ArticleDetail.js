// src/components/ArticleDetail.js
import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import './ArticleDetail.css';

function ArticleDetail() {
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const { id } = useParams(); // 获取URL中的文章ID

  // 加载文章详情
  useEffect(() => {
    async function fetchArticle() {
      try {
        console.log(`📖 正在加载文章详情，ID: ${id}`);
        const response = await fetch(`/api/articles/${id}`);
        const result = await response.json();
        
        if (result.success) {
          setArticle(result.data);
          console.log('✅ 成功加载文章详情');
        } else {
          console.error('❌ 加载文章详情失败:', result.error);
          setArticle(null);
        }
      } catch (error) {
        console.error('❌ 网络错误:', error);
        setArticle(null);
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchArticle();
    }
  }, [id]);

  // 显示加载中
  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>正在加载文章...</p>
      </div>
    );
  }

  // 显示文章不存在
  if (!article) {
    return (
      <div className="article-detail">
        <div className="not-found">
          <h2>文章不存在</h2>
          <p>抱歉，没有找到您要查看的文章。</p>
          <Link to="/" className="btn btn-primary">
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  // 显示文章详情
  return (
    <div className="article-detail">
      <header className="header">
        <Link to="/" className="back-link">
          ← 返回首页
        </Link>
        <h1>{article.title}</h1>
        <div className="article-meta">
          <time>
            发布时间: {new Date(article.created_at).toLocaleString()}
          </time>
          {article.updated_at !== article.created_at && (
            <span className="updated">
              最后更新: {new Date(article.updated_at).toLocaleString()}
            </span>
          )}
        </div>
      </header>

      <div className="article-content">
        <div className="content">
          {article.content.split('\n').map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </div>

      <footer className="footer">
        <Link to="/" className="btn btn-secondary">
          返回首页
        </Link>
      </footer>
    </div>
  );
}

export default ArticleDetail;