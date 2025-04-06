import logger from "../utils/logger.js";
import { Router } from "express";
import { needlogin } from "../middleware/auth.js";
import { createEvent, TargetTypes } from "../controllers/events.js";
import {
  starProject,
  unstarProject,
  getProjectStarStatus,
  getProjectStars,
} from "../controllers/stars.js";

const router = Router();

router.post("/star", needlogin, async (req, res) => {
  try {
    const { projectid } = req.body;

    if (!projectid) {
      return res
        .status(400)
        .send({ status: "error", message: "项目ID不能为空" });
    }

    await starProject(res.locals.userid, projectid);

    // Add star event
    await createEvent(
      "PROJECT_STAR",
      res.locals.userid,
      TargetTypes.PROJECT,
      projectid,
      { action: "star" }
    );

    res.status(200).send({ status: "success", message: "收藏成功", star: 1 });
  } catch (err) {
    logger.error("Error starring project:", err);
    res.status(500).send({ status: "error", message: "收藏项目时出错" });
  }
});

router.post("/unstar", needlogin, async (req, res) => {
  try {
    const { projectid } = req.body;

    if (!projectid) {
      return res
        .status(400)
        .send({ status: "error", message: "项目ID不能为空" });
    }

    await unstarProject(res.locals.userid, projectid);

    res
      .status(200)
      .send({ status: "success", message: "取消收藏成功", star: 0 });
  } catch (err) {
    logger.error("Error unstarring project:", err);
    res.status(500).send({ status: "error", message: "取消收藏项目时出错" });
  }
});

router.get("/checkstar", async (req, res) => {
  try {
    const { projectid } = req.query;

    if (!projectid) {
      return res
        .status(400)
        .send({ status: "error", message: "项目ID不能为空" });
    }

    const status = await getProjectStarStatus(res.locals.userid, projectid);
    res.status(200).send({
      status: "success",
      message: "获取成功",
      star: status,
    });
  } catch (err) {
    logger.error("Error checking star status:", err);
    res.status(500).send({ status: "error", message: "检查收藏状态时出错" });
  }
});

router.get("/project/:id/stars", async (req, res) => {
  try {
    const projectid = req.params.id;
    const stars = await getProjectStars(projectid);
    res.status(200).send({
      status: "success",
      message: "获取成功",
      data: stars,
    });
  } catch (err) {
    logger.error("Error getting project stars:", err);
    res.status(500).send({ status: "error", message: "获取项目收藏数时出错" });
  }
});

export default router;
