// server/simple-server.js
const express = require('express');
const path = require('path');
const db = require('./db');
const { client, connectRedis } = require('./redis');

const app = express();
const PORT = 3000;

// 最基本的中间件
app.use(express.json());


const memoryCache = {
  articles: null,
  articlesTimestamp: null,
  cacheDuration: 5 * 60 * 1000 // 5分钟缓存
};

// 静态文件服务 - 使用绝对路径避免问题
const buildPath = path.resolve(__dirname, '../build');
app.use(express.static(buildPath,{
    // 设置缓存策略
  maxAge: '1d', // 强缓存：1天
  etag: true,   // 启用协商缓存
  lastModified: true
}));


// 特别为 JS 和 CSS 文件设置更长缓存
app.use('/static/js/:filename', (req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1年缓存
  next();
});

app.use('/static/css/:filename', (req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1年缓存
  next();
});

console.log('✅ 静态资源缓存已配置');



console.log('📁 静态文件目录:', buildPath);


// 在创建、更新、删除文章后清除 Redis 缓存
async function clearArticleCache() {
  try {
    await client.del('articles');
    console.log('✅ 已清除文章缓存');
  } catch (error) {
    console.log('⚠️ 清除 Redis 缓存失败',error);
  }
}

// 简单的 API 路由
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: '服务器运行正常',
    timestamp: new Date().toISOString()
  });
});

// 修改文章列表 API，添加缓存
// 修改文章列表 API，使用 Redis
app.get('/api/articles', async (req, res) => {
  try {
    // 尝试从 Redis 获取缓存
    let cachedArticles;
    try {
      cachedArticles = await client.get('articles');
    } catch (redisError) {
      console.log('⚠️ Redis 错误，跳过缓存');
    }
    
    if (cachedArticles) {
      console.log('📦 从 Redis 缓存返回文章列表');
      return res.json({
        success: true,
        data: JSON.parse(cachedArticles),
        fromCache: true
      });
    }
    
    console.log('📝 从数据库获取文章列表...');
    const [rows] = await db.query('SELECT id, title, created_at FROM articles ORDER BY created_at DESC');
    
    // 将结果存入 Redis，设置 5 分钟过期
    try {
      await client.setEx('articles', 300, JSON.stringify(rows));
    } catch (redisError) {
      console.log('⚠️ Redis 存储失败，跳过缓存');
    }
    
    console.log(`✅ 找到 ${rows.length} 篇文章，已缓存到 Redis`);
    res.json({
      success: true,
      data: rows,
      fromCache: false
    });
  } catch (error) {
    console.error('❌ 获取文章列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取文章失败'
    });
  }
});

// 同样为文章详情添加缓存
app.get('/api/articles/:id', async (req, res) => {
  try {
    const articleId = req.params.id;
    const cacheKey = `article_${articleId}`;
    
    // 检查缓存
    if (memoryCache[cacheKey] && 
        memoryCache[`${cacheKey}_timestamp`] && 
        (Date.now() - memoryCache[`${cacheKey}_timestamp`]) < memoryCache.cacheDuration) {
      console.log(`📦 从缓存返回文章详情，ID: ${articleId}`);
      return res.json({
        success: true,
        data: memoryCache[cacheKey],
        fromCache: true
      });
    }
    
    console.log(`📖 从数据库获取文章详情，ID: ${articleId}`);
    const [rows] = await db.query('SELECT * FROM articles WHERE id = ?', [articleId]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '文章不存在'
      });
    }
    
    // 更新缓存
    memoryCache[cacheKey] = rows[0];
    memoryCache[`${cacheKey}_timestamp`] = Date.now();
    
    console.log('✅ 成功获取文章详情，已缓存');
    res.json({
      success: true,
      data: rows[0],
      fromCache: false
    });
  } catch (error) {
    console.error('❌ 获取文章详情失败:', error);
    res.status(500).json({
      success: false,
      error: '获取文章详情失败'
    });
  }
});


// 更新文章
app.put('/api/articles/:id', async (req, res) => {
  try {
    const articleId = req.params.id;
    const { title, content } = req.body;
    
    console.log(`✏️ 正在更新文章，ID: ${articleId}`);
    
    const [result] = await db.query(
      'UPDATE articles SET title = ?, content = ? WHERE id = ?',
      [title, content, articleId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: '文章不存在'
      });
    }
    
    console.log('✅ 文章更新成功');

    await clearArticleCache();


    // 🆕 清除文章列表缓存和该文章的缓存
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
    console.error('❌ 更新文章失败:', error);
    res.status(500).json({
      success: false,
      error: '更新文章失败'
    });
  }
});

// 创建文章 - POST 路由
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

    await clearArticleCache();

    // 🆕 清除文章列表缓存
    memoryCache.articles = null;
    memoryCache.articlesTimestamp = null;

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
      error: '创建文章失败: ' + error.message
    });
  }
});

// 删除文章
app.delete('/api/articles/:id', async (req, res) => {
  try {
    const articleId = req.params.id;
    console.log(`🗑️ 正在删除文章，ID: ${articleId}`);
    
    const [result] = await db.query('DELETE FROM articles WHERE id = ?', [articleId]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: '文章不存在'
      });
    }
    
    console.log('✅ 文章删除成功');

    await clearArticleCache();


    // 🆕 清除文章列表缓存和该文章的缓存
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
    console.error('❌ 删除文章失败:', error);
    res.status(500).json({
      success: false,
      error: '删除文章失败'
    });
  }
});

// 🆕 关键修改：使用最简化的路由处理
// 首页路由
app.get('/', (req, res) => {
  console.log('📄 请求首页');
  res.sendFile(path.join(buildPath, 'index.html'));
});

// 管理后台路由
app.get('/admin', (req, res) => {
  console.log('📄 请求管理后台');
  res.sendFile(path.join(buildPath, 'index.html'));
});

// 文章详情页路由
app.get('/article/:id', (req, res) => {
  console.log(`📄 请求文章详情: ${req.params.id}`);
  res.sendFile(path.join(buildPath, 'index.html'));
});

// 🆕 重要：不使用通配符路由，而是明确处理其他路由
app.get('/about', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

app.get('/contact', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

// 最后：处理未匹配的路由 - 但不用通配符
app.use((req, res) => {
  console.log(`🔍 未匹配的路由: ${req.url}`);
  res.status(404).json({ 
    error: '路由不存在',
    requestedUrl: req.url 
  });
});

// 启动服务器
app.listen(PORT, async() => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
  try {
    await connectRedis();
    console.log('✅ Redis 缓存已启用');
  } catch (error) {
    console.log('⚠️ Redis 连接失败，使用内存缓存',error);
  }
});