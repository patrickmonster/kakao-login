const express = require("express");
const router = express.Router();
const db = require("./db");
const { Client } = require("pg");
const logger = require("../winston"); //로그용

var firebase = require('firebase');
firebase.initializeApp(db.firebaseConfig);
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
      //uid, token,time, nickname,img,target
      addUser(user_data.id, token, token.refresh_token_expires_in==undefined? 9999999:token.refresh_token_expires_in, user_data.properties.nickname,user_data.properties.profile_image,target);
      res.end(`<script>window.location.href="/"</script>`);
    } else {
      res.end("설정 정보가 올바르지 않음");
    }
  } else if (req.query.hasOwnProperty("token")){// 구글 인증요청
    if(req.query.hasOwnProperty("status") && req.query.status == "google"){
      firebase.auth().onAuthStateChanged((firebaseUser) => {
        var credential = firebase.auth.GoogleAuthProvider.credential(req.query.token);
        firebase.auth().signInWithCredential(credential).then((result)=>{
          //uid, token,time, nickname,img,target
          req.session.user_id = result.user.uid;
          req.session.user_data = {
            id: result.user.uid,
            nickname: result.user.displayName,
            profile_image: result.user.photoURL,
          };
          addUser(result.user.uid,result.user.refreshToken,result.additionalUserInfo.profile.exp-result.additionalUserInfo.profile.iat,result.user.displayName,result.user.photoURL,"google");
          res.end(`<script>window.location.href="/"</script>`);
        }).catch((error) => {
          var errorCode = error.code;
          var errorMessage = error.message;
          var email = error.email;
          var credential = error.credential;
          res.end(`<script>window.location.href="/"</script>`);
        });
      });
    }else {//잘못된 접근
      res.end(`<script>window.location.href="/"</script>`);
    }
  } else {
    //승인실패!
    res.end(`<script>window.location.href="/"</script>`);
  }
});
function addUser(uid, token,time, nickname,img,target){
  var client = new Client(db.DB);
  client.connect();
  client.query(`SELECT * from kakao WHERE user_id='${uid}'`,(err, req) => {
      if(err)console.log(err);
      else if (req.rowCount) {
        client.query(`UPDATE user_data SET user_name='${nickname}', user_img='${img}' WHERE user_id='${uid}'`,(err, req) => {
            if (err) logger.error(err);
            client.query(`UPDATE kakao SET refresh_token='${token}', expires_in=now() + '${time} second' WHERE user_id='${uid}'`,(err, req) => {
                if (err) logger.error(err);
                logger.info(`사용자 정보 업데이트 ${uid}`);
                client.end();
              });// query
          });// query
      } else {
        client.query(`INSERT INTO user_data (user_name, user_img, user_id) VALUES ('${nickname}', '${img}', '${uid}')`,(err, req) => {
            if (err) logger.error(err);
            client.query(`INSERT INTO kakao (refresh_token, expires_in, user_id, target) VALUES ('${token}',  now() + '${time} second', '${uid}', '${target}')`,(err, req) => {
                if (err) console.log(err);
                logger.info(`신규 사용자 ${uid} by ${target}`);
                client.end();
              });//query
          });// query
      }//else
      /// 사용자 정보를 DB에 저장
    }
  );
}

module.exports = router;
