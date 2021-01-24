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
  if (!req.session.user_id){
    if(req.query.state=="kakao")
      res.end(`<script>window.location.href="https://kauth.kakao.com/oauth/authorize?client_id=${db.client_id}&redirect_uri=${db.redirect_uri}&response_type=code&state=kakao"</script>`)
    else //if(req.query.state=="naver")
      res.end(`<script>window.location.href="https://nid.naver.com/oauth2.0/authorize?client_id=${db.client_id_naver[0]}&response_type=code&redirect_uri=${db.redirect_uri}&state=naver"</script>`)
  }else{
    // var user_data = db.func.getUserDataAdmin(req.session.user_id);
    //사용자 토큰을 갱신하는 코드
    var client = new Client(db.DB);
    client.connect();
    client.query(`SELECT * FROM kakao WHERE user_id=${req.session.user_id} AND expires_in > now();`, (err, r)=>{ // 사용자 정보를 불러옴
      if(err) logger.error(err);
      if(r.rowCount){//존재하는 사용자
        client.query(`SELECT * FROM user_data WHERE user_id=${req.session.user_id}`, (err, r)=>{ // 사용자 정보를 불러옴
          req.session.user_data = {id:r.rows[0].user_id,nickname:r.rows[0].user_name,profile_image:r.rows[0].user_img};
          logger.info(`사용자 로그인 ${req.session.user_id}`)
          res.end(`<script>window.location.href='/'</script>`)
        });
      }else{//존재하지 않는 사용자
        delete req.session.user_data;
        delete req.session.user_id;
        logger.info("사용자 토큰이 만료되거나 데이터가 존재하지 않음!");
        res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
        res.end(`<script>alert('사용자 토큰이 만료되어 다시 요청합니다!');window.location.href="/login"</script>`)//정상적인 로그인
      }
    });
  }
});

module.exports = router
