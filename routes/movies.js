var express = require('express');
var router = express.Router();
var db = "FuME";
var r = require('rethinkdb')
var connection = null;
r.connect({
    host: 'localhost',
    port: 28015
}, function (err, conn) {
    if (err) throw err;
    connection = conn;
});
var play = require('./play');

router.get('/', function (req, res, next) {
    r.db(db).table('movies')
        .orderBy('original_title')
        .pluck(["original_title", "poster_path", "overview", "vote_average", "release_date", "id", "type"])
        .run(connection, function (err, cursor) {
            if (err) {
                return next(err);
            }

            //Retrieve all the movies in an array.
            cursor.toArray(function (err, result) {
                if (err) {
                    return next(err);
                }
                /*result.forEach(function(element, index){
                    //result[index] = {info: result[index]};
                    result[index].attributes = {};
                    result[index].attributes.overview = result[index].overview;
                    result[index].attributes.poster_path = result[index].poster_path;
                    result[index].attributes.vote_average = result[index].vote_average;
                    result[index].attributes.release_date = result[index].release_date;
                    result[index].attributes.original_title = result[index].original_title;
                    //console.log(result);

                    delete result[index].original_title;
                    delete result[index].overview;
                    delete result[index].poster_path;
                    delete result[index].vote_average;
                    delete result[index].release_date;

                    //delete result[index].attributes.id;
                    //delete result[index].attributes.type;
                });*/

                /*var movies = {};
                movies.data = {};
                movies.data = result;*/
                res.json(result);
            });
        });
});

router.get('/:id', function (req, res, next) {
    r.db(db).table('movies').get(req.params.id).run(connection, function (err, cursor) {
        if (err) {
            return next(err);
        }

        res.json(cursor);
    });
});

module.exports = router;
