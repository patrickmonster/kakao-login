const express = require("express");
const router = express.Router();
const logger = require("./winston");

const axios = require("axios");
const { Client } = require("pg");


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
//사용자 검색
const regExp = /[\{\}\[\]\/?.,;:|\)*~`!^\-+<>@\#$%&\\\=\(\'\"]/gi;
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
        // var qury = {};
        // var ids = [];
        // for (var i in data)if(data[i].word_id && !qury[data[i].text])qury[data[i].text] = data[i].word_id;// 단어 중복제거 /
        // for (var i in qury)ids.push(qury[i]);
        logger.info(`사용자 요청 데이터 : ${ids.join(",")}`);
        var client = new Client(DB);
        client.connect();
        client.query(`SELECT TERM, KO_DEF, EN_DEF, LXPER_WORD_ID FROM dmj_word WHERE lxper_word_id IN('${ids.join("','")}')`,(err, req) => {
            // 사용자 데이터 매칭
            res.writeHead(200, {'Content-Type':'application/json; charset=utf-8'});
            if (err) {
              logger.error(err);
              res.end("[{'lxper_word_id':'0','단어:'Null','국문뜻':'찾지못함','영문뜻':'Null'}]");
            }else{
              for (var i in req.rows){
                var word = req.rows[i];
                word = changeObjectEleName(word,"term","단어")
                word = changeObjectEleName(word,"ko_def","국문뜻")
                if(word["en_def"])word["en_def"] = word["en_def"].split("\\n")[0];
                word = changeObjectEleName(word,"en_def","영문뜻");
              }
              res.end(JSON.stringify(req.rows));
            }
            client.end();
          }
        );
      }
    }).catch(function(err){
      logger.error(err);

    });
  }else{
    res.writeHead(404);
  }
});

module.exports = router;
