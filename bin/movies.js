﻿r = require('rethinkdb')
var connection = null;
r.connect({
	host: 'localhost',
	port: 28015
}, function(err, conn) {
	if (err) throw err;
	connection = conn;
});

var ffmpeg = require('fluent-ffmpeg');

var movies = r.db('FuME').table('movies');

var mdb = require('moviedb')('70bc3bd0e08fd826de2ecda0db108941');
var moment = require('moment');
var result;
var poster_download_path;
var backdrop_download_path;

mdb.configuration(function(err, res) {
	if (err) console.log(err);
	poster_download_path = res.images.secure_base_url + res.images.poster_sizes[4];
	backdrop_download_path = res.images.secure_base_url + res.images.backdrop_sizes[3];
});

var fs = require('fs'),
	request = require('request');

var movieLibrary = ["/media/Drive1/Bio/Movies"/*, "/media/Drive2/Biosafn/Bíómyndir"*/];

// Download images
var download = function(uri, filename, callback) {
	request.head(uri, function(err, res, body) {
		//console.log('content-type:', res.headers['content-type']);
		//console.log('content-length:', res.headers['content-length']);

		request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
	});
};

//var download = require('.downloadImages');

// TMDB has a request limit, so this is to throttle requests
function sleep(milliseconds) {
	var start = new Date().getTime();
	for (var i = 0; i < 1e7; i++) {
		if ((new Date().getTime() - start) > milliseconds) {
			break;
		}
	}
}

/*
* Searches for movie and gets full info, also downloads images.
*/
var searchMovie = function(filename, fullpath, extension, done) {
	// Remove unnecessary guff like file extension
	var searchName = filename.replace(/ \(.*/g, '');
	console.log("Searching for: " + searchName);

    movies.filter({search_name: searchName }).run(connection, function(err, cursor){
        cursor.toArray(function(err, result){
            if(result.length > 0) {
                movies.get(result[0].id).update({fullpath: fullpath});
                done();
            } else {
                mdb.searchMovie({
                    query: searchName
                }, function(err, search_res) {
                    if (search_res.results[0]){
                        // Get movie info
                        mdb.movieInfo({
                        id: search_res.results[0].id
                        }, function(err, info_res){
                            console.log("Info fetched");
                            downloadImages(info_res);

                            movie_info = info_res;
                            movie_info.fullpath = fullpath;
                            movie_info.id = String(movie_info.id);
                            movie_info.type = "movie";
                            //delete movie_info.id;

                            // Added time
                            movie_info.time_added = String(moment());

                            ffmpeg.ffprobe(movie_info.fullpath, function(err, metadata) {
                                //console.dir(metadata);
                                movie_info.metadata = metadata;
                                movie_info.search_name = searchName;
                                //movie_info.duration = moment.duration(metadata.format.duration, "seconds");
                                //movie_info.data.subtitle_path = movie_info.data.fullpath.slice(0, -extension.length) + ".srt";
                                movies.insert(movie_info).run(connection);
                                // All functions have run so this to get next file in walk loop
                                done();
                            });
                        });
                    } else {
                        console.log(searchName + " not found. Ignoring");
                        done();
                    }
                });
            }
        });
    });
}

var downloadImages = function(movie) {
	// Download poster image
	try {
		//console.log('downloading poster for ' + movie.original_title)
		download(poster_download_path + movie.poster_path, './public/images' + movie.poster_path, function() {
			//console.log('poster download done');
		});
        //console.log('downloading backdrop for' + movie.original_title)
        download(backdrop_download_path + movie.backdrop_path, './public/images' + movie.backdrop_path, function() {
            //console.log('backdrop download done');
        });
	}
	finally {
		console.log("downloaded all images for " + movie.original_title);
	}
	// Download backdrop image

}

var valid_file_extensions = [".mp4", ".webm", ".mkv"];

// Search through all directories + sub directories
var path = require('path');

var walk = function(dir, done) {
	var results = [];
	fs.readdir(dir, function(err, list) {
		if (err) return done(err);
		var i = 0;
		(function next() {
			var file = list[i++];
			if (!file) return done(null, results);
			file = dir + '/' + file;
			fs.stat(file, function(err, stat) {
				if (stat && stat.isDirectory()) {
					walk(file, function(err, res) {
						results = results.concat(res);
						next();
					});
				} else {
					var file_extension = path.extname(file);
					// If the file extension is valid then add file to array
					if (valid_file_extensions.indexOf(file_extension) !== -1) {
						results.push(file);
						var basename = path.basename(file);
						sleep(666);
						searchMovie(basename, file, file_extension, function () {
                            next();
						});
					} else {
                        next();   
                    }
				}
			});
		})();
	});
};

movieLibrary.forEach(function(element, index) {
	console.log(element);
	walk(element, function(err, results) {
       console.log("Done walking " + element); 
    });
});
//walk(movieLibrary, function(err, results) {});


//searchMovie('The Hobbit The Battle of the Five Armies', "Ted 2");
