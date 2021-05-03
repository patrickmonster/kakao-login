const express = require("express");
const router = express.Router();
// //지정된 사용자로 로그인(임시)
// const { Client } = require("pg");
const logger = require("../winston"); //로그용
const db = require("../db");
const axios = require("axios");


//데이터베이스용
const DB = {
};

// 딕셔너리 오브젝트 key값 변경
const changeObjectEleName=function(obj,oldName,newName){
  if(!obj.hasOwnProperty(oldName))return obj
  Object.defineProperty(
    obj, newName, Object.getOwnPropertyDescriptor(obj,oldName)
  );
  delete obj[oldName];
  return obj;
}
const regExp = /[\{\}\[\]\/?.,;:|\)*~`!^\-+<>@\#$%&\\\=\(\'\"]/gi;

// 단어정보를 불러옴
router.get("/load", (req, res, next) => {
  if(!req.query.page) req.query.page = 1;
  var id = req.session.user_id;
  db.func.callDB(DB,`SELECT LXPER_WORD_ID, LEMMA, KO_DEF, EN_DEF FROM dmj_word LIMIT 30 ${req.query.page!=1?"OFFSET " + (req.query.page*30):""};`).then(data=>{
    if(data)
      res.status(200).json(data);
    else res.status(404).json({"Error":"error"});
  }).catch(err=>{
    res.status(404).json({"Error":"error"});
  });
});

// 사용자 단어 검색
router.post("/search", (req, res, next) => {
  if(req.body.id && req.body.data){
    const content = req.body.data.replace(regExp,"");
  	axios({
  		method: "post",
  		url: "http://lxper.org:5432/match",
  		data:{content}
  	}).then(function(response){// 단무지 API
      if(response.status==200){
        let data = response.data;// 리턴 데이터
        let ids = [];
        for (var i in data)if(data[i].word_id)ids.push(data[i].word_id);
        if(!ids.length){
          res.writeHead(200, {'Content-Type':'application/json; charset=utf-8'});
          res.json([{'lxper_word_id':'0','단어':'Null','국문뜻':'찾지못함','영문뜻':'Null'}]);
          return;
        }
        logger.info(`사용자 요청 데이터 : ${ids.join(",")}`);
        db.func.callDB(DB,`SELECT TERM, KO_DEF, EN_DEF, LXPER_WORD_ID FROM dmj_word WHERE lxper_word_id IN('${ids.join("','")}')`).then(data=>{//DB쿼리 요청
          for (var i in data){
            let word = data[i];
            word = changeObjectEleName(word,"term","단어")
            word = changeObjectEleName(word,"ko_def","국문뜻")
            if(word["en_def"])word["en_def"] = word["en_def"].split("\\n")[0];
            word = changeObjectEleName(word,"en_def","영문뜻");
          }
          res.json(data);
        }).catch(err=>{// 단어 불러오기 실패
          logger.error(err);
          res.writeHead(200, {'Content-Type':'application/json; charset=utf-8'});
          res.end(JSON.stringify([{'lxper_word_id':'0','단어':'Null','국문뜻':'찾지못함','영문뜻':'Null'}]));
        });
      }
    }).catch(function(err){// API 요청 실패
      logger.error(err);
      res.writeHead(404);
    });
  }else{
    res.writeHead(404);
  }
});

module.exports = router;
