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
    // 🆕 新增的“开门问候”逻辑开始 -----------------
    const savedDraft = localStorage.getItem('blog_draft');
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        // 友好地询问用户
        const shouldRestore = window.confirm(
          `发现上次未保存的草稿：“${draft.title || '无标题'}”\n（保存于: ${draft.lastSaved}）\n是否恢复？`
        );
        
        if (shouldRestore) {
          setFormData(prev => ({
            ...prev,
            title: draft.title || '',
            markdown: draft.markdown || '',
            // content 可以保持不变或置空，因为内容来自markdown
          }));
          console.log('✅ 草稿已恢复');
        } 
        // else {
        //   // 用户不想恢复，就清掉它
        //   localStorage.removeItem('blog_draft');
        //   console.log('🗑️ 用户选择丢弃草稿');
        // }
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

  // 1. 保存草稿到“保险箱”（浏览器本地存储）
  const saveToDraft = () => {
    // 只有标题或内容有一项不为空，才值得保存
    if (formData.title.trim() || formData.markdown.trim()) {
      const draft = {
        title: formData.title,
        markdown: formData.markdown,
        lastSaved: new Date().toLocaleString('zh-CN') // 记录保存时间
      };
      // 关键操作：存入“保险箱”，名字叫 'blog_draft'
      localStorage.setItem('blog_draft', JSON.stringify(draft));
      console.log('📝 草稿已自动保存');
    }
  };

  // 2. “延迟抄写员”（防止打字时频繁保存，造成卡顿）
  const debouncedSaveDraft = (() => {
    let timer = null;
    return () => {
      if (timer) clearTimeout(timer); // 如果上次的定时还没执行，就取消
      timer = setTimeout(saveToDraft, 2000); // 等用户停止输入2秒后再保存
    };
  })();

  useEffect(()=>{
    debouncedSaveDraft();
  },[formData.title, formData.markdown]);

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

        localStorage.removeItem('blog_draft');
        setFormData({title:'',markdown:'',content:''});
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

            {/* 新增：草稿箱控制面板 */}
            <div className="draft-controls">
              <h4>📦 草稿箱</h4>
              <div className="draft-buttons">
                <button
                  type="button"
                  onClick={() => {
                    const draft = localStorage.getItem('blog_draft');
                    if (draft) {
                      if (window.confirm('确定要加载草稿吗？这会覆盖当前未保存的内容。')) {
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
                    if (window.confirm('确定要清空草稿箱吗？这个操作不能撤销。')) {
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
                  onClick={saveToDraft} // 直接调用前面写的保存函数
                  className="btn btn-save"
                >
                  立即保存草稿
                </button>
              </div>
              <p className="draft-hint">
                提示：草稿自动保存在你的浏览器本地，清空浏览器数据会导致丢失。
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