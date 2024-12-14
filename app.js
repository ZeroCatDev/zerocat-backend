import express from "express";
import jsonwebtoken from "jsonwebtoken";

import configManager from "./server/configManager.js";
import logger from "./server/lib/logger.js";

import "dotenv/config";

import expressWinston from "express-winston";
import cors from "cors";
import bodyParser from "body-parser";
import multipart from "connect-multiparty";
import compress from "compression";

const app = express();

app.use(
  expressWinston.logger({
    winstonInstance: logger,
    meta: true,
    msg: "HTTP {{req.method}} {{res.statusCode}} {{res.responseTime}}ms {{req.url}} {{req.ip}}",
    colorize: false,
    ignoreRoute: (req, res) => false,
    level: "info",
  })
);

// cors配置
const corslist = (await configManager.getConfig("cors")).split(",");
const corsOptions = {
  origin: (origin, callback) =>
    origin
      ? corslist.indexOf(new URL(origin).hostname) === -1
        ? callback(new logger.error("Not allowed by CORS"))
        : callback(null, true)
      : callback(null, true),
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  preflightContinue: false,
  optionsSuccessStatus: 200,
  credentials: true,
};
app.use(cors(corsOptions));

//express 的http请求体进行解析组件
app.use(bodyParser["urlencoded"]({ limit: "50mb", extended: false }));
app.use(bodyParser["json"]({ limit: "50mb" }));
app.use(bodyParser["text"]({ limit: "50mb" }));

//文件上传模块
app.use(multipart({ uploadDir: "./data/upload_tmp" }));

//压缩组件，需要位于 express.static 前面，否则不起作用
app.use(compress());

app.set("env", process.cwd());
app.set("data", process.cwd() + "/data");
app.set("views", process.cwd() + "/views");
app.set("prisma", process.cwd() + "/prisma");
app.set(
  "node_modules/@prisma/client",
  process.cwd() + "/node_modules/@prisma/client"
);

app.set("view engine", "ejs");

//数据库
import DB from "./server/lib/database.js";


//启动http(80端口)==================================
//http.createServer(app).listen(3000, "0.0.0.0", function () {
//  console.log("Listening on http://localhost:3000");
//}); // 平台总入口
app.options("*", cors());

let zcjwttoken;
(async () => {
  zcjwttoken = await configManager.getConfig("security.jwttoken");
})();
app.all("*", async function (req, res, next) {
  const tokenSources = [
    req.headers["authorization"]?.replace("Bearer ", ""),
    req.cookies?.token,
    req.body?.token,
    req.headers?.["token"],
    req.query?.token,
  ];
  let token = null;

  for (let source of tokenSources) {
    if (source) {
      try {
        const decodedToken = jsonwebtoken.verify(source, zcjwttoken);
        if (decodedToken?.userid) {
          token = source;
          res.locals = {
            login: true,
            userid: decodedToken.userid,
            email: decodedToken.email,
            username: decodedToken.username,
            display_name: decodedToken.display_name,
            avatar: decodedToken.avatar,
            is_admin: decodedToken.is_admin || 0,
            usertoken: token,
          };
          break;
        }
      } catch (err) {
        continue;
      }
    }
  }

  if (!token) {
    res.locals = {
      login: false,
      userid: "",
      email: "",
      username: "",
      display_name: "",
      avatar: "",
      is_admin: 0,
      usertoken: "",
    };
  }

  next();
});

//首页
app.get("/", function (req, res) {
  res.render("index.ejs");
});

//放在最后，确保路由时能先执行app.all=====================
//注册、登录等功能路由
import router_register from "./server/router_account.js";
app.use("/account", router_register);

//个人中心路由//学生平台路由
import router_admin from "./server/router_my.js";
app.use("/my", router_admin);

//搜索api
import router_search from "./server/router_search.js";
app.use("/searchapi", router_search);

//scratch路由
import router_scratch from "./server/router_scratch.js";
app.use("/scratch", router_scratch);
//api路由
import apiserver from "./server/router_api.js";
app.use("/api", apiserver);
//api路由

import router_projectlist from "./server/router_projectlist.js";
app.use("/projectlist", router_projectlist);

//项目处理路由
import router_project from "./server/router_project.js";
app.use("/project", router_project);

//项目处理路由
import router_comment from "./server/router_comment.js";

app.use("/comment", router_comment);

app.get("/check", function (req, res, next) {
  res.status(200).json({
    message: "success",
    code: 200,
  });
});

process.on("uncaughtException", function (err) {
  logger.error(err);
});

// Centralized error-handling middleware function
app.use((err, req, res, next) => {
  logger.error(err);
  res.status(500).send({
    status: "error",
    message: "Something went wrong!",
    error: err.message,
  });
});

//放在最后，友好的处理地址不存在的访问
app.all("*", function (req, res, next) {
  res.locals.tipType = "访问错误";
  res.status(404).json({
    status: "error",
    code: "404",
    message: "找不到页面",
  });
});

export default app;

