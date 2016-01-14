var express = require('express');
var router = express.Router();
// FFMPEG
var ffmpeg = require('fluent-ffmpeg');
var fs = require('fs');

r = require('rethinkdb')
var connection = null;
r.connect({
	host: 'localhost',
	port: 28015
}, function(err, conn) {
	if (err) throw err;
	connection = conn;
});

var playMovie = function(id, res, startTime) {
	r.db('FuME').table('movies').get(id).pluck('fullpath').run(connection, function(err, cursor) {
		if (err) {
			return next(err);
		}
		console.log(cursor);

		var proc = ffmpeg(cursor.fullpath)
            .seekInput(startTime)
			.format('webm')
			.videoCodec('libvpx')
			.videoBitrate('1500k')
			//.fps(24)
			.size('?x720')
			.audioBitrate('128k')
			.audioChannels(2)
			.audioCodec('libvorbis')
			.outputOptions([
				'-threads 8',
				//'-cpu-used 16',
				'-speed 4',
				'-deadline realtime'
			])
			.on('error', function(err, stdout, stderr) {
				console.log('An error occurred: ' + err.message);
				console.log('stdout: ' + stdout);
				console.log('stderr: ' + stderr);
			})
			.on('end', function() {
				console.log('Processing finished !');
			})
			//.save('public/videos/output.webm');
			.pipe(res, {
				end: true
			});
	});
}

var playShow = function(id, res, season, episode, startTime) {
	r.db('test').table('shows').get(id).pluck('fullpath').run(connection, function(err, cursor) {
		if (err) {
			return next(err);
		}
		console.log(cursor);

		var proc = ffmpeg(cursor.fullpath)
            .seekInput(startTime)
			.format('webm')
			.videoCodec('libvpx')
			.videoBitrate('1500k')
			//.fps(24)
			.size('?x720')
			.audioBitrate('128k')
			.audioChannels(2)
			.audioCodec('libvorbis')
			.outputOptions([
				'-threads 8',
				//'-cpu-used 16',
				'-speed 4',
				'-deadline realtime'
			])
			.on('error', function(err, stdout, stderr) {
				console.log('An error occurred: ' + err.message);
				console.log('stdout: ' + stdout);
				console.log('stderr: ' + stderr);
			})
			.on('end', function() {
				console.log('Processing finished !');
			})
			//.save('public/videos/output.webm');
			.pipe(res, {
				end: true
			});
	});
}

router.get('/', function(req, res, next) {
	res.render('play', {
		title: 'Playing'
	});
});

router.get('/movies/:id', function(req, res, next) {
	playMovie(req.params.id, res, '0:0:0');
});

router.get('/movies/:id/:hour/:min/:sec/', function(req, res, next) {
    startTime = req.params.hour + ':' + req.params.min + ':' + req.params.sec;
	playMovie(req.params.id, res, startTime);
});

router.get('/shows/:id/:season/:episode', function(req, res, next) {
    playShow(req.params.id, res, req.params.season, req.params.episode, "0:0:0");
});

router.get('/shows/:id/:season/:episode/:hour/:min/:sec/', function(req, res, next) {
    startTime = req.params.hour + ':' + req.params.min + ':' + req.params.sec;
    playShow(req.params.id, res, req.params.season, req.params.episode, startTime);
});

module.exports = router;
