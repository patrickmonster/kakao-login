const { Client } = require("pg");
// const request = require("sync-request");// 대체

const axios = require("axios");
const logger = require("./winston");

const { v4: uuidv4 } = require('uuid');

//데이터베이스용
const DB = {
  user: "postgres",
  host: "localhost",
  database: "postgres",
  password: "lxper",
  port: 5433,
};

var firebaseConfig = {// 인증키
  apiKey: "AIzaSyCAE2pw2lrxJlBTyV_DX0wj9jtirv9Ly2E",
  authDomain: "work-bcf91.firebaseapp.com",
  projectId: "work-bcf91",
  storageBucket: "work-bcf91.appspot.com",
  messagingSenderId: "308162586887",
  appId: "1:308162586887:web:daf5e1ed06b012fc8c7da2",
  measurementId: "G-V98N6RVWJZ"
};

const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min)) + min;

const redirect_uri = "http://patrickmonster.site/sucess";
const client_id = "5f844bf3c68cccc0a8ff49fc02f33a85";// 카카오용 클라이언트 아이디
const client_id_naver = ["wgH_1N2huKWM4R5qsFmP","pFErraLHnE"];//클라이언트 아이디 / 비밀코드

/*
디비 반복 쿼리를 처리하는 함수
*/
async function callDB(db,query,func,callLimit=10){
  const client = new Client(db);
  client.connect(); // 디비 연결

  let call = 0;//함수호출 횟수
  let callbackData = false;
  let nextQuery = query;

  do{
    try{// 쿼리문 예외처리
      callbackData = (await client.query(nextQuery)).rows; // 쿼리 실행
    }catch(err){// 예외처리
      logger.error(err);
      console.log(`${call}번째 쿼리 처리중, 문제가 발생함! - ${nextQuery}`);
      if(typeof func === "function")
        nextQuery = func((call*-1),callbackData); // 다음쿼리를 준비
      if(!nextQuery)break;// 문제의 쿼리를 처리하지 않는 경우
    }
    if(typeof func === "function")
      nextQuery = await func(call++,(callbackData && callbackData.length)?callbackData:undefined); // 다음쿼리를 준비
    else nextQuery = false;
  }while(call <= callLimit && nextQuery);// 호출횟수가 넘거나, 다음쿼리가 없을때

  client.end();// 디비연결 해제
  if(callbackData && callbackData.length)
    return callbackData;
  else return false;
}

/*
임시코드를 사용하여 실제 토큰을 서버에 요청함
*/
async function getToken(code,target="kakao") {
  var data;
  console.log("토큰요청",target ,code );
  try{
    if(target=="kakao")data = await axios.post("https://kauth.kakao.com/oauth/token",
      `grant_type=authorization_code&client_id=${client_id}&redirect_uri=${redirect_uri}&code=${code}`,// 필요 데이터
      {headers:{"content-type": "application/x-www-form-urlencoded;charset=utf-8"}});
    else data = await axios({
      method: "GET",url:`https://nid.naver.com/oauth2.0/token?client_id=${client_id_naver[0]}&client_secret=${client_id_naver[1]}&grant_type=authorization_code&state=naver&code=${code}`
    });
  }catch(err){//요청 에러
    console.log(err.response);
    return false;
  }
  if (data.status != 200) {
    logger.error(`토큰 정보 교환에 실패함 : ${code} ${JSON.stringify(data.data)}`);// 기록으로 남겨, 사용자 로그인 실패 여부 확인
    return false;
  }
  logger.info(`토큰 정보 요청${JSON.stringify(data.data)}`);
  return data.data; // 토큰 데이터(갱신용 데이터)
};

