const express = require('express');
const { Client } = require("pg");
const router = express.Router();
const logger = require("./winston"); //로그용
const db = require('./db');
var firebase = require('firebase');

router.post('/login', (req, res, next) => {
  if(req.body.email && req.body.password){
    firebase.auth().signInWithEmailAndPassword(req.body.email, req.body.password)
      .then((result) => {
        //uid, token,time, nickname,img,target
        req.session.user_id = result.user.uid;
        req.session.user_data = {
          id: result.user.uid,
          nickname: result.user.displayName,
          profile_image: result.user.photoURL,
        };
        db.func.addUser(result.user.uid,result.user.refreshToken,9999999,result.user.displayName,result.user.photoURL,"google");
        res.end(`<script>window.location.href="/"</script>`);
      })
      .catch((error) => {
        var errorCode = error.code;
        var errorMessage = error.message;
        res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
        res.end(`<script>alert("아이디 혹은 비밀번호가 잘못되었습니다!");window.location.href="/"</script>`);
      });
      // res.end(`?`)//정상적인 로그인
  }else{
    console.log(req.body);
    res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
    res.end(`<script>alert("비밀번호가 공백입니다!");window.location.href="/"</script>`);
  }
});

module.exports = router
