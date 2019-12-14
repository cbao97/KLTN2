
var mysql = require('mysql');

var done = false;

var con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database : "kltn"
});
const maxSimilarDocuments = 10;
const ContentBasedRecommender = require("./content-based-recommender/index");
const Vector = require("vector-object");
const recommender = new ContentBasedRecommender({
  minScore: 0.1,
  maxSimilarDocuments: 100
});
con.connect(function(err)
{
    if(err) throw err;
})

const neighbor_num = 4;

function getCollaborativeFilteringResult(user_id){
        let user_arr = [];
        let docs = {};
        let user_idx = 0;
        var sql= "SELECT  Homestay_id,User_id, rating_score FROM `homestay rating` "
        con.query(sql,function(err,result)
        {
            if (err) throw err;
            // Thong ke user da comment
            //console.log(result[0].User_id)
            for (let i = 0; i < result.length; i++) {
                if (user_arr.indexOf(result[i].User_id) <= -1)
                    user_arr.push(result[i].User_id);
                let obj = {};
                obj.item = result[i].Homestay_id;
                obj.rating = result[i].rating_score;
                if (result[i].User_id in docs)
                    docs[result[i].User_id].push(obj);
                else docs[result[i].User_id] = [obj];
            }
            console.log(docs)
            
            user_idx = user_arr.indexOf(user_id);
            
            if (user_idx <= -1)
                console.log("user has not rated any item in recommended item list.");
            else
            //step 1
            var avg_user 
            avg_user =  normalizeDocs(docs, user_arr, user_id) 
            console.log(avg_user) 
            //step 2
            const user_items = docs[user_id];   
            var similarity 
            similarity = getCosinSimilarity(docs, user_items, user_arr, user_id)    
            console.log(similarity)
            //step 3
            var item_need_to_recommend 
            item_need_to_recommend = getItemNeedToRecommend(docs, similarity, user_items, user_id)
            console.log(item_need_to_recommend)
            //step 4
            var result 
            
            result= predict(item_need_to_recommend, avg_user, user_id)
        
            console.log( sort(result))
            result.forEach(item => {
                item.score = (item.score -1)/4;
            });
            if( result.length > maxSimilarDocuments)
            result= result.splice(0,maxSimilarDocuments);
            console.log(result);
        })
}

function  normalizeDocs(docs, user_arr, user_id) {
        //console.time("normalizeDocs " + user_id);
        let avg_user = 0;
        for (let i = 0; i < user_arr.length; i++) {
            let items = docs[user_arr[i]];
            let value = 0;
            for (let j = 0; j < items.length; j++) {
                value += items[j].rating;
            }
            if (user_arr[i] === user_id) {
                avg_user = value / items.length;
            }
            for (let j = 0; j < items.length; j++) {
                items[j].rating = items[j].rating - value / items.length;
            }
        }
        return avg_user;
        // console.timeEnd("normalizeDocs " + user_id);

}
function getCosinSimilarity(docs, user_items, user_arr, user_id) {
           
        console.time("getCosinSimilarity " + user_id);
        let similarity = [];
        let r1 = 0;
        for (let i = 0; i < user_items.length; i++)
            r1 += user_items[i].rating * user_items[i].rating;
        const sqrt_user_rating = Math.sqrt(r1);
        for (let i = 0; i < user_arr.length; i++) {
            if (user_arr[i] !== user_id) {
                let other_user_items = docs[user_arr[i]];
                let same = other_user_items.filter(function (obj) {
                    return user_items.some(function (obj2) {
                        return obj.item === obj2.item;
                    });
                });
                if (same.length > 0) {
                    let r2 = 0;
                    for (let j = 0; j < other_user_items.length; j++)
                        r2 += other_user_items[j].rating * other_user_items[j].rating;
                    const sqrt_other_rating = Math.sqrt(r2);
                    let a = 0;
                    let prod = 0;
                    for (let k = 0; k < same.length; k++) {
                        let item_rating = user_items.filter(item => {
                            if (item.item === same[k].item) return item;
                        });
                        prod += item_rating[0].rating * same[k].rating;
                    }
                    if (prod !== 0) {
                        let sim = prod / (sqrt_other_rating * sqrt_user_rating);
                        similarity.push({
                            user: user_arr[i],
                            sim: sim
                        });
                    }
                }
            }
        }
        similarity.sort(function (a, b) {
            let keyA = a.sim,
                keyB = b.sim;
            if (keyA < keyB) return 1;
            if (keyA > keyB) return -1;
            return 0;
        });
        console.timeEnd("getCosinSimilarity " + user_id);
        return(similarity);
    }

