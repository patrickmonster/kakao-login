/* session\app.js */
const express = require("express");
const session = require("express-session");
const FileStore = require("session-file-store")(session);
const { Client } = require("pg");

const bodyParser = require("body-parser"); //바디 파서
const logger = require("./winston"); //로그용

require("date-utils");
const app = express();

const sucessRouter = require("./js/sucess");
const loginRouter = require("./js/login");
const userRouter = require("./js/user");
const setRouter = require("./js/set");
const db = require("./js/db");

app.use(bodyParser.urlencoded({ extended: false }));
app.use(
  session({
    secret: "test lxper",
    resave: false,
    saveUninitialized: true,
    store: new FileStore(),
  })
);

///사용자 정보 요청
///http://kauth.kakao.com/oauth/authorize?client_id=ffba4150bc6349f8c2c8c415fecee642&redirect_uri=http://localhost:3000/sucess&response_type=code

//https://kauth.kakao.com/oauth/authorize?client_id=5f844bf3c68cccc0a8ff49fc02f33a85&redirect_uri=http://localhost:3000/sucess&response_type=code

// vXJV7iwzunxXeF7HPtW0eZ8NX0yUn1jSLsgA1go9cpcAAAF3Hq86aA
// 1Za9aG3ux9liQkTT-GspxXi4LqkV6RIfYVrtXQo9cxgAAAF3Hwl7rw

app.get("/", (req, res, next) => { // 매인화면
  logger.http(`${JSON.stringify(req.headers)} BODY : ${JSON.stringify(req.body)}`);// 헤더 기록
  if (!req.session.user_data) {
    res.end(`<a href="/login">Login for kakao</a>`);
  } else {
    res.sendFile(__dirname + "/index.html");
  }
});

//라우터 그룹
app.get("/sucess", sucessRouter);
//로그인
app.get("/login", loginRouter);
app.get('/user', userRouter);
app.get("/set", setRouter);

//로그아웃
app.get("/logout", (req, res, next) => {
  logger.http(`${JSON.stringify(req.headers)} BODY : ${JSON.stringify(req.body)}`);// 헤더 기록
  if (req.session.user_data) {
    delete req.session.user_data; // 사용자 데이터 제거
    logger.info(`사용자 로그아웃 ${req.session.user_id}`);
  }
  res.end(`<script>window.location.href="/"</script>`);
});

//임시 사용자 생성
app.get("/create", (req, res, next) => {
  logger.http(`${JSON.stringify(req.headers)} BODY : ${JSON.stringify(req.body)}`);// 헤더 기록
  if (req.query.client !== db.client_id) {
    // 인증된 사용자 인지 여부 확인
    res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
    res.end(`Error<script>setTimeout(()=>{window.location.href='/'},5000)</script>`);
    return;
  }
  // var {id, token} = ; // 사용자 호출
  var data = db.func.newUser(res);
  data.then(d=>{
    res.end(`사용자 생성됨 : ${d.id} ${d.id, d.token}`);
  });
});


// 정보 파기 및 연결 해제
app.get("/clear", (req, res, next) => {
  logger.http(`${JSON.stringify(req.headers)} BODY : ${req.body}`);// 헤더 기록
  var client = new Client(db.DB);
  var id = req.session.user_id;
  client.connect();
  client.query(`DELETE FROM user_data WHERE user_id=${id};`, (err, req) => {
    if (err) logger.error(err);
    logger.info(`사용자 정보 파기 ${id}`);
    client.query(`DELETE FROM kakao WHERE user_id=${id};`, (err, req) => {
      if (err) logger.error(err);
      logger.info(`사용자를 제거 ${id}`);
      client.end();
    });
  });
  db.func.deleteUserData(id);
  delete req.session.user_id;
  delete req.session.user_data;
  res.end(`<script>window.location.href="/"</script>`);
});


app.listen(3000, () => {
  logger.info("start server 3000port");
});
