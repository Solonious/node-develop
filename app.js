var express = require('express');
var exphbs = require('express-handlebars');
var config = require('./config');

var app = express();

app.disable('x-powered-by');

hbs = exphbs.create({
    defaultLayout: 'main',
    extname: '.hbs'
});

app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');

app.set('port', process.env.PORT || config.port);

app.use(function(req, res, next){
    res.locals.showTests = app.get('env') !== 'production' && req.query.test === '1';
    next();
});

app.get('/', function(req, res){
    res.render('home');
});

app.get('/about', function(req, res){
    var randomeFortune = fortunes[Math.floor(Math.random() * fortunes.length)];
    res.render('about', {
        fortune: randomeFortune,
        pageTestScript: '/qa/test-about.js'
    });
});

app.get('/tours/hood-river', function(req,res) {
    res.render('tours/hood-river');
});

app.get('/tours/request-group-rate', function(req,res) {
    res.render('tour/request-group-rate');
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
    console.log( 'Express listenning ' + config.protocol + '://' + config.host + ':' + app.get('port'));
});


var fortunes = [
    "Победи свои страхи, или они победят тебя.",
    "Рекам нужны истоки.",
    "Не бойся неведомого.",
    "Тебя ждет приятный сюрприз.",
    "Будь проще везде, где только можно.",
];