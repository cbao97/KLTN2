const ContentBasedRecommender = require("./content-based-recommender/index");
const maxSimilarDocuments = 10;
const content_based = new ContentBasedRecommender({
    maxSimilarDocuments: maxSimilarDocuments,
    minScore: 0,
    debug: false
});
const nano = require("nano")("http://admin:1@localhost:5984");
const db = nano.use("advertisement");
const neighbor_num = 2;

module.exports = {
    getCollaborativeFilteringResultI: function (user_id) {
        return new Promise(function (resolve, reject) {
            let item_arr = [], user_arr = [], user_items = [];
            let docs = {};
            let user_idx = 0;
            db.view("ratings", "all-rating", {include_docs: true}).then(body => {
                console.time("cf " + user_id);
                for (let i = 0; i < body.total_rows; i++) {
                    if (user_arr.indexOf(body.rows[i].doc.user_id) <= -1)
                        user_arr.push(body.rows[i].doc.user_id);
                    if (item_arr.indexOf(body.rows[i].doc.item_id) <= -1)
                        item_arr.push(body.rows[i].doc.item_id);
                    if (user_id === body.rows[i].doc.user_id) user_items.push(body.rows[i].doc.item_id);
                    let obj = {};
                    obj.user = body.rows[i].doc.user_id;
                    obj.rating = body.rows[i].doc.rating;
                    if (body.rows[i].doc.item_id in docs) docs[body.rows[i].doc.item_id].push(obj);
                    else docs[body.rows[i].doc.item_id] = [obj];
                }
            }).then(() => {
                user_idx = user_arr.indexOf(user_id);
                if (user_idx <= -1) reject("user has not rated any item in recommended item list.");
                // Step 1: normalize rating by subtract row mean
                normalizeDocsI(docs, item_arr).then(avg_items => {
                    // Step 2: get cosin similarity
                    let items_not_by_user = item_arr.diff(user_items);
                    getCosinSimilarityI(docs, items_not_by_user, item_arr, user_items).then(similarity => {
                        let rating_by_user = [];
                        for (let i = 0; i < user_items.length; i++) {
                            let users = docs[user_items[i]];
                            for (let j = 0; j < users.length; j++) {
                                if (users[j].user === user_id) {
                                    rating_by_user.push({
                                        item: user_items[i],
                                        mean: users[j].rating
                                    })
                                }
                            }
                        }

                        // similarity.sort(function (a, b) {
                        //     let keyA = a.sim, keyB = b.sim;
                        //     if (keyA < keyB) return 1;
                        //     if (keyA > keyB) return -1;
                        //     return 0;
                        // });

                        // Step 4: predict
                        predictI(rating_by_user, items_not_by_user, similarity, avg_items).then(result => {
                            sort(result).then(result => {
                                if (result.length > maxSimilarDocuments) {
                                    result = result.splice(0, maxSimilarDocuments);
                                }
                                console.timeEnd("cf " + user_id);
                                resolve(result);
                            });
                        });
                    });
                });
            }).catch(function (err) {
                reject(new Error(err));
            });
        });
    },
};

Array.prototype.diff = function (a) {
    return this.filter(function (i) {
        return a.indexOf(i) < 0;
    });
};

function predictI(rating_by_user, items_not_by_user, similarity, avg_items) {
    return new Promise(function (resolve) {
        let result = [];
        for (let i = 0; i < items_not_by_user.length; i++) {
            const items = similarity[items_not_by_user[i]];
            console.log("items", items);
            if (items.length >= neighbor_num) {
                let r = 0, v = 0;
                for (let j = 0; j < neighbor_num; j++) {
                    r += items[j] * items[j].rating;
                    v += Math.abs(items[j].sim);
                }
                result.push({
                    item: items_not_by_user[i],
                    rating: (r / v) + avg_items[items_not_by_user[i]]
                });
            }
        }
        console.log("result", result);
        resolve(result);

        // for (let i = 0; i < items_not_by_user.length; i++) {
        //     let ratings = similarity[items_not_by_user[i]];
        //     for (let j = 0; j < ratings.length; j++) {
        //
        //     }
        // }
    });
}

function getCosinSimilarityI(docs, items_not_by_user, item_arr, user_items) {
    return new Promise(function (resolve) {
        let similarity = {}, items_value = {};
        for (let i = 0; i < item_arr.length; i++) {
            let users = docs[item_arr[i]];
            let r1 = 0;
            for (let j = 0; j < users.length; j++) r1 += users[j].rating * users[j].rating;
            items_value[item_arr[i]] = Math.sqrt(r1);
        }
        for (let i = 0; i < items_not_by_user.length; i++) {
            similarity[items_not_by_user[i]] = [];
            let other_user_items = docs[items_not_by_user[i]];
            let value_i = items_value[items_not_by_user[i]];
            for (let j = 0; j < user_items.length; j++) {
                let value_j = items_value[user_items[j]];
                let same = other_user_items.filter(function (obj) {
                    return docs[user_items[j]].some(function (obj2) {
                        return obj.user === obj2.user;
                    });
                });
                if (same.length > 0) {
                    let prod = 0;
                    for (let k = 0; k < same.length; k++) {
                        let user_rating = docs[user_items[j]].filter((user) => {
                            if (user.user === same[k].user) return user.rating;
                        });
                        prod += user_rating[0].rating * same[k].rating;
                    }
                    if (prod !== 0) {
                        let sim = prod / (value_i * value_j);
                        let obj = {};
                        obj[user_items[j]] = sim;
                        similarity[items_not_by_user[i]].push(obj);
                    }
                }
            }
        }
        resolve(similarity);
    })
}

function normalizeDocsI(docs, item_arr) {
    return new Promise(function (resolve) {
        let avg_items = [];
        for (let i = 0; i < item_arr.length; i++) {
            let users = docs[item_arr[i]];
            let value = 0;
            for (let j = 0; j < users.length; j++) {
                value += users[j].rating;
            }
            avg_items.push({
                item: item_arr[i],
                avg: value / users.length
            });
            for (let j = 0; j < users.length; j++) {
                users[j].rating = users[j].rating - value / users.length;
            }
        }
        resolve(avg_items);
    });
}
