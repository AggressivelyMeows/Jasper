const express = require('express');
const app = express();
const grid = require("gridfs-stream");
const MongoClient = require('mongodb').MongoClient
const Grid = require('mongodb').GridFSBucket;

// QB V0.7 CDN for images
// can be used as a slide in replacement for any CDN url

// add "cdn_url": "http://localhost:8086/" to config.json to route all
// image requests to this CDN

var db, gridFS

app.get('/api/image/:fileID', function (req, res) {
    res.set('Content-Type', 'image/png');
    gridFS.openDownloadStream(req.params.fileID).pipe(res);
});

app.get('/api/image/:fileID/thumbnail', function (req, res) {
    res.set('Content-Type', 'image/png');
    gridFS.openDownloadStream(req.params.fileID + '_thumbnail').pipe(res);
});

MongoClient.connect('mongodb://localhost:27017', (err, client) => {
    if (err) return console.log(err)
    db = client.db('quartz');
    gridFS = new Grid(client.db('image_storage'));
    app.listen(8086, () => {
        console.log('QuartzBoard Image CDN.\nListening on port 8086.\nEnsure you have set the following inside of your config.json:\n' + JSON.stringify({cdn_url: 'http://<your-server-location>:8086/'}));
    })
})