/*
사용자 토큰 갱신
*/
async function refreshToken(refresh_token,target="kakao") {
  var data;
  if(target=="google")return;
  if(target=="kakao")data = await axios({
    method: "POST",url:"https://kauth.kakao.com/oauth/token",
    headers:{"content-type": "application/x-www-form-urlencoded;charset=utf-8"},
    data:`grant_type=refresh_token&client_id=${client_id}&redirect_uri=${redirect_uri}&code=${code}`
  });
  else data = await axios({
    method: "GET",url:`https://nid.naver.com/oauth2.0/token?grant_type=refresh_token&client_id=${client_id_naver[0]}&client_secret=${client_id_naver[1]}&refresh_token=${refresh_token}`
  });
  if (data.status != 200) {
    logger.error(`토큰 갱신에 실패함 : ${refresh_token} ${JSON.stringify(data.data)}`);
    return false;
  }
  return data.data;// 토큰정보 리턴
};

/*
토큰기반 사용자 데이터를 불러옴
*/
const getUserData = async function (token,target="kakao"){
  if(target=="google")return {};
  let data =  await axios.post(target=="kakao" ? "https://kapi.kakao.com/v2/user/me" : "https://openapi.naver.com/v1/nid/me","",{
    headers:{
      "content-type": "application/x-www-form-urlencoded;charset=utf-8",
      Authorization: `Bearer ${token}`
    }
  });
  if (data.status != 200) {
    logger.error(`사용자 정보 요청에 실패함 : ${token}`);
    return false;
  }
  data = data.data;
  if(target=="naver"){
      data.id = data.response.id;
      data.properties = data.response;
  }
  return data;
}

/*
  사용자 연결을 해제함
*/
const deleteUserData = async function (refresh_token,target="kakao") {
  if(target=="google"){
    var user = require('firebase').auth().currentUser;
    if(!user)return;
    user.delete().catch(function(error){
      logger.error(error);
    });
    return;
  }
  var data, token = refreshToken(refresh_token,target).access_token;
  if(!token){
    logger.error(`토큰 갱신에 실패함! ${refresh_token}`)
    return;
  }
  if(target=="kakao") data = await axios({
    method:"POST", url:"https://kapi.kakao.com/v1/user/unlink",
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=utf-8",
      Authorization: `Bearer ${token}`
    }
  });
  else data = await axios({
    method:"GET", url:`https://nid.naver.com/oauth2.0/token?grant_type=delete&client_id=${client_id_naver[0]}&client_secret=${client_id_naver[1]}&access_token=${token}&service_provider=NAVER`,
  });
  if (data.status != 200) {
    logger.error(`사용자 정보 삭제 요청에 실패함 : ${token}`);
  } else logger.info(`사용자 정보 삭제 요청에 성공함 : ${token}`);
};

// 신규유저는 추가하고/ 기존유저는 업데이트
async function addUser(uid, token,time, nickname,img,target){
  const uuid = uuidv4();
  const query = await callDB(DB, `SELECT * from kakao WHERE user_id='${uid}'`,(index,data)=>{
    if(index==0){
      if(data && data.length)
        return `UPDATE user_data SET user_uuid='${uuid}', user_name='${nickname}', user_img='${img}' WHERE user_id='${uid}';
          UPDATE kakao SET refresh_token='${token}', user_uuid='${uuid}', expires_in=now() + '${time} second' WHERE user_id='${uid}';`;
      else return `INSERT INTO user_data (user_name, user_img, user_id,user_uuid) VALUES ('${nickname || "닉네임이 지정되지 않음"}', '${img || "http://placehold.it/640x640"}', '${uid}', '${uuid}');
          INSERT INTO kakao (refresh_token, expires_in, user_id, target,user_uuid) VALUES ('${token}',  now() + '${time} second', '${uid}', '${target}','${uuid}')`;
    }else return false; // 다른쿼리는 처리하지 않음
  });
  return uuid;
}

module.exports = {
  DB,
  redirect_uri,
  client_id,
  client_id_naver,
  firebaseConfig,
  func: {
    deleteUserData,
    getUserData,
    refreshToken,
    getToken,
    getRandomInt,
    addUser,
    callDB,
  },
};
