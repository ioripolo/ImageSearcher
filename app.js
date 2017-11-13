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
      0: appURL + '/dogs?offset=2',
      1: appURL + '/latest'
    },
    result: {
      0: '[\n\
  {\n\
    \"url\": \"http://epilepsyu.com/wp-content/uploads/2013/03/dog-open-mouth.jpg\",\n\
    \"snippet\": \"Do you have a dog with epilepsy? - EpilepsyU\",\n\
    \"thumbnail\": \"https://tse4.mm.bing.net/th?id=OIP.TkkEm-k2O0C2QS8udUlLhQEcEs&pid=Api\",\n\
    \"context\": \"http://epilepsyu.com/blog/do-you-have-a-dog-with-epilepsy/\"\n\
  },\n\
  {\n\
    \"url\": \"http://thehappypuppysite.com/wp-content/uploads/2016/02/steal3.jpg\",\n\
    \"snippet\": \"How To Stop Your Dog Stealing - The Happy Puppy Site\",\n\
    \"thumbnail\": \"https://tse2.mm.bing.net/th?id=OIP.vjRYcVfxIpGOq0kFkPlohwEsC4&pid=Api\",\n\
    \"context\": \"http://thehappypuppysite.com/how-to-stop-your-dog-stealing/\"\n\
  }\n\
]',
      1: '[\n\
  {\n\
    "term": "test",\n\
    "when": "11/13/2017, 3:20:21 AM"\n\
  },\n\
  {\n\
    "term": "test",\n\
    "when": "11/13/2017, 3:19:41 AM"\n\
  },\n\
  {\n\
    "term": "test",\n\
    "when": "11/13/2017, 3:18:30 AM"\n\
  },\n\
  {\n\
    "term": "test",\n\
    "when": "11/13/2017, 3:17:50 AM"\n\
  },\n\
  {\n\
    "term": "test",\n\
    "when": "11/13/2017, 3:15:17 AM"\n\
  },\n\
  {\n\
    "term": "sexy",\n\
    "when": "11/12/2017, 8:33:19 AM"\n\
  },\n\
  {\n\
    "term": "test",\n\
    "when": "11/12/2017, 7:55:06 AM"\n\
  },\n\
  {\n\
    "term": "latest",\n\
    "when": "11/12/2017, 6:37:53 AM"\n\
  },\n\
  {\n\
    "term": "lolcats funny",\n\
    "when": "11/12/2017, 6:36:57 AM"\n\
  },\n\
  {\n\
    "term": "lolcats funny",\n\
    "when": "11/12/2017, 6:36:03 AM"\n\
  }\n\
]'
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
    var size = req.query.offset || 10;
    
    var history = {
      "term" : query,
      "when" : new Date().toLocaleString()
    };
    
    // Save query and time to the database
    if (query !== 'favicon.ico') {
      db.collection('Histories').insert(history, (err, data) => {
        if (err) throw err;
        console.log('Saved ' + JSON.stringify(data));
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