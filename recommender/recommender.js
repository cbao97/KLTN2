import * as deasync from "deasync";

const ContentBasedRecommender = require("./content-based-recommender/index");
const maxSimilarDocuments = 10;
const content_based = new ContentBasedRecommender({
    maxSimilarDocuments: maxSimilarDocuments,
    minScore: 0,
    debug: false
});
const nano = require("nano")("http://admin:1@localhost:5984");
const db = nano.use("advertisement");
const neighbor_num = 4;

module.exports = {
    getContentBasedResult: function (item_id) {
        return new Promise(function (resolve, reject) {
            // db.view("items", 'all-item-e?key="' + item_id + '"', {
            //     include_docs: true
            // }).then(body => {
            //     let documents = [];
            //     if (body.rows.length === 0) {
            //         db.get(item_id).then(item => {
            //             documents.push({
            //                 id: item._id,
            //                 content: item.content,
            //                 token: item.token
            //             });
            //         });
            //     }
            db.view("items", "all-item-e", {
                include_docs: true
            }).then(body => {
                let documents = [];
                body.rows.forEach(doc => {
                    let obj = {
                        id: doc.doc._id,
                        content: doc.doc.content,
                        token: doc.doc.token
                    };
                    documents.push(obj);
                });
                return documents;
            }).then(function (documents) {
                console.time("content-based " + item_id);
                content_based.trainOpt(documents, item_id);
                const similarDocuments = content_based.getSimilarDocuments(
                    item_id,
                    0,
                    10
                );
                console.timeEnd("content-based " + item_id);
                resolve(similarDocuments);
            }).catch(function (err) {
                reject(new Error(err));
            });
        });
        // });
    },

    //user-based
    getCollaborativeFilteringResult: function (user_id) {
        return new Promise(function (resolve, reject) {
            let user_arr = [];
            let docs = {};
            let user_idx = 0;
            db.view("ratings", "all-rating", {include_docs: true})
                .then(body => {
                    console.time("cf " + user_id);
                    for (let i = 0; i < body.total_rows; i++) {
                        if (user_arr.indexOf(body.rows[i].doc.user_id) <= -1)
                            user_arr.push(body.rows[i].doc.user_id);
                        let obj = {};
                        obj.item = body.rows[i].doc.item_id;
                        obj.rating = body.rows[i].doc.rating;
                        if (body.rows[i].doc.user_id in docs)
                            docs[body.rows[i].doc.user_id].push(obj);
                        else docs[body.rows[i].doc.user_id] = [obj];
                    }
                })
                .then(() => {
                    user_idx = user_arr.indexOf(user_id);
                    if (user_idx <= -1)
                        reject("user has not rated any item in recommended item list.");
                    // Step 1: normalize rating by subtract row mean
                    module.exports.normalizeDocs(docs, user_arr, user_id)
                        .then(avg_user => {
                            // Step 2: get cosin similarity
                            const user_items = docs[user_id];
                            module.exports.getCosinSimilarity(docs, user_items, user_arr, user_id)
                                .then(similarity => {
                                    // Step 3: get item need to recommend
                                    module.exports.getItemNeedToRecommend(docs, similarity, user_items, user_id)
                                        .then(item_need_to_recommend => {
                                            // Step 4: predict
                                            module.exports.predict(item_need_to_recommend, avg_user, user_id)
                                                .then(result => {
                                                    sort(result).then(result => {
                                                        result.forEach(item => {
                                                            item.score = (item.score - 1) / 4;
                                                        });
                                                        if (result.length > maxSimilarDocuments)
                                                            result = result.splice(0, maxSimilarDocuments);
                                                        console.timeEnd("cf " + user_id);
                                                        resolve(result);
                                                    });
                                                });
                                        });
                                });
                        });
                })
                .catch(function (err) {
                    reject(new Error(err));
                });
        });
    },

    getHybridRecommend: function (user_id, item_id) {
        return new Promise(function (resolve, reject) {
            let output = [];
            console.time("hybrid " + user_id);
            output = joinAndReturn(user_id, item_id);
            console.timeEnd("hybrid " + user_id);
            resolve(output);
        });
    },

    predict(item_need_to_recommend, avg_user, user_id) {
        return new Promise(function (resolve) {
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
            resolve(result);
        });
    },

    getItemNeedToRecommend(docs, similarity, user_items, user_id) {
        return new Promise(function (resolve) {
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
            resolve(item_need_to_recommend);
        });
    },

    getCosinSimilarity(docs, user_items, user_arr, user_id) {
        return new Promise(function (resolve) {
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
            resolve(similarity);
        });
    },

    normalizeDocs(docs, user_arr, user_id) {
        return new Promise(function (resolve) {
            console.time("normalizeDocs " + user_id);
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
            console.timeEnd("normalizeDocs " + user_id);
            resolve(avg_user);
        });
    },
};

function doAlgorithms(user_id, item_id) {
    return Promise.all([
        new Promise(function (resolve, reject) {
            module.exports.getContentBasedResult(item_id)
                .then(cb_results => {
                    return resolve(cb_results);
                })
                .catch(function (err) {
                    reject(new Error(err));
                });
        }),
        new Promise(function (resolve, reject) {
            module.exports.getCollaborativeFilteringResult(user_id)
                .then(cf_results => {
                    return resolve(cf_results);
                })
                .catch(function (err) {
                    return resolve([]);
                });
        })
    ]);
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
