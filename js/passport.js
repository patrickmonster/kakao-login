const express = require('express');
const router = express.Router();
const logger = require("./winston"); //로그용
const db = require('./db');
const fs = require('fs');
var firebase = require('firebase');

// 인증 미들웨어
const { setSessionTokenName, isLogin, isLoginJSON, isNotLogIn, putCSRF, getCSRF } = require('./middlewares');

setSessionTokenName("user_uuid");// 세션인증키 설정

// 이메일 사용자용 로그인
router.post('/login', (req, res, next) => {
  if(req.body.email && req.body.password){
    firebase.auth().signInWithEmailAndPassword(req.body.email, req.body.password)
      .then(async (result) => {
        //uid, token,time, nickname,img,target
        // req.session.user_id = result.user.uid;
        // req.session.user_data = {
        //   id: result.user.uid,
        //   nickname: result.user.displayName,
        //   profile_image: result.user.photoURL,
        // };
        req.session.user_uuid = await db.func.addUser(result.user.uid,result.user.refreshToken,9999999,result.user.displayName,result.user.photoURL,"email");
        res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
        res.end(`<script>window.location.href="/"</script>`);
      }).catch((error) => {
        var errorCode = error.code;
        var errorMessage = error.message;
        res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
        res.end(`<script>alert("아이디 혹은 비밀번호가 잘못되었습니다!");window.location.href="/"</script>`);
      });
  }else{
    console.log(req.body);
    res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
    res.end(`<script>alert("비밀번호가 공백입니다!");window.location.href="/"</script>`);
  }
});

// 사용자가 소셜 로그인을 요청함
router.get('/login', putCSRF, (req, res, next) => {
  if (!req.session.user_id){
    if(req.query.state=="kakao"){
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
      return res.end(`<script>window.location.href="https://kauth.kakao.com/oauth/authorize?client_id=${db.client_id}&redirect_uri=${db.redirect_uri}&response_type=code&state=kakao"</script>`)
    }else if(req.query.state=="naver"){
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
      return res.end(`<script>window.location.href="https://nid.naver.com/oauth2.0/authorize?client_id=${db.client_id_naver[0]}&response_type=code&redirect_uri=${db.redirect_uri}&state=naver"</script>`)
    }else // 이메일 로그인
      fs.readFile(__dirname + "/../login.html",(err,data)=>{
        if(err) {
          console.error(err);
          res.state(404).end();
        }else res.end(data,"utf-8");
      });
  }else{
    db.func.callDB(db.DB,`SELECT * FROM kakao WHERE user_id='${req.session.user_id}' AND expires_in > now();`,(index,data)=>{
      if(index==0){
        if(data)
          return `SELECT * FROM user_data WHERE user_id='${req.session.user_id}'`;
        else {
          delete req.session.user_data;
          delete req.session.user_id;
          logger.info("사용자 토큰이 만료되거나 데이터가 존재하지 않음!");
          throw new Error("일치하는 사용자가 존재하지 않음!");
        }
      }else if(index==1){
        req.session.user_id = data[0].user_id;// 유저 아이디
        req.session.user_data = {id:""+data[0].user_id,nickname:data[0].user_name,profile_image:data[0].user_img};
        logger.info(`사용자 로그인 ${req.session.user_id}`);
      }
      return false;
    }).then(sucess=>{// 정상적인 요청
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
      res.end(`<script>window.location.href='/'</script>`);
    }).catch(err=>{// 사용자 요청 에런
      res.end(`<script>alert('사용자 토큰이 만료되어 다시 요청합니다!');window.location.href="/login"</script>`)//정상적인 로그인
    });
  }
});

