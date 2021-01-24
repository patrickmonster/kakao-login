const express = require("express");
const router = express.Router();
const db = require("./db");
const { Client } = require("pg");
const logger = require("../winston"); //로그용

// router.get 으로 사용합니다
router.get("/sucess", function (req, res) {
  logger.http(`${JSON.stringify(req.headers)} BODY : ${JSON.stringify(req.body)}`);// 헤더 기록
  if (req.query.hasOwnProperty("code")) {
    //승인완료
    logger.info(`사용자 승인요청 : ${req.query.code}`); //사용자 승인정보 로그 출력
    var token = db.func.getToken(req.query.code,req.query.state); // 사용자 승인 정보를 통하여 토큰 발급
    var user_data = db.func.getUserData(token.access_token,req.query.state);
    var target = req.query.state;
    if (user_data) {
      req.session.user_id = user_data.id;
      req.session.user_data = {
        id: user_data.id,
        nickname: user_data.properties.nickname,
        profile_image: user_data.properties.profile_image,
      };
      var client = new Client(db.DB);
      client.connect();
      client.query(
        `SELECT * from kakao WHERE user_id=${user_data.id}`,
        (err, req) => {
          if (req.rowCount) {
            client.query(
              `UPDATE user_data SET user_name='${user_data.properties.nickname}', user_img='${user_data.properties.profile_image}' WHERE user_id=${user_data.id}`,
              (err, req) => {
                if (err) logger.error(err);
                client.query(
                  `UPDATE kakao SET refresh_token='${token.refresh_token}', expires_in=now() + '${token.refresh_token_expires_in==undefined? 9999999:token.refresh_token_expires_in} second' WHERE user_id=${user_data.id}`,
                  (err, req) => {
                    if (err) logger.error(err);
                    logger.info(`사용자 정보 업데이트 ${user_data.id}`);
                    client.end();
                  }
                );
              }
            );
          } else {
            client.query(
              `INSERT INTO user_data (user_name, user_img, user_id) VALUES ('${user_data.properties.nickname}', '${user_data.properties.profile_image}', '${user_data.id}')`,
              (err, req) => {
                if (err) logger.error(err);
                client.query(
                  `INSERT INTO kakao (refresh_token, expires_in, user_id, target) VALUES ('${token.refresh_token}',  now() + '${token.refresh_token_expires_in==undefined? 9999999:token.refresh_token_expires_in} second', ${user_data.id}, '${target}')`,
                  (err, req) => {
                    if (err) console.log(err);
                    logger.info(`신규 사용자 ${user_data.id} by ${target}`);
                    client.end();
                  }
                );
              }
            );
          }
          /// 사용자 정보를 DB에 저장
        }
      );
      res.end(`<script>window.location.href="/"</script>`);
    } else {
      res.end("설정 정보가 올바르지 않음");
    }
  } else {
    //승인실패!
    res.end(`<script>window.location.href="/"</script>`);
  }
});

module.exports = router;