function getItemNeedToRecommend(docs, similarity, user_items, user_id) {
            console.time("getItemNeedToRecommend " + user_id);
            let item_need_to_recommend = [];
            for (let i = 0; i < similarity.length; i++) {
                // Find values that are in docs[similarity[i].user] but not in user_items
                let uniqueResultOne = docs[similarity[i].user].filter(function (obj) {
                    return !user_items.some(function (obj2) {
                        return obj.item === obj2.item;
                    });
                });
                const user = similarity[i].user;
                const sim = similarity[i].sim;
                if (uniqueResultOne.length > 0) {
                    for (let j = 0; j < uniqueResultOne.length; j++) {
                        let obj = item_need_to_recommend.find(
                            obj => obj.item === uniqueResultOne[j].item
                        );
                        if (obj === undefined)
                            item_need_to_recommend.push({
                                item: uniqueResultOne[j].item,
                                users: [
                                    {user: user, sim: sim, rating: uniqueResultOne[j].rating}
                                ]
                            });
                        else
                            obj.users.push({
                                user: user,
                                sim: sim,
                                rating: uniqueResultOne[j].rating
                            });
                    }
                }
            }
            console.timeEnd("getItemNeedToRecommend " + user_id);
            return(item_need_to_recommend);
    };
function predict(item_need_to_recommend, avg_user, user_id) {
    console.time("predict " + user_id);
    let result = [];
    for (let i = 0; i < item_need_to_recommend.length; i++) {
        const users = item_need_to_recommend[i].users;
        if (users.length >= neighbor_num) {
            let r = 0,
                v = 0;
            for (let j = 0; j < neighbor_num; j++) {
                r += users[j].sim * users[j].rating;
                v += Math.abs(users[j].sim);
            }
            result.push({
                id: item_need_to_recommend[i].item,
                score: r / v + avg_user
            });
        }
    }
    console.timeEnd("predict " + user_id);
    return(result);
};

function sort(arr) {
    return new Promise(function (resolve, reject) {
        resolve(arr.sort(compare));
    });
}

function compare(a, b) {
    const ratingA = a.score;
    const ratingB = b.score;
    let comparison = 0;
    if (ratingA > ratingB) {
        comparison = -1;
    } else if (ratingA < ratingB) {
        comparison = 1;
    }
    return comparison;
}
    
//getCollaborativeFilteringResult(1)

function getContentBaseRecommend(id){
    var docVector 
    var sql = "SELECT cb_vector FROM vector ORDER BY id DESC LIMIT 1 "
    con.query(sql,function(err,result){
        if(err) throw err.sqlMessage
        docVector = JSON.parse(result[0].cb_vector)
       
        for (i = 0 ; i< docVector.length;i++)
        {   
            docVector[i].vector = new Vector(docVector[i].vector.vector);
        }
        recommender.trainOpt3(docVector,id);
        const similarDocuments = recommender.getSimilarDocuments(id, 0, 10);
        return(similarDocuments);
    })
}

function getHybridRecommend(user_id,item_id) {
    let output = [];
    console.time("hybrid " + user_id);
    output = joinAndReturn(user_id, item_id);
    console.timeEnd("hybrid " + user_id);
    return(output);
}

