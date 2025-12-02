const express = require('express');
const path = require('path');
const db = require('./db');
const { client,connectRedis } = require('./redis');
const app = express();
const PORT = process.env.PORT || 3000;
const { OpenAI } = require('openai');
require('dotenv').config();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../build'), { 
  index: false,
  maxAge: '1y',
  immutable: true
}));

const memoryCache = {
  articles: null,
  articlesTimestamp: null,
  cacheDuration: 5 * 60 * 1000
};

// 清除 Redis 缓存
async function clearArticleCache() {
  try {
    await client.del('articles');
    console.log('已清除文章缓存');
  } catch (error) {
    console.log('清除 Redis 缓存失败',error);
  }
}

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
    let cachedArticles;
    try{
      cachedArticles = await client.get('articles');
    }catch(redisError){
      console.log('Redis错误，跳过缓存', redisError);
    }

    if(cachedArticles){
      console.log('查询Redis缓存');
      return res.json({
        success: true,
        data: JSON.parse(cachedArticles),
        fromCache: true
      })
    }

    console.log('查询数据库');

    const [rows] = await db.query('SELECT id, title, created_at FROM articles ORDER BY created_at DESC');

    try {
      await client.setEx('articles', 300, JSON.stringify(rows));
    } catch (redisError) {
      console.log('Redis 存储失败，跳过缓存',redisError);
    }
    
    console.log(`找到 ${rows.length} 篇文章，已缓存`);

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
    console.log(`正在获取文章详情，ID: ${articleId}`);
    
    const [rows] = await db.query('SELECT * FROM articles WHERE id = ?', [articleId]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '文章不存在'
      });
    }

    memoryCache[cacheKey] = rows[0];
    memoryCache[`${cacheKey}_timestamp`] = Date.now();
    
    console.log('成功获取文章详情');
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

// 新增
app.post('/api/articles', async (req, res) => {
  try {
    const { title, content, markdown } = req.body;
    console.log('正在创建新文章:', title);
    
    if (!title || !markdown) {
      return res.status(400).json({
        success: false,
        error: '标题和内容不能为空'
      });
    }
    
    const [result] = await db.query(
      'INSERT INTO articles (title, content,content_markdown) VALUES (?, ?, ?)',
      [title, content,markdown || '']
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
      error: '创建文章失败'
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


const fs = require('fs');
let serverEntry;
try {
  serverEntry = require('../build/server-entry.js');
} catch (e) {
  console.log(e);
}

let template;
try {
  template = fs.readFileSync(path.join(__dirname, '../build/index.html'), 'utf8');
} catch (e) {
  console.log(e);
  template = '<div id="root"></div>';
}

app.get(/.*/, async (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }

  console.log(`SSR: ${req.url}`);
  
  try {
    if (!serverEntry) {
       try {
         serverEntry = require('../build/server-entry.js');
       } catch (e) {
         console.error(e);
       }
    }
    
    if (!template || template === '<div id="root"></div>') {
       try {
         template = fs.readFileSync(path.join(__dirname, '../build/index.html'), 'utf8');
       } catch(e) {
          console.error(e);
       }
    }

    if (serverEntry && template) {
      const html = await serverEntry.render(req, template);
      res.send(html);
    } else {
      res.sendFile(path.join(__dirname, '../build/index.html'));
    }
  } catch (error) {
    console.error('SSR Error, falling back to CSR:', error);
    res.sendFile(path.join(__dirname, '../build/index.html'));
  }
});


// AI助手
app.post('/api/ai/generate', async (req, res) => {
  try {
    const { title } = req.body;
    
    if (!title) {
      return res.status(400).json({
        success: false,
        error: '请提供标题'
      });
    }
    
    console.log(`接收到AI生成请求 - 标题: "${title}"`);
    

    const openai = new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey: process.env.DEEPSEEK_API_KEY,
    });
    console.log(process.env.DEEPSEEK_API_KEY);

    const chatComletion = await openai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是一个专业的博客文章作者，请根据提供的标题生成一篇完整的博客文章。' },
        { role: 'user', content: `请根据提供的标题生成一篇完整的博客文章：${title},不超过200字` },
      ],
    });
    
    res.json({
      success: true,
      data: {
        content: chatComletion.choices[0].message.content,
        service: 'deepseek'
      }
    });
    
  } catch (error) {
    console.error('AI生成接口错误:', error);
    

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

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});