// 사용자 인증
router.get("/sucess", getCSRF, async function(req, res) {
  if (req.query.hasOwnProperty("code")) {
    //승인완료
    const target = req.query.state;
    logger.info(`사용자 승인요청 : ${req.query.code}`); //사용자 승인정보 로그 출력
    const token = await db.func.getToken(req.query.code,req.query.state); // 사용자 승인 정보를 통하여 토큰 발급
    if(!token){
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
      return res.end("설정 정보가 올바르지 않음");// 올바른 토큰이 아님
    }
    const user_data = await db.func.getUserData(token.access_token,req.query.state);// 사용자 정보 가져오기
    if (user_data) {
      req.session.user_uuid = await db.func.addUser(user_data.id, token.refresh_token,
        token.refresh_token_expires_in==undefined? 9999999:token.refresh_token_expires_in,
        user_data.properties.nickname,user_data.properties.profile_image,target);
      console.log(req.session.user_uuid,"신규 혹은 기존 사용자!");
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
      res.end(`<script>window.location.href="/"</script>`);
    } else {
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
      res.end("설정 정보가 올바르지 않음");
    }
  } else if (req.query.hasOwnProperty("token")){// 구글 인증요청
    if(req.query.hasOwnProperty("status") && req.query.status == "google"){
      var credential = firebase.auth.GoogleAuthProvider.credential(req.query.token);
      firebase.auth().signInWithCredential(credential).then(async (result)=>{
        req.session.user_uuid = await db.func.addUser(result.user.uid,result.user.refreshToken,
          result.additionalUserInfo.profile.exp-result.additionalUserInfo.profile.iat,
          result.user.displayName,result.user.photoURL,"google");
        res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
        res.end(`<script>window.location.href="/"</script>`);
      }).catch((error) => {
        res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
        res.end(`<script>window.location.href="/"</script>`);
      });
    }else {//잘못된 접근
      res.end(`<script>window.location.href="/"</script>`);
    }
  } else {
    //승인실패!
    res.end(`<script>window.location.href="/"</script>`);
  }
});

// 사용자 생성
router.post("/create", (req, res, next) => {
  if (req.body.email&& req.body.password) {//사용자 이메일/ 데이터
    firebase.auth().createUserWithEmailAndPassword(req.body.email,req.body.password).then(async (result)=>{// 파이어 베이스 인증
      var user = firebase.auth().currentUser;
      user.updateProfile({// 사용자 프로필 업데이트
        displayName : req.body.userName,
        photoURL : req.body.photoURL
      }).then(()=>{
        logger.info(`사용자 지정이 완료됨. ${result.user.uid}`);
      }).catch(err=>{logger.error(err)});
      req.session.user_uuid = await db.func.addUser(result.user.uid,result.user.refreshToken,9999999,req.body.userName,req.body.photoURL,"google");//사용자 정보 업데이트
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
    res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
    res.end(`<script>alert("사용자 생성에 실패하였습니다!");window.location.href="/"</script>`);
  }
});



// 사용자 로그 아웃
router.get("/logout", (req, res, next) => {
  if (req.session.user_uuid) {
    logger.info(`사용자 로그아웃 ${req.session.user_uuid}`);
    delete req.session.user_uuid;
    // delete req.session.user_data; // 사용자 데이터 제거
  }
  res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
  res.end(`<script>window.location.href="/"</script>`);
});

// 사용자 연결 해제
router.get("/clear", async (req, res, next) => {
  const uuid = req.session.user_uuid;

  // 세션 로그인 정보 제거
  delete req.session.user_uuid;
  // delete req.session.user_data;
  db.func.callDB(db.DB,`SELECT target, refresh_token FROM kakao WHERE user_uuid='${uuid}';`,(index,data)=>{
    if(index==0){
      return `DELETE FROM user_data WHERE user_uuid='${uuid}';DELETE FROM kakao WHERE user_uuid='${uuid}';`;
    }else return false;
  }).then(sucess=>{
    logger.info(`사용자를 제거 ${uuid}`);
  }).catch(err=>{
    logger.error(err);
    console.log(`사용자 제거 처리중, 에러가 발생함!`);
  });
  res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
  res.end(`<script>window.location.href="/"</script>`);
});

// 사용자 정보 가져오기 - 사용자 프로필사진 등
/// 리턴타입 : json
router.get("/user", (req, res) => {
  // 사용자 검색
  if(req.session.user_uuid){// 기본 인증
    db.func.callDB(db.DB,`SELECT * FROM user_data WHERE user_uuid='${req.session.user_uuid}'`).then(data=>{// 사용자 검색 디비
      if(data)
        res.json({id: data[0].user_id,nickname: data[0].user_name,profile_image: data[0].user_img});
      else res.json({id: 0,nickname: "None user",profile_image: "http://placehold.it/640x640"});
    }).catch(err=>{
      res.json({id: 0,nickname: "None user",profile_image: "http://placehold.it/640x640"});
    });
  }
});

module.exports = router
