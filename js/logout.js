const express = require("express");
const router = express.Router();
const logger = require("./winston"); //로그용
// //지정된 사용자로 로그인(임시)

router.get("/logout", (req, res, next) => {
  logger.http(`${JSON.stringify(req.headers)} BODY : ${JSON.stringify(req.body)}`);// 헤더 기록
  if (req.session.user_data) {
    delete req.session.user_data; // 사용자 데이터 제거
    logger.info(`사용자 로그아웃 ${req.session.user_id}`);
  }
  res.end(`<script>window.location.href="/"</script>`);
});

module.exports = router;
