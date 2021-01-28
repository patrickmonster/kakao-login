const express = require("express");
const router = express.Router();
const db = require("./db");
const logger = require("./winston"); //로그용
const { Client } = require("pg");
// //지정된 사용자로 로그인(임시)

router.post("/set", (req, res, next) => {
  logger.info(`사용자 지정 요청:${req.body.user}`);
  logger.http(`${JSON.stringify(req.headers)} BODY : ${JSON.stringify(req.body)}`);// 헤더 기록
  if (req.body.client === client_id && req.body.user) {
    // 인증된 사용자 인지 여부 확인
    var client = new Client(db.DB);
    client.connect();
    client.query(
      `SELECT * FROM user_data WHERE user_id=${req.body.user}`,
      (err, req) => {
        // 임시 사용자 정보를 불러옴
        if (err) {
          logger.error(err);
          res.end(`사용자 DB접근실패`);
        } else {
          if (req.rowCount) {
            req.session.user_id = req.rows.user_id;
            req.session.user_data = {
              id: req.rows.user_id,
              nickname: req.rows.user_name,
              profile_image: req.rows.user_img,
            };
            res.end(`사용자를 지정함!`);
          } else {
            res.end(`사용자를 찾을 수 없음`);
          }
        }
        client.end();
      }
    );
  } else {
    logger.error("사용자의 잘못된 접근");
    res.end(`<script>window.location.href="/"</script>`);
  }
});

module.exports = router;
