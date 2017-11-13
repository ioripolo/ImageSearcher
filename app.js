var express = require('express');
var app = express();
require('dotenv').config();
var mongo = require('mongodb').MongoClient;
var https = require('https');
var apiHost = 'api.cognitive.microsoft.com';
var apiPath = '/bing/v7.0/images/search';
var appURL = process.env.APP_URL;
var subscriptionKey = process.env.API_KEY;

app.set('view engine', 'pug');
app.set('port', (process.env.PORT || 5000));
app.set('views', __dirname +'/views');

app.get("/", function(req, res) {
  res.render('index', {
    title: 'Image Searcher',
    abstract: '基本API使用：Image Searcher微服务',
    stories: {
      0: '根据指定的字符串描述，获取一组符合描述的图片地址和文字描述以及页面地址。',
      1: '可以在地址中增加一个参数 ?offset=2 来对返回结果进行分页。',
      2: '可以获取一个列表，显示最近几次搜索的搜索语句和返回页面地址。'
    },
    usage: {
      0: appURL + '/lolcats%20funny?offset=10',
      1: appURL + '/latest'
    },
    result: {
      0: '{"original_url":"http://www.baidu.com", "short_url":"' + appURL + '/4192"}',
      1: '{"original_url":"http://www.youku.com", "short_url":"' + appURL + '/6828"}'
    }
  });
});

mongo.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/ImageSearchResult", function(err, db) {
  if (err) {
    throw new Error('Database failed to connect!');
  } else {
    console.log('Successfully connected to MongoDB');
  }
    
  app.get('/latest', function(req, res) {
    db.collection('Histories').find().sort({
      "when": -1
    }).limit(10).toArray(function(err, data) {
      if (err) throw err;
      res.send(data.map(function(history){
        return {
          term: history.term,
          when: history.when
        };
      }));
    });
  });
  
  app.route('/:query').get(function(req, res) {
    var query = req.params.query;
    var size = req.query.size || 10;
    
    var history = {
      "term" : query,
      "when" : new Date().toLocaleString()
    };
    
    // Save query and time to the database
    if (query !== 'favicon.ico') {
      db.collection('Histories').insert(history, (err, data) => {
        if (err) throw err;
        console.log('Saved ' + data);
      });
      
      // send request using bing image search api.
      var request_params = {
          method : 'GET',
          hostname : apiHost,
          path : apiPath + '?q=' + encodeURIComponent(query) + "&count=" + size,
          headers : {
            'Ocp-Apim-Subscription-Key' : subscriptionKey,
          }
      };
      
      var searchReq = https.request(request_params, function(searchRes) {
        var body = '';
        searchRes.on('data', function (d) {
          body += d;
        });
        searchRes.on('end', function () {
          var searchResult = JSON.parse(body).value;
          var Result = searchResult.map(function(data) {
            return {
              'url': data.contentUrl,
              'snippet': data.name,
              'thumbnail': data.thumbnailUrl,
              'context': data.hostPageUrl
            };
          });
          res.end(JSON.stringify(Result));
        });
        searchRes.on('error', function (e) {
          console.log('Error: ' + e.message);
        });
      });
      searchReq.end();
    }
  });
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});