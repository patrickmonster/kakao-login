const express = require('express');
const { Client } = require("pg");
const router = express.Router();
const logger = require("../winston"); //로그용
const db = require('./db');

// router.get 으로 사용합니다
router.get('/login', (req, res, next) => {
  if(req.query.hasOwnProperty("user") && req.query.hasOwnProperty("client") && req.query.client === db.client_id){
    req.session.user_id = req.query.user;
    res.end("<script>window.location.href='/login'</script>");
    return;
  }
  if (!req.session.user_id)
    res.end(`<script>window.location.href="https://kauth.kakao.com/oauth/authorize?client_id=${db.client_id}&redirect_uri=${db.redirect_uri}&response_type=code"</script>`)
  else{
    var user_data = db.func.getUserDataAdmin(req.session.user_id);
    var client = new Client(db.DB);
    client.connect();
    if(!user_data){//디비에서 찾음
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
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
      client.end();
    });
  }
});

module.exports = router
