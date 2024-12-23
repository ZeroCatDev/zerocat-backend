import logger from "../utils/logger.js";
import configManager from "../utils/configManager.js";

async function needlogin(req, res, next) {
  if (!res.locals.login) {
    // 未登录，返回401 Unauthorized状态码
    return res.status(401).send({ status: "0", msg: "请先登录以继续操作" });
  }
  next(); // 已登录，继续处理请求
}
async function needadmin(req, res, next) {
  if (!res.locals.login) {
    // 未登录，返回401 Unauthorized状态码
    return res.status(401).send({ status: "0", msg: "请先登录以继续操作" });
  }
  if (res.locals.email !==await configManager.getConfig("security.adminuser")) {
    // 未登录，返回401 Unauthorized状态码
    return res.status(401).send({ status: "0", msg: "权限不足" });
  }
  next(); // 已登录，继续处理请求
}
export {
  needlogin,
  needadmin
};
