const express = require("express");
const router = express.Router();
const db = require("./db");
const logger = require("../winston"); //로그용
const { Client } = require("pg");

router.get("/user", (req, res) => {
  if (
    req.query.hasOwnProperty("client") &&
    req.query.client === db.client_id &&
    req.query.hasOwnProperty("user")
  ) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    var client = new Client(db.DB);
    client.connect();
    client.query(
      `SELECT * FROM user_data WHERE user_id=${req.query.user}`,
      (err, r) => {
        //사용자 정보 불러오기
        if (err) logger.error(err);
        if (r.rowCount) {
          res.end(
            JSON.stringify({
              id: r.rows[0].user_id,
              nickname: r.rows[0].user_name,
              profile_image: r.rows[0].user_img,
            })
          );
        } else {
          res.end(
            JSON.stringify({
              id: 0,
              nickname: "None user",
              profile_image: "http://placehold.it/640x640",
            })
          );
        }
        client.end();
      }
    );
    return;
  }
  if (!req.session.user_data)
    // 잘못된 요청
    res.end(
      JSON.stringify({
        id: 0,
        nickname: "None user",
        profile_image: "http://placehold.it/640x640",
      })
    );
  else {
    res.end(JSON.stringify(req.session.user_data));
  }
});

module.exports = router;
