const express = require('express');
const router = express.Router();
const logger = require("./winston"); //로그용
const db = require('./db');
const fs = require('fs');
var firebase = require('firebase');

router.post('/login', (req, res, next) => {
  if(req.body.email && req.body.password){
    firebase.auth().signInWithEmailAndPassword(req.body.email, req.body.password)
      .then((result) => {
        //uid, token,time, nickname,img,target
        req.session.user_id = result.user.uid;
        req.session.user_data = {
          id: result.user.uid,
          nickname: result.user.displayName,
          profile_image: result.user.photoURL,
        };
        db.func.addUser(result.user.uid,result.user.refreshToken,9999999,result.user.displayName,result.user.photoURL,"google");
        res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
        res.end(`<script>window.location.href="/"</script>`);
      })
      .catch((error) => {
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

router.get('/login', (req, res, next) => {
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
        if(data.rowCount)
          return `SELECT * FROM user_data WHERE user_id='${req.session.user_id}'`;
        else {
          delete req.session.user_data;
          delete req.session.user_id;
          logger.info("사용자 토큰이 만료되거나 데이터가 존재하지 않음!");
          throw new Error("일치하는 사용자가 존재하지 않음!");
        }
      }else if(index==1){
        req.session.user_id = data.rows[0].user_id;// 유저 아이디
        req.session.user_data = {id:""+data.rows[0].user_id,nickname:data.rows[0].user_name,profile_image:data.rows[0].user_img};
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
router.get("/sucess", async function(req, res) {
  logger.http(`${JSON.stringify(req.headers)} BODY : ${JSON.stringify(req.body)}`);// 헤더 기록
  if (req.query.hasOwnProperty("code")) {
    //승인완료
    const target = req.query.state;
    logger.info(`사용자 승인요청 : ${req.query.code}`); //사용자 승인정보 로그 출력
    console.log(`사용자 승인요청 : ${req.query.code}`);
    // const db.func.getToken(req.query.code,req.query.state);
    const token = await db.func.getToken(req.query.code,req.query.state); // 사용자 승인 정보를 통하여 토큰 발급
    if(!token)return res.end("설정 정보가 올바르지 않음");// 올바른 토큰이 아님
    const user_data = await db.func.getUserData(token.access_token,req.query.state);// 사용자 정보 가져오기
    // console.log(user_data);
    if (user_data) {
      console.log(user_data);
      req.session.user_id = user_data.id;
      req.session.user_data = {
        id: user_data.id,
        nickname: user_data.properties.nickname,
        profile_image: user_data.properties.profile_image,
      };
      //uid, token,time, nickname,img,target
      db.func.addUser(user_data.id, token.refresh_token, token.refresh_token_expires_in==undefined? 9999999:token.refresh_token_expires_in, user_data.properties.nickname,user_data.properties.profile_image,target);
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
      res.end(`<script>window.location.href="/"</script>`);
    } else {
      res.end("설정 정보가 올바르지 않음");
    }
  } else if (req.query.hasOwnProperty("token")){// 구글 인증요청
    if(req.query.hasOwnProperty("status") && req.query.status == "google"){
      var credential = firebase.auth.GoogleAuthProvider.credential(req.query.token);
      firebase.auth().signInWithCredential(credential).then((result)=>{
        //uid, token,time, nickname,img,target
        req.session.user_id = result.user.uid;
        req.session.user_data = {
          id: result.user.uid,
          nickname: result.user.displayName,
          profile_image: result.user.photoURL,
        };
        db.func.addUser(result.user.uid,result.user.refreshToken,result.additionalUserInfo.profile.exp-result.additionalUserInfo.profile.iat,result.user.displayName,result.user.photoURL,"google");
        res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
        res.end(`<script>window.location.href="/"</script>`);
      }).catch((error) => {
        var errorCode = error.code;
        var errorMessage = error.message;
        var email = error.email;
        var credential = error.credential;
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
    firebase.auth().createUserWithEmailAndPassword(req.body.email,req.body.password).then(result=>{// 파이어 베이스 인증
      var user = firebase.auth().currentUser;
      user.updateProfile({// 사용자 프로필 업데이트
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
    console.log(req);
    // 잘못된 요청
    logger.error("잘못된 사용자의 요청!");
    res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
    res.end(`<script>alert("사용자 생성에 실패하였습니다!");window.location.href="/"</script>`);
  }
});



// 사용자 로그 아웃
router.get("/logout", (req, res, next) => {
  logger.http(`${JSON.stringify(req.headers)} BODY : ${JSON.stringify(req.body)}`);// 헤더 기록
  if (req.session.user_data) {
    delete req.session.user_id;
    delete req.session.user_data; // 사용자 데이터 제거
    logger.info(`사용자 로그아웃 ${req.session.user_id}`);
  }
  res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
  res.end(`<script>window.location.href="/"</script>`);
});

// 사용자 연결 해제
router.get("/clear", async (req, res, next) => {
  logger.http(`${JSON.stringify(req.headers)} BODY : ${req.body}`);// 헤더 기록
  const id = req.session.user_id;

  // 세션 로그인 정보 제거
  delete req.session.user_id;
  delete req.session.user_data;

  db.callDB(db.DB,`SELECT target, refresh_token FROM kakao WHERE user_id='${id}';`,(index,data)=>{
    if(index==0){
      return `DELETE FROM user_data WHERE user_id='${id}';DELETE FROM kakao WHERE user_id='${id}';`;
    }else return false;
  }).then(sucess=>{
    logger.info(`사용자를 제거 ${id}`);
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
  logger.http(`${JSON.stringify(req.headers)} BODY : ${JSON.stringify(req.body)}`);// 헤더 기록
  // 사용자 검색
  if (req.query.hasOwnProperty("client") &&req.query.client === db.client_id &&req.query.hasOwnProperty("user")) {
    db.func.callDB(db.DB,`SELECT * FROM user_data WHERE user_id=${req.query.user}`).then(data=>{// 사용자 검색 디비
      if(data.rowCount)
        res.json({id: data.rows[0].user_id,nickname: data.rows[0].user_name,profile_image: data.rows[0].user_img});
      else res.json({id: 0,nickname: "None user",profile_image: "http://placehold.it/640x640"});
    }).catch(err=>{
      res.json({id: 0,nickname: "None user",profile_image: "http://placehold.it/640x640"});
    });
  }else{
    if (!req.session.user_data)// 로컬 데이터 유무
    res.json({id: 0,nickname: "None user",profile_image: "http://placehold.it/640x640"});
    else res.json(req.session.user_data);
  }
});

module.exports = router