function joinAndReturn(user_id, item_id) {
    let done = false;
    let result = [], unique_arr = [], output = [], w = 0.3;
    doAlgorithms(user_id, item_id).then(results => {
        let cb_results = results[0], cf_results = results[1];
        cb_results.forEach(cb_item => {
            if (unique_arr.indexOf(cb_item.id) <= -1)
                unique_arr.push(cb_item.id);
        });
        cf_results.forEach(cf_item => {
            if (unique_arr.indexOf(cf_item.id) <= -1)
                unique_arr.push(cf_item.id);
        });
        unique_arr.forEach(u_item => {
            let cb_score = 0, cf_score = 0;
            let cb_found = cb_results.filter(function (el) {
                return el.id === u_item;
            });
            if (cb_found.length > 0) {
                cb_score = cb_found[0].score;
            }
            let cf_found = cf_results.filter(function (el) {
                return el.id === u_item;
            });
            if (cf_found.length > 0) {
                cf_score = cf_found[0].score;
            }
            output.push({
                id: u_item,
                score: (w * cb_score + cf_score) / (w + 1)
            });
        });
        sort(output).then(r => {
            if (r.length > 10)
                result = r.splice(0, 10);
            else result = r;
        });
        done = true;
    });
    deasync.loopWhile(function () {
        return !done;
    });
    return result;
}

function doAlgorithms(user_id,item_id){
    var cf_results, cb_results;
 
       cf_results = getCollaborativeFilteringResult(user_id)
       cb_results = getContentBaseRecommend(item_id)
      done = true;
      require('deasync').loopWhile(function(){return !done;});
     console.log("cb :" + cb_results)
     console.log("cf :" + cf_results)
   
    
    
    return [cb_results,cf_results]
    
}

doAlgorithms(1,3647)

// module.exports={
//     getCollaborativeFilteringResult: function (user_id){
//         return new Promise(function (resolve, reject) {
//             let user_arr = [];
//             let docs = {};
//             let user_idx = 0;
//             var sql= "SELECT  Homestay_id,User_id, rating_score FROM `homestay rating` "
//             con.query(sql,function(err,result) {
//                 if (err) throw err;
//                 // Thong ke user da comment
//                 //console.log(result[0].User_id)
//                 for (let i = 0; i < result.length; i++) 
//                 {
//                     if (user_arr.indexOf(result[i].User_id) <= -1)
//                         user_arr.push(result[i].User_id);
//                     let obj = {};
//                     obj.item = result[i].Homestay_id;
//                     obj.rating = result[i].rating_score;
//                     if (result[i].User_id in docs)
//                         docs[result[i].User_id].push(obj);
//                     else docs[result[i].User_id] = [obj];
//                 }   
                    
//             })
      
//         })  
//     }
// }
// function get(id){
//         new Promise(function(resolve,reject){
//             module.exports.getCollaborativeFilteringResult(id).then( doc => { console.log(doc)})
//             .catch(function(err){
//                 return resolve(doc)
//             })
//         })
// }
// get(1)
    


// function doAlgorithms(user_id) {
//     return Promise.all([
//         new Promise(function (resolve, reject) {
//             module.exports.getCollaborativeFilteringResult(user_id)
//                 .then(cf_results => {
//                     return resolve(cf_results);              
//                 })
//                 .catch(function (err) {
//                     return resolve([]);
//                 });
//         })
//     ]);
// }

//doAlgorithms(1)



//             db.view("ratings", "all-rating", {include_docs: true})
//                 .then(body => {
//                     console.time("cf " + user_id);
//                     for (let i = 0; i < body.total_rows; i++) {
//                         if (user_arr.indexOf(body.rows[i].doc.user_id) <= -1)
//                             user_arr.push(body.rows[i].doc.user_id);
//                         let obj = {};
//                         obj.item = body.rows[i].doc.item_id;
//                         obj.rating = body.rows[i].doc.rating;
//                         if (body.rows[i].doc.user_id in docs)
//                             docs[body.rows[i].doc.user_id].push(obj);
//                         else docs[body.rows[i].doc.user_id] = [obj];
//                     }
//                 })
//                 .then(() => {
//                     user_idx = user_arr.indexOf(user_id);
//                     if (user_idx <= -1)
//                         reject("user has not rated any item in recommended item list.");
//                     // Step 1: normalize rating by subtract row mean
//                     module.exports.normalizeDocs(docs, user_arr, user_id)
//                         .then(avg_user => {
//                             // Step 2: get cosin similarity
//                             const user_items = docs[user_id];
//                             module.exports.getCosinSimilarity(docs, user_items, user_arr, user_id)
//                                 .then(similarity => {
//                                     // Step 3: get item need to recommend
//                                     module.exports.getItemNeedToRecommend(docs, similarity, user_items, user_id)
//                                         .then(item_need_to_recommend => {
//                                             // Step 4: predict
//                                             module.exports.predict(item_need_to_recommend, avg_user, user_id)
//                                                 .then(result => {
//                                                     sort(result).then(result => {
//                                                         result.forEach(item => {
//                                                             item.score = (item.score - 1) / 4;
//                                                         });
//                                                         if (result.length > maxSimilarDocuments)
//                                                             result = result.splice(0, maxSimilarDocuments);
//                                                         console.timeEnd("cf " + user_id);
//                                                         resolve(result);
//                                                     });
//                                                 });
//                                         });
//                                 });
//                         });
//                 })
//                 .catch(function (err) {
//                     reject(new Error(err));
//                 });
//     }
//     )
// }

