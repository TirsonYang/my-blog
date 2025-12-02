const express = require('express');
const path = require('path');
const db = require('./db');
const { client, connectRedis } = require('./redis');
const baiduAI = require('./baidu-ai');

const app = express();
const PORT = 3000;

app.use(express.json());


const memoryCache = {
  articles: null,
  articlesTimestamp: null,
  cacheDuration: 5 * 60 * 1000
};

const buildPath = path.resolve(__dirname, '../build');
app.use(express.static(buildPath,{
  maxAge: '1d',
  etag: true,
  lastModified: true
}));

app.use('/static/js/:filename', (req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=31536000');
  next();
});

app.use('/static/css/:filename', (req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=31536000');
  next();
});

console.log('静态资源缓存已配置');



console.log('静态文件目录:', buildPath);


// 清除 Redis 缓存
async function clearArticleCache() {
  try {
    await client.del('articles');
    console.log('已清除文章缓存');
  } catch (error) {
    console.log('清除 Redis 缓存失败',error);
  }
}

// 测试服务器
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: '服务器运行正常',
    timestamp: new Date().toISOString()
  });
});

// 查询文章列表
app.get('/api/articles', async (req, res) => {
  try {
    let cachedArticles;
    try {
      cachedArticles = await client.get('articles');
    } catch (redisError) {
      console.log('Redis错误，跳过缓存',redisError);
    }
    
    if (cachedArticles) {
      console.log('查询Redis缓存');
      return res.json({
        success: true,
        data: JSON.parse(cachedArticles),
        fromCache: true
      });
    }
    
    console.log('查询数据库');
    const [rows] = await db.query('SELECT id, title, created_at FROM articles ORDER BY created_at DESC');
    
    try {
      await client.setEx('articles', 300, JSON.stringify(rows));
    } catch (redisError) {
      console.log('Redis 存储失败，跳过缓存',redisError);
    }
    
    console.log(`找到 ${rows.length} 篇文章，已缓存到 Redis`);
    res.json({
      success: true,
      data: rows,
      fromCache: false
    });
  } catch (error) {
    console.error('获取文章列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取文章失败'
    });
  }
});

// 查询文章详情
app.get('/api/articles/:id', async (req, res) => {
  try {
    const articleId = req.params.id;
    const cacheKey = `article_${articleId}`;
    
    if (memoryCache[cacheKey] && 
        memoryCache[`${cacheKey}_timestamp`] && 
        (Date.now() - memoryCache[`${cacheKey}_timestamp`]) < memoryCache.cacheDuration) {
      console.log(`查询缓存-文章详情，ID: ${articleId}`);
      return res.json({
        success: true,
        data: memoryCache[cacheKey],
        fromCache: true
      });
    }
    
    console.log(`查询数据库-文章详情，ID: ${articleId}`);

    const [rows] = await db.query(
      'SELECT id, title, content, content_markdown, created_at FROM articles WHERE id=?',
      [articleId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '文章不存在'
      });
    }
    
    memoryCache[cacheKey] = rows[0];
    memoryCache[`${cacheKey}_timestamp`] = Date.now();
    
    console.log('成功获取文章详情，已存入缓存');
    res.json({
      success: true,
      data: rows[0],
      fromCache: false
    });
  } catch (error) {
    console.error('获取文章详情失败:', error);
    res.status(500).json({
      success: false,
      error: '获取文章详情失败'
    });
  }
});


// 修改文章
app.put('/api/articles/:id', async (req, res) => {
  try {
    const articleId = req.params.id;
    const { title, content,markdown} = req.body;
    
    console.log(`正在更新文章，ID: ${articleId}`);
    
    const [result] = await db.query(
      'UPDATE articles SET title = ?, content = ?,content_markdown = ? WHERE id = ?',
      [title, content, markdown || '', articleId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: '文章不存在'
      });
    }
    
    console.log('文章更新成功');

    await clearArticleCache();

    memoryCache.articles = null;
    memoryCache.articlesTimestamp = null;
    const cacheKey = `article_${articleId}`;
    memoryCache[cacheKey] = null;
    memoryCache[`${cacheKey}_timestamp`] = null;

    res.json({
      success: true,
      message: '文章更新成功'
    });
  } catch (error) {
    console.error('更新文章失败:', error);
    res.status(500).json({
      success: false,
      error: '更新文章失败'
    });
  }
});

