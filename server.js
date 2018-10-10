const express = require('express');
const app = express();
const responseTime = require('response-time');
app.use(responseTime());
const grid = require("gridfs-stream");
const MongoClient = require('mongodb').MongoClient
const Grid = require('mongodb').GridFSBucket;

// QB V0.7 CDN for images
// can be used as a slide in replacement for any CDN url

// add "cdn_url": "http://localhost:8086" to config.json to route all
// image requests to this CDN

var db, gridFS

app.get('/*', function (req, res, next) {
    res.header('X-CDN-TYPE', 'Vesion 0.1 (https://github.com/AggressivelyMeows/QuartzBoardCDN)');
    next(); // http://expressjs.com/guide.html#passing-route control
});

app.get('/api/image/:fileID', function (req, res) {
    db.collection('images').findOne({ fileID: req.params.fileID }, (err, result) => {
        res.set('Content-Type', 'image/png');
        if (result.location == 'gridFS') {
            gridFS.openDownloadStream(req.params.fileID).pipe(res);
        } else {
            res.redirect(`https://quartz.nyc3.cdn.digitaloceanspaces.com/${result.userID}/${result.fileID}.png`);
        };
    });
});

app.get('/api/image/:fileID/thumbnail', function (req, res) {
    var fID = req.params.fileID 
    db.collection('images').findOne({ fileID: fID}, (err, result) => {
        res.set('Content-Type', 'image/png');
        if (result.location == 'gridFS') {
            gridFS.openDownloadStream(fID + '_thumbnail').pipe(res);
        } else {
            res.redirect(`https://quartz.nyc3.cdn.digitaloceanspaces.com/${result.userID}/${fID}_thumbnail.png`);
        };
    })
});

MongoClient.connect('mongodb://localhost:27017', (err, client) => {
    if (err) return console.log(err);
    db = client.db('quartz');
    gridFS = new Grid(client.db('image_storage'));
    app.listen(8086, () => {
        console.log('QuartzBoard Image CDN.\nListening on port 8086.\nEnsure you have set the following inside of your config.json:\n' + JSON.stringify({ cdn_url: 'http://<your-server-location>:8086' }));
    });
});