const express = require("express");
const router = express.Router();
// //지정된 사용자로 로그인(임시)
// const { Client } = require("pg");
const db = require("../db");

//데이터베이스용
const DB = {
  user: "postgres",
  host: "101.101.162.238",
  database: "danmooji_dev",
  password: "!xper@2",
  port: 5432,
};

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
  logger.http(`${JSON.stringify(req.headers)} BODY : ${req.body}`);// 헤더 기록
  if(!req.query.page) req.query.page = 1;
  var id = req.session.user_id;
  db.func.callDB(DB,`SELECT LXPER_WORD_ID, LEMMA, KO_DEF, EN_DEF FROM dmj_word LIMIT 30 ${req.query.page!=1?"OFFSET " + (req.query.page*30):""};`).then(data=>{
    if(data.rowCount)
      res.status(200).json(data.rows);
    else res.status(404).json({"Error":"error"});
  }).cache(err=>{
    res.status(404).json({"Error":"error"});
  });
});

router.post("/search", (req, res, next) => {
  if(req.body.id && req.body.data && req.body.id == req.session.user_id){
    logger.http(`${JSON.stringify(req.headers)} BODY : ${JSON.stringify(req.body)}`);// 헤더 기록
    var content = req.body.data.replace(regExp,"");
  	axios({
  		method: "post",
  		url: "http://lxper.org:5432/match",
  		data:{content}
  	}).then(function(response){
      if(response.status==200){
        var data = response.data;// 리턴 데이터
        var ids = [];
        for (var i in data)if(data[i].word_id)ids.push(data[i].word_id);
        if(!ids.length){
          res.writeHead(200, {'Content-Type':'application/json; charset=utf-8'});
          res.end(JSON.stringify([{'lxper_word_id':'0','단어':'Null','국문뜻':'찾지못함','영문뜻':'Null'}]));
          return;
        }
        logger.info(`사용자 요청 데이터 : ${ids.join(",")}`);
        db.func.callDB(DB,`SELECT TERM, KO_DEF, EN_DEF, LXPER_WORD_ID FROM dmj_word WHERE lxper_word_id IN('${ids.join("','")}')`).then(data=>{
          res.writeHead(200, {'Content-Type':'application/json; charset=utf-8'});
          for (var i in req.rows){
            var word = req.rows[i];
            word = changeObjectEleName(word,"term","단어")
            word = changeObjectEleName(word,"ko_def","국문뜻")
            if(word["en_def"])word["en_def"] = word["en_def"].split("\\n")[0];
            word = changeObjectEleName(word,"en_def","영문뜻");
          }
          res.status(200).json(req.rows);
        }).cache(err=>{
          logger.error(err);
          res.writeHead(200, {'Content-Type':'application/json; charset=utf-8'});
          res.end(JSON.stringify([{'lxper_word_id':'0','단어':'Null','국문뜻':'찾지못함','영문뜻':'Null'}]));
        });
      }
    }).catch(function(err){
      logger.error(err);
      res.writeHead(404);
    });
  }else{
    res.writeHead(404);
  }
});

module.exports = router;
