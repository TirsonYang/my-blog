const redis = require('redis');

const client = redis.createClient({
  socket: {
    host: 'localhost', 
    port: 6379
  },
  database: 1,
  password: '123456',
  legacyMode: false
});

client.on('error', (err) => {
  console.log('Redis 错误详情:', err.message);
});

client.on('connect', () => {
  console.log('已连接到 Redis');
});

client.on('ready', () => {
  console.log('Redis客户端已准备');
});

client.on('end', () => {
  console.log('Redis 连接已关闭');
});

// 连接 Redis
async function connectRedis() {
  try {
    if (!client.isOpen) {
      console.log('正在连接 Redis');
      await client.connect();
      console.log('Redis 连接成功');
      
      // 🆕 测试连接
      await client.ping();
      console.log('Redis 已Ping通');
    }
    return client;
  } catch (error) {
    console.log('Redis 连接失败:', error.message);
    throw error;
  }
}

module.exports = { client, connectRedis };