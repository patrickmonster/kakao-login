/* session\app.js */
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session); // 1

const bodyParser   = require('body-parser'); //바디 파서
const request = require('sync-request');
const { Client } = require('pg');
const logger = require("./winston");//로그용

const exec = require('child_process');// 디비 처리용 보조 스레드


require("date-utils")
const app = express();


//데이터베이스용
const DB_kakao = {
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: 'lxper',
  port: 5433,
}
const redirect_uri = "http://localhost:3000/sucess";
const client_id = "5f844bf3c68cccc0a8ff49fc02f33a85";

app.use(bodyParser.urlencoded({extended: false}));
app.use(session({
  secret: 'test lxper',
  resave: false,
  saveUninitialized: true,
  store: new FileStore()
}));


const getToken=function(code){
    var data =  request('POST', 'https://kauth.kakao.com/oauth/token', {headers: {'content-type': 'application/x-www-form-urlencoded;charset=utf-8'},body:[
      'grant_type=authorization_code',
      'client_id='+client_id,
      'redirect_uri='+redirect_uri,
      'code='+code
    ].join('&')});
    if(data.statusCode!=200){
      _l(`토큰 정보 교환에 실패함 : ${code}`)
      return false;
    }
    data = data.getBody('utf8');
    logger.info(`토큰 정보 요청${data}`)
    return JSON.parse(data);// 토큰 데이터(갱신용 데이터)
}

//토큰 갱신
const refreshToken=function(refresh_token){
    var data =  request('POST', 'https://kauth.kakao.com/oauth/token', {headers: {'content-type': 'application/x-www-form-urlencoded;charset=utf-8'},body:[
      'grant_type=authorization_code',
      'client_id='+client_id,
      'refresh_token='+refresh_token,
    ].join('&')});
    if(data.statusCode!=200){
      logger.error(`토큰 갱신에 실패함 : ${code}`)
      return false;
    }
    data = data.getBody('utf8');
    _l(`${data}`)
    return JSON.parse(data);
}
//사용자 정보
const getUserData=function(token){
    var data =  request('POST', 'https://kapi.kakao.com/v2/user/me',{
        headers: {'content-type': 'application/x-www-form-urlencoded;charset=utf-8','Authorization':`Bearer ${token}`},
        body:''});
    if(data.statusCode!=200){
      logger.error(`사용자 정보 요청에 실패함 : ${token}`)
      return false;
    }
    data = data.getBody('utf8');
    // _l(`${data}`)
    return JSON.parse(data);// 토큰 데이터(갱신용 데이터)
}
// 사용자 정보를 불러옴
const getUserDataAdmin=function(id){
    var data =  request('POST', 'https://kapi.kakao.com/v2/user/me',{
        headers: {'content-type': 'application/x-www-form-urlencoded;charset=utf-8','Authorization':`KakaoAK d9b400e9191ce1bf5a9bb10d34d1b940`},
        body:`target_id_type=user_id&target_id=${id}&property_keys=["properties.nickname","properties.profile_image"]`});
    if(data.statusCode!=200){
      logger.error(`사용자 정보 요청에 실패함 : ${id}`)
      return false;
    }
    data = data.getBody('utf8');
    logger.info(`${data}`)
    return JSON.parse(data);// 토큰 데이터(갱신용 데이터)
}

const deleteUserData=function(id){
    var data =  request('POST', 'https://kapi.kakao.com/v1/user/unlink',{
        headers: {'content-type':'application/x-www-form-urlencoded','Authorization':'KakaoAK d9b400e9191ce1bf5a9bb10d34d1b940'},
        body:`target_id_type=user_id&target_id=${id}`});
    if(data.statusCode!=200){
      logger.error(`사용자 정보 삭제 요청에 실패함 : ${id}`)
    }else logger.info(`사용자 정보 삭제 요청에 성공함 : ${id}`)
}

///사용자 정보 요청
///http://kauth.kakao.com/oauth/authorize?client_id=ffba4150bc6349f8c2c8c415fecee642&redirect_uri=http://localhost:3000/sucess&response_type=code

//https://kauth.kakao.com/oauth/authorize?client_id=5f844bf3c68cccc0a8ff49fc02f33a85&redirect_uri=http://localhost:3000/sucess&response_type=code

