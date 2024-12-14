import logger from "./lib/logger.js";
import configManager from "./configManager.js";
import jsonwebtoken from "jsonwebtoken";

import { Router } from "express";
var router = Router();
import { writeFile, exists } from "fs";
import { query } from "./lib/database.js"; // 数据库

//功能函数集
import { prisma, S3update } from "./lib/global.js";
import { needlogin } from "./middleware/auth.js";
import { getProjectFile } from "./lib/method/projects.js";
router.all("*", function (req, res, next) {
  next();
});



router.get("/projectinfo", function (req, res, next) {
  try {
    SQL =
      `SELECT ow_projects.id,ow_projects.authorid,ow_projects.time,ow_projects.view_count,ow_projects.like_count,ow_projects.type,` +
      ` ow_projects.favo_count,ow_projects.title,ow_projects.state,ow_projects.description,ow_projects.licence,ow_projects.tags,` +
      ` '' AS likeid, '' AS favoid,` +
      ` ow_users.display_name AS author_display_name,` +
      ` ow_users.images AS author_images,` +
      ` ow_users.motto AS author_motto` +
      ` FROM ow_projects ` +
      ` LEFT JOIN ow_users ON (ow_users.id=ow_projects.authorid) ` +
      ` WHERE ow_projects.id=${req.query.id} AND (ow_projects.state='public' ${
        res.locals.userid ? `or ow_projects.authorid=${res.locals.userid}` : ""
      }) AND ow_projects.type='scratch' LIMIT 1`;
    query(SQL, function (err, SCRATCH) {
      if (err || SCRATCH.length == 0) {
        res.locals.tip = { opt: "flash", msg: "项目不存在或未发布" };
        res.send({
          code: 404,
          status: "404",
          msg: "项目不存在或未发布",
          error: err,
        });
        return;
      }

      res.locals["is_author"] =
        SCRATCH[0].authorid == res.locals.userid ? true : false;

      ////logger.logger.debug(SCRATCH[0]);
      res.json(SCRATCH[0]);
    });
  } catch (err) {
    next(err);
  }
});

router.get("/projectinfo2", async function (req, res, next) {
  try {
    var result = await prisma.ow_projects.findFirst({
      where: {
        id: Number(req.query.id),
      },
    });
    var author = await prisma.ow_users.findFirst({
      where: {
        id: result.authorid,
      },
    });
    res.locals["is_author"] =
      result.authorid == res.locals.userid ? true : false;
    logger.debug(result);
    var resulttype = {
      id: 50,
      type: "scratch",
      licence: "no",
      authorid: 89,
      teacherid: 0,
      state: "public",
      view_count: 119,
      like_count: 0,
      favo_count: 0,
      time: "2024-06-22T10:32:42.000Z",
      title: "title",
      description: "description",
      source: "source",
      history: true,
      devenv: true,
      devsource: "devsource",
      tags: "",
    };
    var project_token = jsonwebtoken.sign(
      {
        exp: Math.floor(Date.now() / 1000) + 60 * 5,
        data: {
          type: "project",
          action: "read",
          issuer: await configManager.getConfig("site.domain"),
          projectid: result.id,
          userid: res.locals.userid,
        },
      },
      await configManager.getConfig("security.jwttoken")
    );
    logger.debug(project_token);
    jsonscratch = {
      id: result.id,
      title: result.title,
      description: result.description,
      instructions: "ZeroCat社区",
      visibility: "visible",
      public: result.state == "public" ? true : false,
      comments_allowed: true,
      is_published: result.state == "public" ? true : false,
      author: {
        id: result.authorid,
        username: author.display_name,
        scratchteam: author.id == 1 ? true : false,
        history: {
          joined: author.createdAt,
        },
        profile: {
          id: null,
          images: {
            "90x90": `${global.config["urls.static"]}/user/${author.images}`,
            "60x60": `${global.config["urls.static"]}/user/${author.images}`,
            "55x55": `${global.config["urls.static"]}/user/${author.images}`,
            "50x50": `${global.config["urls.static"]}/user/${author.images}`,
            "32x32": `${global.config["urls.static"]}/user/${author.images}`,
          },
        },
      },
      image: `${global.config["urls.static"]}/scratch_slt/${result.id}`,
      images: {
        "282x218": `${global.config["urls.static"]}/scratch_slt/${result.id}`,
        "216x163": `${global.config["urls.static"]}/scratch_slt/${result.id}`,
        "200x200": `${global.config["urls.static"]}/scratch_slt/${result.id}`,
        "144x108": `${global.config["urls.static"]}/scratch_slt/${result.id}`,
        "135x102": `${global.config["urls.static"]}/scratch_slt/${result.id}`,
        "100x80": `${global.config["urls.static"]}/scratch_slt/${result.id}`,
      },
      history: {
        created: result.createdAt,
        modified: result.createdAt,
        shared: result.createdAt,
      },
      stats: {
        views: result.view_count,
        loves: 0,
        favorites: 0,
        remixes: 0,
      },
      remix: {
        parent: null,
        root: null,
      },
      project_token,
    };
    ////logger.logger.debug(SCRATCH[0]);
    res.json(jsonscratch);
  } catch (err) {
    next(err);
  }
});

