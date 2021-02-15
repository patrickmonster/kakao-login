/* session\app.js */
const express = require("express");
const session = require("express-session");
const FileStore = require("session-file-store")(session);

const helmet = require("helmet");

const logger = require("./js/winston"); //로그용

const app = express();

app.use(express.json());
app.use(express.urlencoded({extended:false}));
app.disable("x-powered-by");// Express 사용정보 숨기기
app.use(helmet.frameguard("SAMEORIGIN"));//ifram 사용 호출 제한
app.use(helmet.noSniff()); // 파일 형식 추측 제한


const passportRouter = require("./js/passport") // 사용자 인증 관련
const db = require("./js/db"); // 디비 / 사용자 API
const loadRouter = require("./js/content/load");// 단어 검색 / 문장 검색

var firebase = require('firebase');
firebase.initializeApp(db.firebaseConfig);

firebase.auth().onAuthStateChanged((firebaseUser) => {//파이어베이스
  logger.info("사용자 : " + (firebaseUser? firebaseUser.uid : "None"));
});

app.use(express.json()); // 바디파서
app.use( // 세션 스토어
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


// 사용자 인증
app.use("/", passportRouter); // 사용자 인증 관련
app.use('/',loadRouter);// 단어검색

//사용자 생성
app.get("/create", (req, res, next) => {
  logger.http(`${JSON.stringify(req.headers)} BODY : ${JSON.stringify(req.body)}`);// 헤더 기록
  if (req.query.client !== db.client_id)
    return res.sendFile(__dirname + "/html/create.html");
  var data = db.func.newUser(res);
  data.then(d=>{
    res.end(`사용자 생성됨 : ${d.id} ${d.token}`);
  });
});

// 사용자 정보 취득
// 기본 이미지 취득
app.get("/img", (req, res, next) => {
  if(req.query.src=="naver"){
    res.sendFile(__dirname + "/image/naver_login.png");
  }else if(req.query.src=="kakao"){
    res.sendFile(__dirname + "/image/kakao_login.png");
  }else res.sendFile(__dirname + "/image/none.png");
});



app.listen(3000, () => {
  logger.info("start server 3000port");
});
