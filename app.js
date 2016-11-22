var express = require('express');
var exphbs = require('express-handlebars');

var app = express();

app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

app.set('port', process.env.PORT || 3000);

app.get('/', function(req, res){
    res.render('home');
});

app.get('/about', function(req, res){
    var randomeFortune = fortunes[Math.floor(Math.random() * fortunes.length)];
    res.render('about', {fortune: randomeFortune});
});

app.use(express.static(__dirname + '/public'));


// пользовательская страница 404
app.use(function(req, res){
    res.status(404);
    res.render('404');
});
// пользовательская страница 500
app.use(function(err, req, res, next){
    console.error(err.stack);
    res.status(500);
    res.render('500');
});

app.listen(app.get('port'), function(){
    console.log( 'Express listenning http://localhost:' + app.get('port'));
});


var fortunes = [
    "Победи свои страхи, или они победят тебя.",
    "Рекам нужны истоки.",
    "Не бойся неведомого.",
    "Тебя ждет приятный сюрприз.",
    "Будь проще везде, где только можно.",
];