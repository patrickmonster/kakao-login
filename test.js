const { Client } = require("pg");

//데이터베이스용
const DB = {
  user: "postgres",
  host: "localhost",
  database: "postgres",
  password: "lxper",
  port: 5433,
};


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
      // logger.error(err);
      console.error(err);
      console.log(`${call}번째 쿼리 처리중, 문제가 발생함! - ${nextQuery}`);
      if(typeof func === "function")
        nextQuery = func((call*-1),callbackData); // 다음쿼리를 준비
      if(!nextQuery)break;// 문제의 쿼리를 처리하지 않는 경우
    }
    if(typeof func === "function")
      nextQuery = await func(call++,callbackData); // 다음쿼리를 준비
    else nextQuery = false;
  }while(call <= callLimit && nextQuery);// 호출횟수가 넘거나, 다음쿼리가 없을때

  client.end();// 디비연결 해제
  return callbackData;
}

callDB(DB,`SELECT * from kakao`,(index,data)=>{
  console.log(index);
}).then(a=>{
  console.log(a);
});
