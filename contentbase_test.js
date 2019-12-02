const ContentBasedRecommender = require('content-based-recommender')
const recommender = new ContentBasedRecommender({
  minScore: 0.01,
  maxSimilarDocuments: 100
});

var mysql = require('mysql');

var con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database : "kltn"
});

var trainingData = [];

function getContentBaseRecommend(id) {
    
    con.connect(function(err) {
        if (err) throw err;
        var sql = "Select id,description_token from test limit 1000 "
        con.query(sql, function (err, result) {
        if (err) throw err;
        for(i=0;i<result.length;i++)
        {
            let obj = {
                id: result[i].id,
                content: result[i].description
            };
            trainingData.push(obj);
            console.log(i);
        }
        con.end()
   console.log(trainingData)
    // recommender.train(trainingData);
    // const similarDocuments = recommender.getSimilarDocuments(id, 0, 10);
    // console.log(similarDocuments);
    })})

   
}

getContentBaseRecommend(3647);