// vXJV7iwzunxXeF7HPtW0eZ8NX0yUn1jSLsgA1go9cpcAAAF3Hq86aA
// 1Za9aG3ux9liQkTT-GspxXi4LqkV6RIfYVrtXQo9cxgAAAF3Hwl7rw

app.get('/', (req, res, next) => {
  if(!req.session.user_data){
    res.end(`<a href="/login">Login for kakao</a>`)
  }else {
    res.sendFile(__dirname + "/index.html");
  }
});
//로그인 승인
app.get('/sucess', (req, res, next) => {
  if(req.query.hasOwnProperty("code")){//승인완료
    logger.info(`사용자 승인요청 : ${req.query.code}`)//사용자 승인정보 로그 출력
    var token = getToken(req.query.code);// 사용자 승인 정보를 통하여 토큰 발급
    var user_data = getUserData(token.access_token);
    if(user_data){
      req.session.user_id = user_data.id;
      req.session.user_data = {id:user_data.id,nickname:user_data.properties.nickname,profile_image:user_data.properties.profile_image}
      var client = new Client(DB_kakao);
      client.connect();
      client.query(`SELECT * from kakao WHERE user_id=${user_data.id}`,(err,req)=>{
        if(req.rowCount){
          client.query(`UPDATE user_data SET user_name='${user_data.properties.nickname}', user_img='${user_data.properties.profile_image}' WHERE user_id=${user_data.id}`,(err,req)=>{
            if(err) logger.error(err)
            client.query(`UPDATE kakao SET refresh_token='${token.refresh_token}', expires_in=now() + '${token.refresh_token_expires_in} second' WHERE user_id=${user_data.id}`, (err, req)=>{
              if(err) logger.error(err);
              logger.info(`사용자 정보 업데이트 ${user_data.id}`)
              client.end();
            });
          });
        }else{
          client.query(`INSERT INTO user_data (user_name, user_img, user_id) VALUES ('${user_data.properties.nickname}', '${user_data.properties.profile_image}', '${user_data.id}')`,(err,req)=>{
            if(err) logger.error(err)
            client.query(`INSERT INTO kakao (refresh_token, expires_in, user_id) VALUES ('${token.refresh_token}',  now() + '${token.refresh_token_expires_in} second', ${user_data.id})`, (err, req)=>{
              if(err) console.log(err);
              logger.info(`신규 사용자 ${user_data.id}`)
              client.end();
            });
          });
        }
        /// 사용자 정보를 DB에 저장

      });
      res.end(`<script>window.location.href="/"</script>`)
    }else{
      res.end("설정 정보가 올바르지 않음")
    }
  }else{//승인실패!
    res.end(`<script>window.location.href="/"</script>`)
  }
});

const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min)) + min;

//임시 사용자 생성
app.get('/create', (req, res, next) => {
  if(req.query.client !== client_id){// 인증된 사용자 인지 여부 확인
    res.send(`Error<script>setTimeout(()=>{window.location.href='/'},5000)</script>`)
    res.end();
    return;
  }
  newUser(res);// 사용자 호출
});

async function newUser(res){
  var token = Math.random().toString(36).substr(2,11);
  var id = getRandomInt(10,1000000000);
  var client = new Client(DB_kakao);
  client.connect();
  client.query(`INSERT INTO user_data (user_name, user_img, user_id) VALUES ('임시사용자${id}', 'http://placehold.it/640x640', '${id}')`,(err,req)=>{
    if(err) logger.error(err);
    client.query(`INSERT INTO kakao (refresh_token, expires_in, user_id) VALUES ('${token}', now() + '5183999 second', ${id})`, (err, req)=>{
      if(err) logger.error(err);
      logger.info(`신규 사용자 (임시) ${id}`)
      client.end();
    });
  });
  res.end(`New user ${id} / ${token}`);
}

// //지정된 사용자로 로그인(임시)
app.post('/set', (req, res, next) =>{
  logger.info(`사용자 지정 요청:${req.body.user}`);
  if(req.body.client === client_id && req.body.user){// 인증된 사용자 인지 여부 확인
    var client = new Client(DB_kakao);
    client.connect();
    client.query(`SELECT * FROM user_data WHERE user_id=${req.body.user}`, (err,req) =>{
      // 임시 사용자 정보를 불러옴
      if(err){
        logger.error(err);
        res.end(`사용자 DB접근실패`);
      }
      else{
        if(req.rowCount){
          req.session.user_id = req.rows.user_id;
          req.session.user_data = {id:req.rows.user_id,nickname:req.rows.user_name,profile_image:req.rows.user_img};
          res.end(`사용자를 지정함!`);
        }else{
          res.end(`사용자를 찾을 수 없음`);
        }
      }
      client.end();
    });
  }else{
    logger.error("사용자의 잘못된 접근")
    res.end(`<script>window.location.href="/"</script>`);
  }
});

