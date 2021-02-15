const express = require("express");
const router = express.Router();
// //지정된 사용자로 로그인(임시)
const { Client } = require("pg");


//데이터베이스용
const DB = {
  user: "postgres",
  host: "101.101.162.238",
  database: "danmooji_dev",
  password: "!xper@2",
  port: 5432,
};

// 관리자 사용 기록
// router.get("/setting", (req, res, next) => {
//   logger.http(`${JSON.stringify(req.headers)} BODY : ${req.body}`);// 헤더 기록
//   var client = new Client(DB);
//   var id = req.session.user_id;
//   client.connect();
//   client.query(`SELECT target, refresh_token FROM kakao WHERE user_id='${id}';`, (err,req)=>{// 사용자 데이터 조회
//     // SELECT LXPER_WORD_ID, LEMMA, KO_DEF, EN_DEF FROM LIMIT 10;
//
//   });
//   res.end(`<script>window.location.href="/"</script>`);
// });

router.get("/load", (req, res, next) => {
  // logger.http(`${JSON.stringify(req.headers)} BODY : ${req.body}`);// 헤더 기록
  if(!req.query.page) req.query.page = 1;
  var client = new Client(DB);
  var id = req.session.user_id;
  client.connect();
  res.writeHead(200, {'Content-Type':'application/json; charset=utf-8'});
  client.query(`SELECT LXPER_WORD_ID, LEMMA, KO_DEF, EN_DEF FROM dmj_word LIMIT 30 ${req.query.page!=1?"OFFSET " + (req.query.page*30):""};`, (err,req)=>{// 사용자 데이터 조회
    client.end();
    if(err){
      res.end(JSON.stringify({"Error":"error"}));
      console.log(err);
    }else res.end(JSON.stringify(req.rows));
  });
});

module.exports = router;
