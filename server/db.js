// server/db.js
const mysql = require('mysql2');

// 创建数据库连接池（这样更高效）
const pool = mysql.createPool({
  host: 'localhost',        // 数据库地址
  user: 'root',             // 你的数据库用户名
  password: '051221',     // 你的数据库密码
  database: 'blog_db',      // 你的数据库名
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 将连接池转为 Promise 版本，这样可以用 async/await
const promisePool = pool.promise();

// 测试连接
async function testConnection() {
  try {
    const [rows] = await promisePool.query('SELECT 1 + 1 AS result');
    console.log('✅ 数据库连接成功！测试结果:', rows[0].result);
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
  }
}

testConnection();

module.exports = promisePool;