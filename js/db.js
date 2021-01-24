const { Client } = require("pg");
const request = require("sync-request");
const logger = require("../winston");

//데이터베이스용
const DB = {
  user: "postgres",
  host: "localhost",
  database: "postgres",
  password: "lxper",
  port: 5433,
};

const getRandomInt = (min, max) =>
  Math.floor(Math.random() * (max - min)) + min;

const redirect_uri = "http://localhost:3000/sucess";
const client_id = "5f844bf3c68cccc0a8ff49fc02f33a85";
const client_id_naver = ["wgH_1N2huKWM4R5qsFmP","pFErraLHnE"];//클라이언트 아이디 / 비밀코드

const getToken = function (code,target="kakao") {
  var data;
  if(target=="kakao")
    data = request("POST", "https://kauth.kakao.com/oauth/token", {
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: [
      "grant_type=authorization_code",
      "client_id=" + client_id,
      "redirect_uri=" + redirect_uri,
      "code=" + code,
    ].join("&"),
  });
  else data = request("GET", `https://nid.naver.com/oauth2.0/token?client_id=${client_id_naver[0]}&client_secret=${client_id_naver[1]}&grant_type=authorization_code&state=naver&code=${code}`);
  if (data.statusCode != 200) {
    logger.error(`토큰 정보 교환에 실패함 : ${code}`);
    return false;
  }
  data = data.getBody("utf8");
  logger.info(`토큰 정보 요청${data}`);
  return JSON.parse(data); // 토큰 데이터(갱신용 데이터)
};

//토큰 갱신
const refreshToken = function (refresh_token,target="kakao") {
  var data;
  if(target=="kakao")data = request("POST", "https://kauth.kakao.com/oauth/token", {
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=utf-8",
      },
      body: [
        "grant_type=refresh_token",
        "client_id=" + client_id,
        "refresh_token=" + refresh_token,
      ].join("&"),
    });
  else data = request("GET", `https://nid.naver.com/oauth2.0/token?grant_type=refresh_token&client_id=${client_id_naver[0]}&client_secret=${client_id_naver[1]}&refresh_token=${refresh_token}`);
  if (data.statusCode != 200) {
    logger.error(`토큰 갱신에 실패함 : ${refresh_token}`);
    return false;
  }
  data = data.getBody("utf8");
  logger.info(`${data}`);
  return JSON.parse(data);
};
//사용자 정보
const getUserData = function (token,target="kakao"){
  var data;
  if(target=="kakao")
    data = request("POST", "https://kapi.kakao.com/v2/user/me", {
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
  });
  else data = request("GET", `https://openapi.naver.com/v1/nid/me`, {
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
  });
  if (data.statusCode != 200) {
    logger.error(`사용자 정보 요청에 실패함 : ${token}`);
    return false;
  }
  data = JSON.parse(data.getBody("utf8"));
  if(target=="naver"){
      data.id = data.response.id;
      data.properties = data.response;
  }
  return data;
}
// 사용자 정보를 불러옴
// const getUserDataAdmin = function (id) {
//   var data = request("POST", "https://kapi.kakao.com/v2/user/me", {
//     headers: {
//       "content-type": "application/x-www-form-urlencoded;charset=utf-8",
//       Authorization: `KakaoAK d9b400e9191ce1bf5a9bb10d34d1b940`,
//     },
//     body: `target_id_type=user_id&target_id=${id}&property_keys=["properties.nickname","properties.profile_image"]`,
//   });
//   if (data.statusCode != 200) {
//     logger.error(`사용자 정보 요청에 실패함 : ${id}`);
//     return false;
//   }
//   data = data.getBody("utf8");
//   logger.info(`${data}`);
//   return JSON.parse(data); // 토큰 데이터(갱신용 데이터)
// };

const deleteUserData = function (refresh_token,target="kakao") {
  var data, token = refreshToken(refresh_token,target).access_token;
  if(!token){
    // logger.error(`토큰 갱신에 실패함! ${refresh_token}`)
    return;
  }
  if(target=="kakao") data = request("POST", "https://kapi.kakao.com/v1/user/unlink", {
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${token}`,
      },
    });
  else data = request("GET", `https://nid.naver.com/oauth2.0/token?grant_type=delete&client_id=${client_id_naver[0]}&client_secret=${client_id_naver[1]}&access_token=${token}&service_provider=NAVER`);
  if (data.statusCode != 200) {
    logger.error(`사용자 정보 삭제 요청에 실패함 : ${token}`);
  } else logger.info(`사용자 정보 삭제 요청에 성공함 : ${token}`);
};

const newUser = async function (reqs) {
  var token = Math.random().toString(36).substr(2, 11);
  var id = getRandomInt(10, 1000000000);
  var client = new Client(DB);
  client.connect();
  client.query(
    `INSERT INTO user_data (user_name, user_img, user_id) VALUES ('임시사용자${id}', 'http://placehold.it/640x640', '${id}')`,
    (err, req) => {
      if (err) logger.error(err);
      client.query(
        `INSERT INTO kakao (refresh_token, expires_in, user_id) VALUES ('${token}', now() + '5183999 second', ${id})`,
        (err, req) => {
          if (err) logger.error(err);
          logger.info(`신규 사용자 (임시) ${id}`);
          client.end();
        }
      );
    }
  );
  return { id:id, token:token };
};

module.exports = {
  DB,
  redirect_uri,
  client_id,
  client_id_naver,
  func: {
    deleteUserData,
    getUserData,
    // getUserDataAdmin,
    refreshToken,
    getToken,
    newUser,
    getRandomInt,
  },
};
