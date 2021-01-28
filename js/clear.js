const express = require("express");
const router = express.Router();
const logger = require("./winston"); //로그용
const db = require("./db");
// //지정된 사용자로 로그인(임시)
const { Client } = require("pg");


router.get("/clear", (req, res, next) => {
  logger.http(`${JSON.stringify(req.headers)} BODY : ${req.body}`);// 헤더 기록
  var client = new Client(db.DB);
  var id = req.session.user_id;
  client.connect();
  client.query(`SELECT target, refresh_token FROM kakao WHERE user_id='${id}';`, (err,req)=>{// 사용자 데이터 조회
    if (err) logger.error(err);
    else if(req.rowCount){//데이터 존재
      db.func.deleteUserData(req.rows[0].refresh_token,req.rows[0].target);//
      client.query(`DELETE FROM user_data WHERE user_id='${id}';`, (err, req) => {
        if (err) console.log(err);//logger.error(err);
        logger.info(`사용자 정보 파기 ${id}`);
        client.query(`DELETE FROM kakao WHERE user_id='${id}';`, (err, req) => {
          if (err) logger.error(err);
          logger.info(`사용자를 제거 ${id}`);
          client.end();
        });
      });
    }else{//데이터 없음
      logger.info(`사용자 정보가 없음 ${id}`);
    }
  });
  delete req.session.user_id;
  delete req.session.user_data;
  res.end(`<script>window.location.href="/"</script>`);
});

module.exports = router;
