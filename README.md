## SSR博客系统

一个使用 React、Express 和 MySQL 构建的，支持服务端渲染的博客系统。

## 已完成功能
1.  **文章管理**：对文章的增删改查。
2.  **服务端渲染**：首页和文章详情页加载更快。
3.  **智能缓存**：使用Redis缓存，速度提升。
4.  **集成markdown渲染**：使用marked库，将Markdown转换为HTML。
5.  **草稿放丢失**： 意外关闭等情况可以恢复未完成的文章，防止丢失。
5.  **AI写作助手**：内置智能引擎，可根据标题生成内容建议。

## 快速启动
1.  安装依赖：`npm install`
2.  创建MySQL数据库，导入表结构
3.  构建前端：`npm run build`
4.  启动服务：`npm run dev`

## 项目结构
my-blog-ssr/
├── src/               # React前端源码
├── server/            # Express后端源码
├── build/             # 构建后的前端文件
└── README.md          # 本文档