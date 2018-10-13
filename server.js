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
var cors = require('cors')
app.use(responseTime());
app.use(cors());
app.options('*', cors());

const grid = require("gridfs-stream");
const MongoClient = require('mongodb').MongoClient
const Grid = require('mongodb').GridFSBucket;
const sharp = require('sharp'); // for image optimisation

// Jasper CDN - Made by CeruTech
// can be used as a slide in replacement for any CDN url
// add "cdn_url": "http://<your-server-location>:8086" to config.json to route all
// image requests to this CDN

var db, gridFS
var supportedFormats = {
    png: { 'mimetype': 'image/png' },
    webp: { 'mimetype': 'image/webp' }
} // removed support for JPEG. like seriously, why do people still want JPEG?????

function reformat(data, format = 'png', quality=100) {
    var transformer = sharp();
    transformer = transformer.toFormat(format, { quality: quality });
    return data.pipe(transformer)
}

app.get('/*', function (req, res, next) {
    res.header('X-CDN-TYPE', 'Vesion 0.6 (https://github.com/AggressivelyMeows/Jasper)');
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
                    // convert and save to DB for future use
                    var format = req.query.format.toLowerCase();
                    var fileID = req.params.fileID + `_${format}`;
                    if (!format.length > 1) {
                        format = 'png'; //default back to png if no format detected
                    }
                    if (format == 'png') {
                        fileID = req.params.fileID;
                    }
                    if (!('formats' in result)) {
                        console.log('heck')
                        // object does not support formats
                        // try to add a polyfill
                        result.formats = [];
                    }
                    if (result.formats.includes(format) || format == 'png') {
                        // we have the file ready to go!
                        var readStream = gridFS.openDownloadStream(fileID);
                        res.set('Content-Type', supportedFormats[format].mimetype);
                        readStream.pipe(res);
                    } else {
                        // generate the file and send back, saving the new version in the database
                        var readStream = gridFS.openDownloadStream(req.params.fileID); // just get the default image
                        res.set('Content-Type', supportedFormats[format].mimetype);
                        res.set('X-Explain', `Rendered new copy of image in ${format}`);
                        reformat(readStream, format = req.query.format).pipe(res);
                        // send the file to the database now
                        db.collection('images').findOneAndUpdate({ fileID: req.params.fileID }, { $push: { 'formats': format, 'history': `[Jasper] Created copy of image in ${format}`} });
                        var writeStream = gridFS.openUploadStreamWithId(req.params.fileID + '_' + format, req.params.fileID + '_' + format );
                        reformat(readStream, format = req.query.format).pipe(writeStream);
                    }
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