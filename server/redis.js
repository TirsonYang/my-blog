// server/redis.js
const redis = require('redis');

// 创建 Redis 客户端
const client = redis.createClient({
  socket: {
    host: 'localhost', // Redis 服务器地址
    port: 6379         // Redis 端口
  },
  database: 1,
  password: '123456',
  legacyMode: false
});

// 更详细的错误处理
client.on('error', (err) => {
  console.log('❌ Redis 错误详情:', err.message);
  console.log('💡 提示: 请检查 Redis 服务是否正常运行');
});

client.on('connect', () => {
  console.log('✅ 已连接到 Redis');
});

client.on('ready', () => {
  console.log('🚀 Redis 客户端准备就绪');
});

client.on('end', () => {
  console.log('🔌 Redis 连接已关闭');
});

// 连接 Redis
async function connectRedis() {
  try {
    if (!client.isOpen) {
      console.log('🔄 正在连接 Redis...');
      await client.connect();
      console.log('✅ Redis 连接成功');
      
      // 🆕 测试连接
      await client.ping();
      console.log('✅ Redis Ping 测试成功');
    }
    return client;
  } catch (error) {
    console.log('❌ Redis 连接失败:', error.message);
    throw error;
  }
}

module.exports = { client, connectRedis };