// 新增文章
app.post('/api/articles', async (req, res) => {
  try {
    const { title, content,markdown } = req.body;
    console.log('正在创建新文章:', title);
    
    if (!title || !markdown) {
      return res.status(400).json({
        success: false,
        error: '标题和Markdown内容不能为空'
      });
    }

    const [result] = await db.query(
      'INSERT INTO articles (title, content, content_markdown) VALUES (?, ?, ?)',
      [title, content, markdown || '']
    );
    
    console.log(`文章创建成功，ID: ${result.insertId}`);

    await clearArticleCache();

    memoryCache.articles = null;
    memoryCache.articlesTimestamp = null;

    res.json({
      success: true,
      data: {
        id: result.insertId,
        title,
        content,
        markdown
      }
    });
  } catch (error) {
    console.error('创建文章失败:', error);
    res.status(500).json({
      success: false,
      error: '创建文章失败: ' + error.message
    });
  }
});

// 删除文章
app.delete('/api/articles/:id', async (req, res) => {
  try {
    const articleId = req.params.id;
    console.log(`正在删除文章，ID: ${articleId}`);
    
    const [result] = await db.query('DELETE FROM articles WHERE id = ?', [articleId]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: '文章不存在'
      });
    }
    
    console.log('文章删除成功');

    await clearArticleCache();

    memoryCache.articles = null;
    memoryCache.articlesTimestamp = null;
    const cacheKey = `article_${articleId}`;
    memoryCache[cacheKey] = null;
    memoryCache[`${cacheKey}_timestamp`] = null;

    res.json({
      success: true,
      message: '文章删除成功'
    });
  } catch (error) {
    console.error('删除文章失败:', error);
    res.status(500).json({
      success: false,
      error: '删除文章失败'
    });
  }
});

// AI助手
app.post('/api/ai/generate', async (req, res) => {
  try {
    const { title, keywords } = req.body;
    
    if (!title) {
      return res.status(400).json({
        success: false,
        error: '请提供标题'
      });
    }
    
    console.log(`接收到AI生成请求 - 标题: "${title}"`);
    
    // 调用AI 发送请求
    const aiContent = await baiduAI.generateContent(title, keywords);
    
    res.json({
      success: true,
      data: {
        content: aiContent,
        service: 'baidu-ernie'
      }
    });
    
  } catch (error) {
    console.error('AI生成接口错误:', error);
    

    // 出错方案
    const fallbackContent = `关于"${req.body.title}"，这是一个值得深入探讨的话题。在当前背景下，我们需要从多个维度来理解这一问题。`;
    
    res.json({
      success: true,
      data: {
        content: fallbackContent,
        service: 'fallback',
        note: 'AI服务暂时不可用，已使用备用方案'
      }
    });
  }
});


app.get('/', (req, res) => {
  console.log('请求首页');
  res.sendFile(path.join(buildPath, 'index.html'));
});

app.get('/admin', (req, res) => {
  console.log('请求管理后台');
  res.sendFile(path.join(buildPath, 'index.html'));
});

app.get('/article/:id', (req, res) => {
  console.log(`请求文章详情: ${req.params.id}`);
  res.sendFile(path.join(buildPath, 'index.html'));
});

// app.get('/about', (req, res) => {
//   res.sendFile(path.join(buildPath, 'index.html'));
// });

// app.get('/contact', (req, res) => {
//   res.sendFile(path.join(buildPath, 'index.html'));
// });

app.use((req, res) => {
  console.log(`未匹配的路由: ${req.url}`);
  res.status(404).json({ 
    error: '路由不存在',
    requestedUrl: req.url 
  });
});

// 启动服务器
app.listen(PORT, async() => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  try {
    await connectRedis();
    console.log('Redis 缓存已启用');
  } catch (error) {
    console.log('Redis 连接失败，使用内存缓存',error);
  }
});