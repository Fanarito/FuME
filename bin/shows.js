'use strict'

let r = require('rethinkdb')
let connection = null;
r.connect({
    host: 'localhost',
    port: 28015
}, function (err, conn) {
    if (err) throw err;
    connection = conn;
});

const shows = r.db('FuME').table('tv_shows');
const episodes = r.db('FuME').table('episodes');

let mdb = require('moviedb')('70bc3bd0e08fd826de2ecda0db108941');
let moment = require('moment');
let result;
let poster_download_path;
let backdrop_download_path;

mdb.configuration(function (err, res) {
    if (err) console.log(err);
    poster_download_path = res.images.secure_base_url + res.images.poster_sizes[4];
    backdrop_download_path = res.images.secure_base_url + res.images.backdrop_sizes[3];
});

let fs = require('fs'),
    request = require('request');

let showLibrary = ["/media/Drive1/Bio/Series/"];

let valid_file_extensions = [".mp4", ".webm", ".mkv"];

// TMDB has a request limit, so this is to throttle requests
function sleep(milliseconds) {
    var start = new Date().getTime();
    for (var i = 0; i < 1e7; i++) {
        if ((new Date().getTime() - start) > milliseconds) {
            break;
        }
    }
}

// Download images
let download = function (uri, filename, callback) {
    request.head(uri, function (err, res, body) {
        //console.log('content-type:', res.headers['content-type']);
        //console.log('content-length:', res.headers['content-length']);

        request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
    });
};

let downloadImages = function (movie) {
    // Download poster image
    try {
        download(poster_download_path + movie.poster_path, './public/images' + movie.poster_path, function () {
            //console.log('poster download done');
        });
        download(backdrop_download_path + movie.backdrop_path, './public/images' + movie.backdrop_path, function () {
            //console.log('backdrop download done');
        });
    }
    finally {
        console.log("downloaded all images for " + movie.original_name);
    }
}

let getEpisode = function (show_id, season_episode, fullpath, extension, done) {
    if (!isNaN(season_episode[0]) && !isNaN(season_episode[1])) {
        episodes.filter({ show: show_id, season_number: season_episode[0], episode_number: season_episode[1] }).run(connection, function (err, cursor) {
            cursor.toArray(function (err, result) {
                if (err) throw err;

                if (result.length > 0) {
                    // Only update episode location
                    episodes.get(result[0].id).update({ fullpath: fullpath }).run(connection, function (err, cursor) {
                        // No sleep because no requests made
                        done();
                    });
                } else {
                    // Only get episode
                    mdb.tvEpisodeInfo(
                        {
                            id: show_id,
                            season_number: season_episode[0],
                            episode_number: season_episode[1]
                        }
                        , function (err, epi_res) {
                            if (epi_res) {
                                epi_res.time_added = String(moment());
                                epi_res.fullpath = fullpath;
                                epi_res.id = String(epi_res.id);
                                epi_res.subtitle_path = epi_res.fullpath.slice(0, -extension.length) + ".srt";
                                epi_res.show = show_id;
                                episodes.insert(epi_res).run(connection);
                                console.log("episode info fetched");
                            } else {
                                console.log("episode not found");
                            }
                    
                            // All functions have run so this to get next file in walk loop
                            // Sleep 333 milliseconds because it made 1 request
                            sleep(333);
                            done();
                        });
                }
            });
        });
    } else {
        console.log("episode or season number is not a number");
        done();   
    }
}

let searchShow = function (filename, fullpath, extension, done) {
    console.log(filename);
    let nameSplit = filename.split(" - ");
    if (nameSplit.length != 3) {
        console.log("naming is fucky, ignoring");
        done();
        return null;
    }
    let show = nameSplit[0];
    let episodeName = nameSplit[2];
    let season_episode = nameSplit[1].split("x");
    season_episode[0] = parseInt(season_episode[0], 10);
    season_episode[1] = parseInt(season_episode[1], 10);

    shows.filter({ search_name: show }).run(connection, function (err, cursor) {
        cursor.toArray(function (err, result) {
            if (err) throw err;
            // Check if show is in database
            //console.log(result);
            if (result.length > 0) {
                // Check if episode is in database
                //console.log(result[0]);
                console.log(result[0].id + " " + parseInt(season_episode[0], 10) + " " + parseInt(season_episode[1], 10));
                getEpisode(result[0].id, season_episode, fullpath, extension, done);
            } else {
                // Get show and episode detail
                mdb.searchMulti({ query: show }, function (err, res) {
                    // Make sure top result is a tv show
                    //console.log(res);
                    if (res.total_results != 0 && res.results[0].media_type == "tv") {
                        mdb.tvInfo({ id: res.results[0].id }, function (err, info_res) {
                            console.log("info fetched");
                            //console.log(info_res);
                            downloadImages(info_res);

                            let tv_res = info_res;
                            tv_res.time_added = String(moment());
                            //tv_res.fullpath = fullpath;
                            tv_res.id = String(tv_res.id);
                            tv_res.search_name = show;
                            delete tv_res.seasons;
                            try {
                                shows.insert(tv_res).run(connection);
                            }
                            finally {
                                console.log("show inserted to database");
                                // Sleep for 666 milliseconds because it made 2 requests
                                sleep(666);
                                getEpisode(info_res.id, season_episode, fullpath, extension, done);
                            }
                        });
                    } else {
                        console.log("does not exist");
                        done();
                    }
                });
            }
        });
        return null;
    });
}

// Search through all directories + sub directories
let path = require('path');

let walk = function (dir, done) {
    let results = [];
    fs.readdir(dir, function (err, list) {
        if (err) return done(err);
        let i = 0;
        (function next() {
            let file = list[i++];
            if (!file) return done(null, results);
            file = dir + '/' + file;
            fs.stat(file, function (err, stat) {
                if (stat && stat.isDirectory()) {
                    walk(file, function (err, res) {
                        results = results.concat(res);
                        next();
                    });
                } else {
                    let file_extension = path.extname(file);
                    // If the file extension is valid then add file to array
                    if (valid_file_extensions.indexOf(file_extension) !== -1) {
                        results.push(file);
                        let basename = path.basename(file);
                        searchShow(basename, file, file_extension, function () {
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

showLibrary.forEach(function (element, index) {
    console.log(element);
    walk(element, function (err, results) {
        console.log("Done walking " + element);
    });
});