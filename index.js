/* session\app.js */
const express = require("express");
const session = require("express-session");
const FileStore = require("session-file-store")(session);
const { Client } = require("pg");

const logger = require("./js/winston"); //로그용

require("date-utils");
const app = express();

const sucessRouter = require("./js/sucess");
const loginRouter = require("./js/login");
const loginPostRouter = require("./js/loginPOST");
const logoutRouter = require("./js/logout");
const userRouter = require("./js/user");
const setRouter = require("./js/set");
const createRouter = require("./js/create");
const clearRouter = require("./js/clear");
const db = require("./js/db");

const surchRouter = require("./js/surch");


var firebase = require('firebase');
firebase.initializeApp(db.firebaseConfig);

firebase.auth().onAuthStateChanged((firebaseUser) => {//파이어베이스
  logger.info("사용자 : " + (firebaseUser? firebaseUser.uid : "None"));
});

app.use(express.json());
app.use(
  session({
    secret: "test lxper",
    resave: false,
    saveUninitialized: true,
    store: new FileStore(),
  })
);

app.get("/", (req, res, next) => { // 매인화면
  logger.http(`${JSON.stringify(req.headers)} BODY : ${JSON.stringify(req.body)}`);// 헤더 기록
  if (!req.session.user_data) {
    res.sendFile(__dirname + (req.session.user_id ? "/html/login2.html" : "/html/login.html"));
  } else {
    res.sendFile(__dirname + "/html/index.html");
  }
});

//라우터 그룹
app.get("/sucess", sucessRouter);
//로그인
app.get("/login", loginRouter);
app.post('/login',loginPostRouter);
app.get("/logout",logoutRouter);
app.get('/user', userRouter);

app.post("/search", surchRouter);
// app.get("/set", setRouter);

// 정보 파기 및 연결 해제
app.get("/clear",clearRouter);
app.post("/create", createRouter);
//임시 사용자 생성
app.get("/create", (req, res, next) => {
  logger.http(`${JSON.stringify(req.headers)} BODY : ${JSON.stringify(req.body)}`);// 헤더 기록
  if (req.query.client !== db.client_id) {
    res.sendFile(__dirname + "/html/create.html")
    return;
  }
  var data = db.func.newUser(res);
  data.then(d=>{
    res.end(`사용자 생성됨 : ${d.id} ${d.token}`);
  });
});

app.get("/img", (req, res, next) => {
  // res.writeHead(200, {'Content-Type':'image/png'});
  if(req.query.src=="naver"){
    res.sendFile(__dirname + "/image/naver_login.png")
  }else if(req.query.src=="kakao"){
    res.sendFile(__dirname + "/image/kakao_login.png")
  }else {
    res.sendFile(__dirname + "/image/none.png")
  }
});



app.listen(3000, () => {
  logger.info("start server 3000port");
});