// module.exports = {
//     //user-based
//     getCollaborativeFilteringResult: function (user_id) {
//         return new Promise(function (resolve, reject) {
//             let user_arr = [];
//             let docs = {};
//             let user_idx = 0;
//             db.view("ratings", "all-rating", {include_docs: true})
//                 .then(body => {
//                     console.time("cf " + user_id);
//                     for (let i = 0; i < body.total_rows; i++) {
//                         if (user_arr.indexOf(body.rows[i].doc.user_id) <= -1)
//                             user_arr.push(body.rows[i].doc.user_id);
//                         let obj = {};
//                         obj.item = body.rows[i].doc.item_id;
//                         obj.rating = body.rows[i].doc.rating;
//                         if (body.rows[i].doc.user_id in docs)
//                             docs[body.rows[i].doc.user_id].push(obj);
//                         else docs[body.rows[i].doc.user_id] = [obj];
//                     }
//                 })
//                 .then(() => {
//                     user_idx = user_arr.indexOf(user_id);
//                     if (user_idx <= -1)
//                         reject("user has not rated any item in recommended item list.");
//                     // Step 1: normalize rating by subtract row mean
//                     module.exports.normalizeDocs(docs, user_arr, user_id)
//                         .then(avg_user => {
//                             // Step 2: get cosin similarity
//                             const user_items = docs[user_id];
//                             module.exports.getCosinSimilarity(docs, user_items, user_arr, user_id)
//                                 .then(similarity => {
//                                     // Step 3: get item need to recommend
//                                     module.exports.getItemNeedToRecommend(docs, similarity, user_items, user_id)
//                                         .then(item_need_to_recommend => {
//                                             // Step 4: predict
//                                             module.exports.predict(item_need_to_recommend, avg_user, user_id)
//                                                 .then(result => {
//                                                     sort(result).then(result => {
//                                                         result.forEach(item => {
//                                                             item.score = (item.score - 1) / 4;
//                                                         });
//                                                         if (result.length > maxSimilarDocuments)
//                                                             result = result.splice(0, maxSimilarDocuments);
//                                                         console.timeEnd("cf " + user_id);
//                                                         resolve(result);
//                                                     });
//                                                 });
//                                         });
//                                 });
//                         });
//                 })
//                 .catch(function (err) {
//                     reject(new Error(err));
//                 });
//         });
//     },

   
//     getCosinSimilarity(docs, user_items, user_arr, user_id) {
//         return new Promise(function (resolve) {
//             console.time("getCosinSimilarity " + user_id);
//             let similarity = [];
//             let r1 = 0;
//             for (let i = 0; i < user_items.length; i++)
//                 r1 += user_items[i].rating * user_items[i].rating;
//             const sqrt_user_rating = Math.sqrt(r1);
//             for (let i = 0; i < user_arr.length; i++) {
//                 if (user_arr[i] !== user_id) {
//                     let other_user_items = docs[user_arr[i]];
//                     let same = other_user_items.filter(function (obj) {
//                         return user_items.some(function (obj2) {
//                             return obj.item === obj2.item;
//                         });
//                     });
//                     if (same.length > 0) {
//                         let r2 = 0;
//                         for (let j = 0; j < other_user_items.length; j++)
//                             r2 += other_user_items[j].rating * other_user_items[j].rating;
//                         const sqrt_other_rating = Math.sqrt(r2);
//                         let a = 0;
//                         let prod = 0;
//                         for (let k = 0; k < same.length; k++) {
//                             let item_rating = user_items.filter(item => {
//                                 if (item.item === same[k].item) return item;
//                             });
//                             prod += item_rating[0].rating * same[k].rating;
//                         }
//                         if (prod !== 0) {
//                             let sim = prod / (sqrt_other_rating * sqrt_user_rating);
//                             similarity.push({
//                                 user: user_arr[i],
//                                 sim: sim
//                             });
//                         }
//                     }
//                 }
//             }
//             similarity.sort(function (a, b) {
//                 let keyA = a.sim,
//                     keyB = b.sim;
//                 if (keyA < keyB) return 1;
//                 if (keyA > keyB) return -1;
//                 return 0;
//             });
//             console.timeEnd("getCosinSimilarity " + user_id);
//             resolve(similarity);
//         });
//     },