// 获取源代码
router.get("/project/:id", async (req, res, next) => {
  try {
    if (!req.params.id) {
      return res.status(400).send({ status: "0", msg: "缺少项目ID" });
    }
    let project_token;
    if (req.query.token) {
      try {
        logger.debug(await configManager.getConfig("security.jwttoken"));
        project_token = jsonwebtoken.verify(
          req.query.token,
          await configManager.getConfig("security.jwttoken")
        );
        logger.debug(project_token);
      } catch (err) {
        logger.debug("Error verifying project token:", err);
        return res.status(403).send({ status: "0", msg: "无权访问此项目" });
      }
      if (project_token.data.projectid != req.params.id) {
        logger.debug("1");
        return res.status(403).send({ status: "0", msg: "无权访问此项目" });
      }
      if (res.locals.userid && project_token.data.userid != res.locals.userid) {
        logger.debug("2");
        return res.status(403).send({ status: "0", msg: "无权访问此项目" });
      }
    } else {
      logger.debug("3");
      return res.status(403).send({ status: "0", msg: "无权访问此项目" });
    }
    const project = await prisma.ow_projects.findFirst({
      where: { id: Number(project_token.data.projectid) },
    });

    if (!project) {
      return res.status(404).send({ status: "0", msg: "作品不存在或无权打开" });
    }

    const source =
      project.authorid === project_token.data.userid
        ? project.devsource
        : project.source;
    const projectFile = await getProjectFile(source);

    if (projectFile?.source) {
      res.status(200).send(projectFile.source);
    } else {
      res.status(403).send({ status: "0", msg: "无权访问此项目" });
    }
  } catch (err) {
    logger.error("Error fetching project source code:", err);
    next(err);
  }
});



//Scratch内部调用二：获取作品素材：背景、角色、音频。取素材时需要完整的文件路径
router.get("/assets/:filename", function (req, res, next) {
  try {
    res.status(500).send({
      status: "error",
      message: "此接口已废弃",
    });
    return;
    var p = `${process.cwd()}/data/material/asset/${req.params.filename}`;
    res.sendFile(p); //必须是绝对路径
  } catch (err) {
    next(err);
  }
});



//保存作品：缩略图
router.post("/thumbnail/:projectid", function (req, res, next) {
  try {
    ////logger.logger.debug('开始保存缩略图：'+req.params.projectid);

    // 请求的头部为 'Content-Type': 'image/png'时，用req.on接收文件
    var _data = [];
    req.on("data", function (data) {
      if (data) {
        _data["push"](data);
      }
    });
    req.on("end", function () {
      //var strFileName = './data/scratch_slt/' + req.params.projectid;
      var strFileName = `${process.cwd()}/data/scratch_slt/${req.params.projectid}`;
      let content = Buffer["concat"](_data);
      writeFile(strFileName, content, function (err) {
        if (err) {
          res.status(404).send({ status: "err" });
          //logger.logger.debug(err);
          //logger.logger.debug("保存缩略图失败：" + strFileName);
        } else {
          S3update("scratch_slt/" + req.params.projectid, strFileName);

          ////logger.logger.debug('保存缩略图成功：'+strFileName);
          res.status(200).send({ status: "ok" });
          //fs.unlink(`./data/scratch_slt/${req.params.projectid}`,function (err) { if (err) { res.status(200).send( {'status':'文件上传失败'}); return; }})
        }
      });
    });
  } catch (err) {
    next(err);
  }
});

//保存新作品：保存源代码及作品名称。req.body为项目JSON源代码,?title=作品名称
router.post("/projects", function (req, res, next) {
  try {
    res.status(500).send({
      status: "error",
      message: "此接口已废弃",
    });
  } catch (err) {
    next(err);
  }
});
//新作品：保存作品素材
router.post("/assets/:filename", function (req, res, next) {
  try {
    var strFileName = "./data/material/asset/" + req.params.filename;
    exists(
      strFileName,
      function (bExists) {
        //if (bExists) {
        //  logger.logger.debug("素材已存在：" + strFileName);
        //  res.status(200).send({ status: "ok" });
        //} else {
        var _data = [];
        req.on("data", function (data) {
          if (data) {
            _data["push"](data);
          }
        });
        req.on("end", function () {
          let content = Buffer["concat"](_data);
          writeFile(strFileName, content, function (err) {
            if (err) {
              res.send(404);
              //logger.logger.debug("素材保存失败：" + strFileName);
            } else {
              S3update("material/asset/" + req.params.filename, strFileName);

              logger.debug("素材保存成功：" + strFileName);
              res.status(200).send({ status: "ok" });
              //fs.unlink('./data/material/asset/' + req.params.filename,function (err) { if (err) { res.status(200).send( {'status':'文件上传失败'}); return; }})
            }
          });
        });
      }
      //}
    );
  } catch (err) {
    next(err);
  }
});



export default router;
