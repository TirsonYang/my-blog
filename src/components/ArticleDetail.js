import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSSRData } from '../SSRContext';
import axios from 'axios';
import './ArticleDetail.css';
import {marked} from 'marked';

function ArticleDetail() {
  const ssrData = useSSRData();
  const { id } = useParams();
  
  const initialArticle = (ssrData && ssrData.article && String(ssrData.article.id) === String(id)) 
    ? ssrData.article 
    : null;

  const [article, setArticle] = useState(initialArticle);
  const [loading, setLoading] = useState(initialArticle ? false : true);
  
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
        isFirstRender.current = false;
        if (article) {
            return;
        }
    }

    async function fetchArticle() {
      try {
        setLoading(true);
        console.log(`正在加载文章详情，ID: ${id}`);
        const response = await fetch(`/api/articles/${id}`);
        const result = await response.json();
        
        if (result.success) {
          setArticle(result.data);
          console.log('成功加载文章详情');
        } else {
          console.error('加载文章详情失败:', result.error);
          setArticle(null);
        }
      } catch (error) {
        console.error('网络错误:', error);
        setArticle(null);
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchArticle();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>正在加载文章...</p>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="article-detail">
        <div className="not-found">
          <h2>文章不存在</h2>
          <p>没有找到文章。</p>
          <Link to="/" className="btn btn-primary">
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  const sanitizeHtml = (html) => {
    if (typeof document === 'undefined') {
      // Simple server-side escaping
      return html
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  };

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
          {/* 使用markdown */}
          {article.content_markdown ? (
          <div 
            className="markdown-body"
            dangerouslySetInnerHTML={{ 
              __html: marked(sanitizeHtml(article.content_markdown)) 
            }} 
          />
        ) : article.content ? (
          <div>
            {article.content.split('\n').map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        ) : (
          <p className="no-content">错误</p>
        )}
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

ArticleDetail.loadData = async (match) => {
    const { id } = match.params;
    const response = await axios.get(`http://localhost:3000/api/articles/${id}`);
    return { article: response.data.data };
};

export default ArticleDetail;