var express = require('express');
var router = express.Router();

r = require('rethinkdb')
var connection = null;
r.connect({
  host: 'localhost',
  port: 28015
}, function(err, conn) {
  if (err) throw err;
  connection = conn;
});

router.get('/', function(req, res, next) {
  r.db('test').table('movies')
              .orderBy('original_title')
              .pluck(['id', 'original_title', 'poster_path', 'tagline', 'vote_average', 'release_date'])
              .run(connection, function(err, cursor) {
    if (err) {
      return next(err);
    }

    //Retrieve all the movies in an array.
    cursor.toArray(function(err, result) {
      if (err) {
        return next(err);
      }

      res.json(result);
    });
  });
});

router.get('/:id', function(req, res, next) {
  r.db('test').table('movies').get(req.params.id).run(connection, function(err, cursor) {
    if (err) {
      return next(err);
    }

    res.json(cursor);
  });
});

module.exports = router;
