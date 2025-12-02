const mysql = require('mysql2');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '051221',
  database: 'blog_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const promisePool = pool.promise();

// 测试连接
async function testConnection() {
  try {
    const [rows] = await promisePool.query('SELECT 1 + 1 AS result');
    console.log('数据库连接成功！测试结果:', rows[0].result);
  } catch (error) {
    console.error('数据库连接失败:', error.message);
  }
}

testConnection();

module.exports = promisePool;