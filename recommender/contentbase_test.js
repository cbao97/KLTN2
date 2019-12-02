const ContentBasedRecommender = require("./content-based-recommender/index");
const Vector = require("vector-object");

const recommender = new ContentBasedRecommender({
  minScore: 0.1,
  maxSimilarDocuments: 100
});
var mysql = require('mysql');
var done = false
var con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database : "kltn"
});

var trainingData = [];

function initContentBaseRecommend() {
    
    con.connect( function(err)
    {
        if (err) throw err;
        var sql = "Select id,description_token from test limit 10"
        con.query(sql, function (err, result) {
            if (err) throw err;
            for(i=0;i<result.length;i++)
            {
                let obj = {
                    id: result[i].id,
                    token: result[i].description_token
                };
                trainingData.push(obj); 
                done = true;
            }       
            require('deasync').loopWhile(function(){return !done;});
            if (result.length>0) 
            {              
                var docVector = recommender.trainOpt2(trainingData);
                console.log(docVector)
                var jsonVector = JSON.stringify(docVector)
                var sql_CbVector = "insert into vector(cb_vector) value ( '" + jsonVector +"')"
                con.query(sql_CbVector,function(err,result)
                {
                    if (err) throw err.sqlMessage;
                    console.log("inserted")
                })  
            }
        // recommender.trainOpt(trainingData,3647);
        // const similarDocuments = recommender.getSimilarDocuments(3647, 0, 10);
        // console.log(similarDocuments);
            
        })
    })
    
}

function getContentBaseRecommend(id){
    var docVector 
    con.connect(function(err)
    {
        if (err) throw err;
        var sql = "SELECT cb_vector FROM vector ORDER BY id DESC LIMIT 1 "
        con.query(sql,function(err,result)
        {
            if(err) throw err.sqlMessage
            docVector = JSON.parse(result[0].cb_vector)
            for (i = 0 ; i< docVector.length;i++)
            {   
                docVector[i].vector = new Vector(docVector[i].vector.vector);
            }
            
            recommender.trainOpt3(docVector,id);
            const similarDocuments = recommender.getSimilarDocuments(id, 0, 10);
            console.log(similarDocuments);
        })
    })  
    
    
}

// initContentBaseRecommend();
getContentBaseRecommend(3647)