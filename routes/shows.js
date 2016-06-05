var express = require('express');
var router = express.Router();
var db = "FuME";
var r = require('rethinkdb');
var connection = null;
r.connect({
    host: 'localhost',
    port: 28015
}, function (err, conn) {
    if (err) throw err;
    connection = conn;
});

router.get('/', function (req, res, next) {
    r.db(db).table('tv_shows')
        .orderBy("name")
        .pluck(['id', 'poster_path', 'name', 'vote_average', 'overview', 'first_air_date'])
        .run(connection, function (err, cursor) {
            if (err) {
                return next(err);
            }

            //Retrieve all the movies in an array.
            cursor.toArray(function (err, result) {
                if (err) {
                    return next(err);
                }

                res.json(result);
            });
        });
});

router.get('/:id', function (req, res, next) {
    r.db(db).table('tv_shows').get(req.params.id).merge(
        function () {
            return {
                seasons: r.db(db).table('episodes').filter({ show: req.params.id })
                    .withFields('season_number').distinct()
            };
        }
        ).run(connection, function(err, cursor){
             res.json(cursor);
        });
});

router.get('/:id/:season', function (req, res, next) {
    r.db(db).table('episodes')
        .orderBy('episode_number')
        .filter({ show: req.params.id, season_number: Number(req.params.season) })
        .pluck(["id", "name", "season_number", "episode_number", "overview"])
        .run(connection, function (err, cursor) {
            //Retrieve all the movies in an array.
            cursor.toArray(function (err, result) {
                if (err) {
                    return next(err);
                }
                res.json(result);
            });
        });
});

router.get('/:id/:season/:episode', function (req, res, next) {
    r.db(db).table('episodes')
        .orderBy('episode_number')
        .filter({ show: req.params.id, season_number: Number(req.params.season), episode_number: Number(req.params.episode) })
        .run(connection, function (err, cursor) {
            //Retrieve all the movies in an array.
            cursor.toArray(function (err, result) {
                if (err) {
                    return next(err);
                }
                res.json(result[0]);
            });
        });
});

module.exports = router;
