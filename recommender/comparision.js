const ContentBasedRecommender = require("./content-based-recommender/index");
const maxSimilarDocuments = 10;
const content_based = new ContentBasedRecommender({
    maxSimilarDocuments: maxSimilarDocuments,
    minScore: 0,
    debug: false
});
const nano = require("nano")("http://admin:1@localhost:5984");
const db = nano.use("advertisement");

module.exports = {
    getContentBasedOptResult: function (item_id) {
        return new Promise(function (resolve, reject) {
            db.view("items", "all-item-e", {
                include_docs: true
            }).then(body => {
                let documents = [];
                console.log(body.total_rows);
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
    },

    getContentBasedOriginResult: function (item_id) {
        return new Promise(function (resolve, reject) {
            db.view("items", "all-item-e", {
                include_docs: true
            }).then(body => {
                console.log(body.total_rows);
                let documents = [];
                body.rows.forEach(doc => {
                    let obj = {
                        id: doc.doc._id,
                        content: doc.doc.content
                    };
                    documents.push(obj);
                });
                return documents;
            }).then(function (documents) {
                console.time("content-based " + item_id);
                content_based.train(documents);
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
    }
};
