// server/index.js
const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = 3000;

// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname, '../build')));

// API 路由 - 保持不变
app.get('/api/test', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT NOW() AS `current_time`');
    res.json({ 
      message: 'API 工作正常！',
      database_time: rows[0].current_time
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/articles', async (req, res) => {
  try {
    console.log('📝 正在获取文章列表...');
    const [rows] = await db.query('SELECT id, title, created_at FROM articles ORDER BY created_at DESC');
    
    console.log(`✅ 找到 ${rows.length} 篇文章`);
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('❌ 获取文章列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取文章失败'
    });
  }
});

app.get('/api/articles/:id', async (req, res) => {
  try {
    const articleId = req.params.id;
    console.log(`📖 正在获取文章详情，ID: ${articleId}`);
    
    const [rows] = await db.query('SELECT * FROM articles WHERE id = ?', [articleId]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '文章不存在'
      });
    }
    
    console.log('✅ 成功获取文章详情');
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('❌ 获取文章详情失败:', error);
    res.status(500).json({
      success: false,
      error: '获取文章详情失败'
    });
  }
});

// 其他 CRUD API 保持不变
app.post('/api/articles', async (req, res) => {
  try {
    const { title, content } = req.body;
    console.log('🆕 正在创建新文章:', title);
    
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: '标题和内容不能为空'
      });
    }
    
    const [result] = await db.query(
      'INSERT INTO articles (title, content) VALUES (?, ?)',
      [title, content]
    );
    
    console.log(`✅ 文章创建成功，ID: ${result.insertId}`);
    res.json({
      success: true,
      data: {
        id: result.insertId,
        title,
        content
      }
    });
  } catch (error) {
    console.error('❌ 创建文章失败:', error);
    res.status(500).json({
      success: false,
      error: '创建文章失败'
    });
  }
});

// 🆕 明确的页面路由（避免通配符问题）

// 首页路由
app.get('/', async (req, res) => {
  console.log('🌐 SSR: 首页请求');
  await renderHomePage(req, res);
});

// 文章详情页路由
app.get('/article/:id', async (req, res) => {
  console.log(`🌐 SSR: 文章详情请求，ID: ${req.params.id}`);
  await renderArticlePage(req, res, req.params.id);
});

// 其他所有页面路由 - 返回客户端渲染
app.get('*', (req, res) => {
  console.log(`🌐 客户端渲染: ${req.url}`);
  res.sendFile(path.join(__dirname, '../build/index.html'));
});

// 🆕 首页渲染函数
async function renderHomePage(req, res) {
  try {
    let pageContent = '';
    
    try {
      const [rows] = await db.query('SELECT id, title, created_at FROM articles ORDER BY created_at DESC');
      
      if (rows.length > 0) {
        pageContent = `
          <h1>📝 我的博客</h1>
          <p>欢迎阅读我的文章</p>
          <div class="articles">
            ${rows.map(article => `
              <div class="article">
                <h2><a href="/article/${article.id}">${escapeHTML(article.title)}</a></h2>
                <p class="article-meta">发布时间: ${new Date(article.created_at).toLocaleDateString()}</p>
                <a href="/article/${article.id}" class="read-more">阅读全文</a>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        pageContent = `
          <h1>📝 我的博客</h1>
          <p>还没有文章，快去创建吧！</p>
        `;
      }
    } catch (dbError) {
      console.error('数据库查询失败，使用降级内容:', dbError);
      pageContent = `
        <h1>📝 我的博客</h1>
        <p>正在加载文章...</p>
      `;
    }
    
    const html = createHTMLPage('首页 - 我的博客', pageContent);
    res.send(html);
    
  } catch (error) {
    console.error('❌ 首页 SSR 失败，降级到客户端渲染:', error);
    res.sendFile(path.join(__dirname, '../build/index.html'));
  }
}

// 🆕 文章详情页渲染函数
async function renderArticlePage(req, res, articleId) {
  try {
    let pageContent = '';
    
    try {
      const [rows] = await db.query('SELECT * FROM articles WHERE id = ?', [articleId]);
      
      if (rows.length > 0) {
        const article = rows[0];
        pageContent = `
          <a href="/" class="back-link">← 返回首页</a>
          <h1>${escapeHTML(article.title)}</h1>
          <p class="article-meta">发布时间: ${new Date(article.created_at).toLocaleString()}</p>
          <div class="content">
            ${article.content.split('\n').map(p => `<p>${escapeHTML(p)}</p>`).join('')}
          </div>
          <a href="/" class="back-link">返回首页</a>
        `;
      } else {
        pageContent = `
          <h1>文章不存在</h1>
          <p>抱歉，没有找到您要查看的文章。</p>
          <a href="/">返回首页</a>
        `;
      }
    } catch (dbError) {
      console.error('数据库查询失败，使用降级内容:', dbError);
      pageContent = `
        <a href="/">← 返回首页</a>
        <p>正在加载文章详情...</p>
      `;
    }
    
    const pageTitle = rows && rows[0] ? `${rows[0].title} - 我的博客` : '文章详情 - 我的博客';
    const html = createHTMLPage(pageTitle, pageContent);
    res.send(html);
    
  } catch (error) {
    console.error('❌ 文章详情页 SSR 失败，降级到客户端渲染:', error);
    res.sendFile(path.join(__dirname, '../build/index.html'));
  }
}

// 🆕 创建 HTML 页面的通用函数
function createHTMLPage(title, content) {
  return `
    <!DOCTYPE html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: #f5f5f5;
            line-height: 1.6;
          }
          .container { 
            max-width: 800px; 
            margin: 0 auto; 
            background: white; 
            padding: 30px; 
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .articles {
            margin-top: 20px;
          }
          .article { 
            border-bottom: 1px solid #eee; 
            padding: 20px 0; 
          }
          .article:last-child { 
            border-bottom: none; 
          }
          .article h2 { 
            margin: 0 0 10px 0; 
            font-size: 1.5em;
          }
          .article h2 a {
            color: #2c3e50;
            text-decoration: none;
          }
          .article h2 a:hover {
            color: #3498db;
          }
          .article-meta {
            color: #7f8c8d;
            font-size: 0.9em;
            margin: 5px 0 15px 0;
          }
          .read-more {
            display: inline-block;
            background: #3498db;
            color: white;
            padding: 8px 15px;
            border-radius: 4px;
            text-decoration: none;
            font-size: 0.9em;
          }
          .read-more:hover {
            background: #2980b9;
          }
          .back-link {
            color: #3498db;
            text-decoration: none;
            margin-bottom: 20px;
            display: inline-block;
          }
          .back-link:hover {
            text-decoration: underline;
          }
          .content {
            margin-top: 20px;
          }
          .content p {
            margin-bottom: 1em;
          }
          a {
            color: #3498db;
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="container">
          ${content}
        </div>
        
        <!-- 客户端 React 将接管这个页面 -->
        <div id="root"></div>
        <script src="/static/js/main.js"></script>
      </body>
    </html>
  `;
}

// HTML 转义函数
function escapeHTML(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
  console.log('✅ 终极修复版 SSR 已启用！');
  console.log('📖 访问 http://localhost:3000 测试效果');
  console.log('💡 这次应该没有路由错误了！');
});