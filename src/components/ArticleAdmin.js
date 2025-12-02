// src/components/ArticleAdmin.js
import React, { useState, useEffect } from 'react';
import './ArticleAdmin.css';
import MDEditor from '@uiw/react-md-editor';


function ArticleAdmin() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ title: '', content: '',markdown: '' });
  const [editingId, setEditingId] = useState(null);
  const [aiSuggestion, setAiSuggestion] = useState('');

  // 加载文章列表
  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/articles');
      const result = await response.json();
      if (result.success) {
        setArticles(result.data);
      }
    } catch (error) {
      console.error('加载文章失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // AI 写作助手（简化版）
  const generateAIContent = async () => {
    if (!formData.title.trim()) {
    alert('请先输入标题');
    return;
  }

  try {
    setAiSuggestion('🤖 AI正在思考中，请稍候...');
    
    const response = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: formData.title,
        keywords: '' // 可以留空，或者添加关键词输入
      }),
    });

    const result = await response.json();
    
    if (result.success) {
      let suggestionText = `AI建议: ${result.data.content}`;
      
      // 显示使用的服务
      if (result.data.service === 'fallback') {
        suggestionText += ' (备用方案)';
      } else if (result.data.service === 'baidu-ernie') {
        suggestionText += ' (百度文心一言)';
      }
      
      if (result.data.note) {
        suggestionText += ` - ${result.data.note}`;
      }
      
      setAiSuggestion(suggestionText);
      
      // 自动填充到内容框
      setFormData(prev => ({
        ...prev,
        content: result.data.content
      }));
      
    } else {
      throw new Error(result.error || 'AI生成失败');
    }
  } catch (error) {
    console.error('AI生成失败:', error);
    setAiSuggestion('❌ AI服务暂时不可用，请手动输入内容或稍后重试');
  }
  };

  // 创建或更新文章
  const saveArticle = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.markdown.trim()) {
      alert('标题和Markdown内容不能为空');
      return;
    }

    try {
      const url = editingId ? `/api/articles/${editingId}` : '/api/articles';
      const method = editingId ? 'PUT' : 'POST';

      const articleData = {
        title: formData.title,
        content: formData.content,
        markdown: formData.markdown
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(articleData),
      });

      const result = await response.json();
      
      if (result.success) {
        alert(editingId ? '文章更新成功！' : '文章创建成功！');
        setFormData({ title: '', content: '' });
        setEditingId(null);
        setAiSuggestion('');
        await fetchArticles(); // 刷新列表
      } else {
        alert('操作失败: ' + result.error);
      }
    } catch (error) {
      console.error('保存文章失败:', error);
      alert('网络错误，请重试');
    }
  };

  // 编辑文章
  const editArticle = async (article) => {
    // 从数据库重新获取完整文章内容
    try {
      const response = await fetch(`/api/articles/${article.id}`);
      const result = await response.json();
      
      if (result.success) {
        setFormData({
          title: result.data.title,
          content: result.data.content,
          markdown: result.data.content_markdown
        });
        setEditingId(article.id);
        setAiSuggestion('');
      }
    } catch (error) {
      console.error('获取文章详情失败:', error);
    }
  };



  // 删除文章 - 修复了 confirm 问题
  const deleteArticle = async (id) => {
    const userConfirmed = window.confirm('确定要删除这篇文章吗？');
    if (!userConfirmed) return;

    try {
      const response = await fetch(`/api/articles/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      
      if (result.success) {
        alert('文章删除成功！');
        await fetchArticles(); // 刷新列表
      } else {
        alert('删除失败: ' + result.error);
      }
    } catch (error) {
      console.error('删除文章失败:', error);
      alert('网络错误，请重试');
    }
  };

  return (
    <div className="article-admin">
      <header className="admin-header">
        <h1>📝 文章管理后台</h1>
        <p>在这里管理你的博客文章</p>
      </header>

      <div className="admin-layout">
        {/* 文章表单 */}
        <div className="form-section">
          <h2>{editingId ? '编辑文章' : '创建新文章'}</h2>
          
          <form onSubmit={saveArticle} className="article-form">
            <div className="form-group">
              <label>标题:</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="输入文章标题"
              />
            </div>

            <div className="form-group" data-color-mode="light">
              <label>博客内容（支持Markdown语法）:</label>
              {/* 这就是我们的新“魔法写字板” */}
              <MDEditor
                value={formData.markdown} // 它显示和编辑的是markdown源码
                onChange={(value) => {
                  setFormData({...formData, markdown: value});
                }}
                height={400} // 写字板的高度
                preview="live" // 模式：实时预览
              />
              {/* 下面是一行小提示 */}
              <p style={{fontSize: '12px', color: '#666', marginTop: '5px'}}>
                提示：在左边用 # 创建标题，用 ** 加粗文字，回车即可看到效果。
              </p>
          </div>

            {/* AI 写作助手 */}
            <div className="ai-assistant">
              <button type="button" onClick={generateAIContent} className="ai-btn">
                🤖 AI 写作助手
              </button>
              {aiSuggestion && (
                <div className="ai-suggestion">
                  <p><strong>AI 建议:</strong> {aiSuggestion}</p>
                </div>
              )}
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                {editingId ? '更新文章' : '创建文章'}
              </button>
              {editingId && (
                <button 
                  type="button" 
                  onClick={() => {
                    setFormData({ title: '', content: '' });
                    setEditingId(null);
                    setAiSuggestion('');
                  }}
                  className="btn btn-secondary"
                >
                  取消编辑
                </button>
              )}
            </div>
          </form>
        </div>

        {/* 文章列表 */}
        <div className="list-section">
          <h2>文章列表</h2>
          
          {loading ? (
            <div className="loading">加载中...</div>
          ) : articles.length === 0 ? (
            <div className="empty-state">
              <p>还没有文章，创建第一篇吧！</p>
            </div>
          ) : (
            <div className="articles-list">
              {articles.map(article => (
                <div key={article.id} className="article-item">
                  <h3>{article.title}</h3>
                  <div className="article-meta">
                    创建时间: {new Date(article.created_at).toLocaleString()}
                  </div>
                  <div className="article-actions">
                    <button 
                      onClick={() => editArticle(article)}
                      className="btn btn-edit"
                    >
                      编辑
                    </button>
                    <button 
                      onClick={() => deleteArticle(article.id)}
                      className="btn btn-delete"
                    >
                      删除
                    </button>
                    <a 
                      href={`/article/${article.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-view"
                    >
                      查看
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ArticleAdmin;