import express from "express";
import { PORT } from "./config";
import { corsMiddleware } from "./middleware/cors";
import routes from "./routes";

// 初始化 Express 应用
const app = express();

// 中间件
app.use(express.json());
app.use(corsMiddleware);

// 注册路由
app.use(routes);

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