// 정보 파기 및 연결 해제
app.get('/clear', (req, res, next) => {
  var client = new Client(DB_kakao);
  var id = req.session.user_id;
  client.connect();
  client.query(`DELETE FROM user_data WHERE user_id=${id};`,(err,req)=>{
    if(err) logger.error(err);
    logger.info(`사용자 정보 파기 ${id}`)
    client.query(`DELETE FROM kakao WHERE user_id=${id};`, (err, req)=>{
      if(err) logger.error(err);
      logger.info(`사용자를 제거 ${id}`)
      client.end();
    });
  });
  deleteUserData(id);
  delete req.session.user_data;
  delete req.session.user_id;
  res.end(`<script>window.location.href="/"</script>`)
});
app.get('/user', (req, res, next) => {
  logger.info
  if(!req.session.user_data)// 잘못된 요청
    res.end(JSON.stringify({id:0,nickname:"None user",profile_image:"http://placehold.it/640x640"}))
  else{
    // if(req.session.user_data)
    res.end(JSON.stringify(req.session.user_data));
  }
});
//로그인
app.get('/login', (req, res, next) => {
  if(req.query.hasOwnProperty("user") && req.query.hasOwnProperty("client") && req.query.client === client_id){
    req.session.user_id = req.query.user;
    res.end("<script>window.location.href='/login'</script>");
    return;
  }
  if (!req.session.user_id)
    res.end(`<script>window.location.href="https://kauth.kakao.com/oauth/authorize?client_id=${client_id}&redirect_uri=${redirect_uri}&response_type=code"</script>`)
  else{
    var user_data = getUserDataAdmin(req.session.user_id);
    if(!user_data){//디비에서 찾음
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
      var client = new Client(DB_kakao);
      client.connect();
      client.query(`SELECT * FROM user_data WHERE user_id=${req.session.user_id}`,(err,r)=>{//사용자 정보 불러오기
        if(err) logger.error(err);
        if(r.rowCount){
          r.rows[0]
          req.session.user_id = r.rows[0].user_id;
          req.session.user_data = {id:r.rows[0].user_id,nickname:r.rows[0].user_name,profile_image:r.rows[0].user_img};
          res.end(`<script>window.location.href='/'</script>`)
          logger.info(`임시 사용자로 로그인 ${req.session.user_id}`)
        }else {
          delete req.session.user_id;
          logger.error(`사용자 정보를 불러오지 못함`)
          res.end("<script>alert('사용자 정보를 불러오지 못함!');window.location.href='/'</script>")
        }
        client.end();
      });
      return;
    }
    req.session.user_data = {id:user_data.id,nickname:user_data.properties.nickname,profile_image:user_data.properties.profile_image}
    var client = new Client(DB_kakao);
    client.connect();
    client.query(`SELECT * FROM kakao WHERE user_id=${user_data.id} AND expires_in < now();`,(err,r)=>{//토큰 만료일
      if(err) logger.error(err);
      if(r.rowCount){
        delete req.session.user_data;
        delete req.session.user_id;
        //로그해제후 로그인 화면으로 전환
        logger.info("사용자 토큰이 만료되어 데이터를 다시 요청");
        res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
        res.end(`<script>alert('사용자 토큰이 만료되어 다시 요청합니다!');window.location.href="/login"</script>`)//정상적인 로그인
      }else{
        res.end(`<script>window.location.href="/"</script>`)//정상적인 로그인
      }
    });
  }
});
//로그아웃
app.get('/logout', (req, res, next) => {
  if (req.session.user_data){
    delete req.session.user_data;// 사용자 데이터 제거
    logger.info(`사용자 로그아웃 ${req.session.user_id}`)
  }
  res.end(`<script>window.location.href="/"</script>`)
});

app.listen(3000, () => {
  logger.info('start server 3000port');
});
