`
MIT License

Copyright (c) 2018 Cerulean (CeruTech)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`
const express = require('express');
const app = express();
const responseTime = require('response-time');
app.use(responseTime());
const grid = require("gridfs-stream");
const MongoClient = require('mongodb').MongoClient
const Grid = require('mongodb').GridFSBucket;
const logger = require('pino')()

const sharp = require('sharp'); // for image optimisation

// QuartzBoard Image CDN - Made by CeruTech
// can be used as a slide in replacement for any CDN url
// add "cdn_url": "http://localhost:8086" to config.json to route all
// image requests to this CDN

var db, gridFS
var supportedFormats = {
    png: { 'mimetype': 'image/png' },
    webp: { 'mimetype': 'image/webp' },
    jpg: {'mimetype': 'image/jpg'}
}

function reformat(data, format = 'png', quality=100) {
    var transformer = sharp();
    transformer = transformer.toFormat(format, { quality: quality });
    return data.pipe(transformer)
}

app.get('/*', function (req, res, next) {
    res.header('X-CDN-TYPE', 'Vesion 0.1 (https://github.com/AggressivelyMeows/QuartzBoardCDN)');
    logger.debug(`${req.url} - ${req.ip}`)
    next(); // http://expressjs.com/guide.html#passing-route control
});

app.get('/api/image/:fileID', function (req, res) {
    db.collection('images').findOne({ fileID: req.params.fileID }, (err, result) => {
        
        res.set('Cache-Control', 'public, max-age=604800'); // 1 week
        
        if (result.location == 'gridFS') {
            if (req.query.format) {
                if (!(req.query.format in supportedFormats)) {
                    res.send({ 'error': 'Format is not supported.' })
                } else {
                    // format is supported
                    // convert.
                    var readStream = gridFS.openDownloadStream(req.params.fileID);
                    res.set('Content-Type', supportedFormats[req.query.format].mimetype);
                    return reformat(readStream, format = req.query.format).pipe(res);
                }
            } else {
                // no format change, render the pure image from the database
                res.set('Content-Type', 'image/png');
                gridFS.openDownloadStream(req.params.fileID).pipe(res);
            }
            

        } else {
            res.redirect(`https://quartz.nyc3.cdn.digitaloceanspaces.com/${result.userID}/${result.fileID}.png`);
        };
    });
});

app.get('/api/image/:fileID/thumbnail', function (req, res) {
    var fID = req.params.fileID 
    db.collection('images').findOne({ fileID: fID}, (err, result) => {
        res.set('Content-Type', 'image/png');
        res.set('Cache-Control', 'public, max-age=604800'); // 1 week
        if (result.location == 'gridFS') {
            if (req.query.format) {
                if (!(req.query.format in supportedFormats)) {
                    res.send({ 'error': 'Format is not supported.' })
                } else {
                    // format is supported
                    // convert.
                    var readStream = gridFS.openDownloadStream(req.params.fileID + '_thumbnail');
                    res.set('Content-Type', supportedFormats[req.query.format].mimetype);
                    return reformat(readStream, format = req.query.format).pipe(res);
                }
            } else {
                // no format change, render the pure image from the database
                res.set('Content-Type', 'image/png');
                gridFS.openDownloadStream(req.params.fileID + '_thumbnail').pipe(res);
            }

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