//     normalizeDocs(docs, user_arr, user_id) {
//         return new Promise(function (resolve) {
//             console.time("normalizeDocs " + user_id);
//             let avg_user = 0;
//             for (let i = 0; i < user_arr.length; i++) {
//                 let items = docs[user_arr[i]];
//                 let value = 0;
//                 for (let j = 0; j < items.length; j++) {
//                     value += items[j].rating;
//                 }
//                 if (user_arr[i] === user_id) {
//                     avg_user = value / items.length;
//                 }
//                 for (let j = 0; j < items.length; j++) {
//                     items[j].rating = items[j].rating - value / items.length;
//                 }
//             }
//             console.timeEnd("normalizeDocs " + user_id);
//             resolve(avg_user);
//         });
//     },

//     predict(item_need_to_recommend, avg_user, user_id) {
//         return new Promise(function (resolve) {
//             console.time("predict " + user_id);
//             let result = [];
//             for (let i = 0; i < item_need_to_recommend.length; i++) {
//                 const users = item_need_to_recommend[i].users;
//                 if (users.length >= neighbor_num) {
//                     let r = 0,
//                         v = 0;
//                     for (let j = 0; j < neighbor_num; j++) {
//                         r += users[j].sim * users[j].rating;
//                         v += Math.abs(users[j].sim);
//                     }
//                     result.push({
//                         id: item_need_to_recommend[i].item,
//                         score: r / v + avg_user
//                     });
//                 }
//             }
//             console.timeEnd("predict " + user_id);
//             resolve(result);
//         });
//     },

//     getItemNeedToRecommend(docs, similarity, user_items, user_id) {
//         return new Promise(function (resolve) {
//             console.time("getItemNeedToRecommend " + user_id);
//             let item_need_to_recommend = [];
//             for (let i = 0; i < similarity.length; i++) {
//                 // Find values that are in docs[similarity[i].user] but not in user_items
//                 let uniqueResultOne = docs[similarity[i].user].filter(function (obj) {
//                     return !user_items.some(function (obj2) {
//                         return obj.item === obj2.item;
//                     });
//                 });
//                 const user = similarity[i].user;
//                 const sim = similarity[i].sim;
//                 if (uniqueResultOne.length > 0) {
//                     for (let j = 0; j < uniqueResultOne.length; j++) {
//                         let obj = item_need_to_recommend.find(
//                             obj => obj.item === uniqueResultOne[j].item
//                         );
//                         if (obj === undefined)
//                             item_need_to_recommend.push({
//                                 item: uniqueResultOne[j].item,
//                                 users: [
//                                     {user: user, sim: sim, rating: uniqueResultOne[j].rating}
//                                 ]
//                             });
//                         else
//                             obj.users.push({
//                                 user: user,
//                                 sim: sim,
//                                 rating: uniqueResultOne[j].rating
//                             });
//                     }
//                 }
//             }
//             console.timeEnd("getItemNeedToRecommend " + user_id);
//             resolve(item_need_to_recommend);
//         });
//     },

// };



