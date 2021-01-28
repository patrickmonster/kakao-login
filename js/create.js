const express = require("express");
const router = express.Router();
const logger = require("./winston"); //로그용
const db = require("./db");
// //지정된 사용자로 로그인(임시)

var firebase = require('firebase');

router.post("/create", (req, res, next) => {
  if (req.body.email&& req.body.password) {//사용자 이메일/ 데이터
    firebase.auth().createUserWithEmailAndPassword(req.body.email,req.body.password).then(result=>{
      var user = firebase.auth().currentUser;
      user.updateProfile({
        displayName : req.body.userName,
        photoURL : req.body.photoURL
      }).then(()=>{
        logger.info(`사용자 지정이 완료됨. ${result.user.uid}`);
      }).catch(err=>{logger.error(err)});
      db.func.addUser(result.user.uid,result.user.refreshToken,9999999,req.body.userName,req.body.photoURL,"google");//사용자 정보 업데이트
      logger.info(`사용자 생성이 완료됨 : ${result.user.uid}`);
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
      res.end(`<script>alert("사용자 생성이 완료되었습니다! : ${req.body.userName}");window.location.href="/"</script>`);
    }).catch(err=>{// 에러부분
      logger.error(err);
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
      res.end(`<script>alert("사용자 생성에 실패하였습니다! ${err}");window.location.href="/"</script>`);
    });
  }else{
    // 잘못된 요청
    logger.error("잘못된 사용자의 요청!");
    res.writeHead(404);
  }
});

module.exports = router;
