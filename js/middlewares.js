const { v4: uuidv4 } = require('uuid');
const CSRF_uuid = {}; //csrf 용 uuid 저장소
let session_token_name = "user_login";
// CSRF 방지 토큰 발급

const uuid_time = 1000*60*5;

exports.setSessionTokenName = name => session_token_name = name;

// CSRF 유효시간 ms 5분

// 미들웨어 처리
exports.isLogIn = (req, res, next) => {
  if (req.session[session_token_name]) {
    next();
  } else {// 인증되지 않은 사용자(권한이 없음)
    res.status(401).send('로그인한 사용자만 접근이 가능합니다.');
  }
};
exports.isLogInJSON = (req, res, next) => {
  if (req.session[session_token_name]) {
    next();
  } else {// 인증되지 않은 사용자(권한이 없음)
    res.status(401).json({error:"권한이 적절하지 않음!"});
  }
};

exports.isNotLogIn = (req, res, next) => {
  if (!req.session[session_token_name]) {// 사용자 로그인 여부
    next();
  } else {// 인증된 사용자(잘못된 요청)
    res.status(400).end("잘못된 요청");
  }
};

// CSRF 방지
exports.putCSRF = (req, res, next) =>{
  let uuid;
  do{ uuid = uuidv4()} while(CSRF_uuid[uuid]);// 중복되지 않는 uuid 발급
  console.log(`UUID 발급 ${uuid}`);
  req.session.csrf_token = uuid;
  CSRF_uuid[uuid] = setTimeout(uuid =>{// 종료 타이머
    if(!CSRF_uuid[uuid])return;
    delete CSRF_uuid[uuid];
    console.log(`UUID 만료됨 ${uuid}`);
  }, uuid_time, uuid);
  next();
}

// CSRF 방지
exports.getCSRF = (req, res, next) =>{
  if(req.query.hasOwnProperty("token") && req.query.hasOwnProperty("status") && req.query.status == "google")
    return next();
  if(!req.session.csrf_token || !CSRF_uuid[req.session.csrf_token])
    return res.status(401).end("만료됨");
  console.log(`UUID 만료 ${req.session.csrf_token}`);
  clearTimeout(CSRF_uuid[req.session.csrf_token]);// 타이머 종료
  delete CSRF_uuid[req.session.csrf_token];
  delete req.session.csrf_token;
  next();
}
