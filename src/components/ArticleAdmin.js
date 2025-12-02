import React, { useState, useEffect } from 'react';
import './ArticleAdmin.css';
import MDEditor from '@uiw/react-md-editor';


function ArticleAdmin() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ title: '', content: '',markdown: '' });
  const [editingId, setEditingId] = useState(null);
  const [aiSuggestion, setAiSuggestion] = useState('');

  useEffect(() => {
    const savedDraft = localStorage.getItem('blog_draft');
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        const shouldRestore = window.confirm(
          `发现上次未保存的草稿：“${draft.title || '无标题'}”\n（保存于: ${draft.lastSaved}）\n是否恢复？`
        );
        
        if (shouldRestore) {
          setFormData(prev => ({
            ...prev,
            title: draft.title || '',
            markdown: draft.markdown || '',
          }));
          console.log('草稿已恢复');
        }
      } catch (e) {
        console.error('恢复草稿时出错，数据可能损坏:', e);
        localStorage.removeItem('blog_draft');
      }
    }
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

  const generateAIContent = async () => {
    if (!formData.title.trim()) {
    alert('请先输入标题');
    return;
  }

  try {
    setAiSuggestion('AI正在思考中，请稍候...');
    
    const response = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: formData.title,
        keywords: ''
      }),
    });

    const result = await response.json();
    
    if (result.success) {
      let suggestionText = `AI建议: ${result.data.content}`;
      if (result.data.service === 'fallback') {
        suggestionText = suggestionText +' (备用方案)';
      } else if (result.data.service === 'baidu-ernie') {
        suggestionText = suggestionText +' (百度文心一言)';
      }
      
      if (result.data.note) {
        suggestionText = suggestionText + ` - ${result.data.note}`;
      }
      
      setAiSuggestion(suggestionText);
      
      setFormData(prev => ({
        ...prev,
        content: result.data.content
      }));
      
    } else {
      throw new Error(result.error || 'AI生成失败');
    }
  } catch (error) {
    console.error('AI生成失败:', error);
    setAiSuggestion('AI服务暂时不可用，请手动输入内容或稍后重试');
  }
  };

  const saveToDraft = () => {
    if (formData.title.trim() || formData.markdown.trim()) {
      const draft = {
        title: formData.title,
        markdown: formData.markdown,
        lastSaved: new Date().toLocaleString('zh-CN')
      };
      localStorage.setItem('blog_draft', JSON.stringify(draft));
      console.log('📝 草稿已自动保存');
    }
  };

  const debouncedSaveDraft = (() => {
    let timer = null;
    return () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(saveToDraft, 2000);
    };
  })();

  useEffect(()=>{
    debouncedSaveDraft();
  },[formData.title, formData.markdown]);

  const saveArticle = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.markdown.trim()) {
      alert('标题和Markdown内容不能为空');
      return;
    }

    try {
      // 通过是否存在id来判断 新增 or 修改
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

        localStorage.removeItem('blog_draft');
        setFormData({title:'',markdown:'',content:''});
        setEditingId(null);
        setAiSuggestion('');
        await fetchArticles();
      } else {
        alert('操作失败: ' + result.error);
      }
    } catch (error) {
      console.error('保存文章失败:', error);
      alert('网络错误，请重试');
    }
  };

  // 修改文章
  const editArticle = async (article) => {
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
        await fetchArticles();
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
      </header>

      <div className="admin-layout">
        <div className="form-section">
          <h2>{editingId ? '修改文章' : '创建新文章'}</h2>
          
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
              <label>内容:</label>
              <MDEditor
                value={formData.markdown}
                onChange={(value) => {
                  setFormData({...formData, markdown: value});
                }}
                height={400}
                preview="live"
              />
          </div>

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
            
            <div className="draft-controls">
              <h4>📦 草稿箱</h4>
              <div className="draft-buttons">
                <button
                  type="button"
                  onClick={() => {
                    const draft = localStorage.getItem('blog_draft');
                    if (draft) {
                      if (window.confirm('确定要加载草稿吗？')) {
                        const parsed = JSON.parse(draft);
                        setFormData(prev => ({
                          ...prev,
                          title: parsed.title,
                          markdown: parsed.markdown,
                        }));
                      }
                    } else {
                      alert('草稿箱是空的。');
                    }
                  }}
                  className="btn btn-draft"
                >
                  手动恢复草稿
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('确定要清空草稿箱吗？')) {
                      localStorage.removeItem('blog_draft');
                      alert('草稿已清空。');
                    }
                  }}
                  className="btn btn-clear"
                >
                  清空草稿箱
                </button>
                
                <button
                  type="button"
                  onClick={saveToDraft}
                  className="btn btn-save"
                >
                  立即保存草稿
                </button>
              </div>
              <p className="draft-hint">
                提示：草稿保存在浏览器本地，清空浏览器数据会丢失。
              </p>
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