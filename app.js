var http = require('http');
var express = require('express');
var exphbs = require('express-handlebars');
var config = require('./config');
var formidable = require('formidable');
var jqupload = require('jquery-file-upload-middleware' );
var credentials = require('./credentials');
var compress = require('compression');
// var morgan = require('morgan');
var nodemailer = require('nodemailer');

var mailTransport = nodemailer.createTransport('SMTP',{
    service: 'Gmail',
    auth: {
        user: credentials.gmail.user,
        pass: credentials.gmail.password,
    }
});

var app = express();

switch(app.get('env')){
    case 'development':
    // сжатое многоцветное журналирование для
    // разработки
    app.use(require('morgan')('dev'));
        break;
    case 'production':
    // модуль 'express-logger' поддерживает ежедневное
    // чередование файлов журналов
    app.use(require('express-logger')({
        path: __dirname + '/log/requests.log'
    }));
        break;
}


// app.use(morgan('combined'));

app.disable('x-powered-by');


hbs = exphbs.create({
    defaultLayout: 'main',
    extname: '.hbs',
    helpers: {
        section: function(name, options) {
            if(!this._sections) this._sections = {};
            this._sections[name] = options.fn(this);
            return null;
        }
    }
});

app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');

app.set('port', process.env.PORT || config.port);

app.use(require('cookie-parser')(credentials.cookieSecret));
app.use(require('express-session')({
    resave: false,
    saveUninitialized: false,
    secret: credentials.cookieSecret,
}));

app.use(function(req, res, next){
    res.locals.showTests = app.get('env') !== 'production' && req.query.test === '1';
    next();
});

app.use(function(req, res, next){
    if(!res.locals.partials) res.locals.partials = {};
    res.locals.partials.weatherContext = getWeatherData();
    next();
});


app.use(function(req, res, next){
    // Если имеется экстренное сообщение,
    // переместим его в контекст, а затем удалим
    res.locals.flash = req.session.flash;
    delete req.session.flash;
    next();
});

app.use(compress());


// app.use(function(req,res,next){
//     var cluster = require('cluster');
//     if(cluster.isWorker) console.log('Исполнитель %d получил запрос', cluster.worker.id);
// });

app.get('/newsletter', function(req, res) {
    res.render('newsletter', {csrf: 'CSRF token goes here'});
});

app.post('/process', function(req, res) {
    console.log('Form (from querystring): ' + req.query. form);
    console.log('CSRF token (from hidden form field): ' + req.body._csrf);
    console.log('Name (from visible form field): ' + req.body.name);
    console.log('Email (from visible form field): ' + req.body.email);
    res.redirect(303, '/thank-you' );
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

app.get('/nursery-rhyme', function(req, res){
    res.render('nursery-rhyme');
});

app.get('/data/nursery-rhyme', function(req, res){
    res.json({
        animal: 'бельчонок',
        bodyPart: 'хвост',
        adjective: 'пушистый',
        noun: 'черт',
    });
});

app.get('/contest/vacation-photo', function(req, res) {
    var now = new Date();
    res.render('contest/vacation-photo', {
        year: now.getFullYear(),
        month: now.getMonth()
    });
});

app.post('/contest/vacation-photo/:year/:month' , function(req, res){
    var form = new formidable. IncomingForm();
    form.parse(req, function(err, fields, files){
        if(err) return res.redirect(303, '/error' );
        console.log('received fields:' );
        console.log(fields);
        console.log('received files:' );
        console.log(files);
        res.redirect(303, '/thank-you' );
    });
});

app.post('/process', function(req, res){
    if(req.xhr || req.accepts('json,html' )==='json' ){
        // если здесь есть ошибка, то мы должны отправить { error: 'описание ошибки' }
        res.send({ success: true });
    } else {
        // если бы была ошибка, нам нужно было бы перенаправлять на страницу ошибки
        res.redirect(303, '/thank-you' );
    }
});

app.post('/cart/checkout', function(req, res){
    var cart = req.session.cart;
    if(!cart) next(new Error('Корзина не существует.'));
    var name = req.body.name || '',
        email = req.body.email || '';
    // Проверка вводимых данных
    if(!email.match(VALID_EMAIL_REGEX))
        return res.next(new Error('Некорректный адрес         электронной '+'почты.'));
    // Присваиваем случайный идентификатор корзины;
    // При обычных условиях мы бы использовали
    // здесь идентификатор из БД
    cart.number = Math.random().toString().replace(/^0\.0*/, '');
    cart.billing = {
        name: name,
        email: email,
    };
    res.render('email/cart-thank-you', { layout: null, cart: cart }, function(err,html){
        if( err ) console.log('ошибка в шаблоне письма');
        mailTransport.sendMail({
            from: '"Meadowlark Travel": info@meadowlarktravel.com',
            to: cart.billing.email,
            subject: 'Спасибо за заказ поездки' + 'в Meadowlark',
            html: html,
            generateTextFromHtml: true
        }, function(err){
            if(err) console.error('Не могу отправить подтверждение: ' + err.stack);
        });
    }
    );
    res.render('cart-thank-you', { cart: cart });
});


app.use('/upload', function(req, res, next){
    var now = Date.now();
    jqupload. fileHandler({
        uploadDir: function(){
            return __dirname + '/public/uploads/' + now;
        },
        uploadUrl: function(){
            return '/uploads/' + now;
        },
    })(req, res, next);
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

app.use(function(err, req, res, next){
    console.error(err.stack);
    app.status(500).render('500');
});

var fortunes = [
    "Победи свои страхи, или они победят тебя.",
    "Рекам нужны истоки.",
    "Не бойся неведомого.",
    "Тебя ждет приятный сюрприз.",
    "Будь проще везде, где только можно.",
];

function getWeatherData(){
    return {
        locations: [
            {
                name: 'Портленд',
                forecastUrl: 'http://www.wunderground.com/US/OR/Portland.html',
                iconUrl: 'http://icons-ak.wxug.com/i/c/k/cloudy.gif',
                weather: 'Сплошная облачность ',
                temp: '54.1 F (12.3 C)',
            },
            {
                name: 'Бенд',
                forecastUrl: 'http://www.wunderground.com/US/OR/Bend.html',
                iconUrl: 'http://icons-ak.wxug.com/i/c/k/partlycloudy.gif',
                weather: 'Малооблачно',
                temp: '55.0 F (12.8 C)',
            },
            {
                name: 'Манзанита',
                forecastUrl: 'http://www.wunderground.com/US/OR/Manzanita.html',
                iconUrl: 'http://icons-ak.wxug.com/i/c/k/rain.gif',
                weather: 'Небольшой дождь',
                temp: '55.0 F (12.8 C)',
            },
        ],
    };

}

var server;

function startServer() {
    server = http.createServer(app).listen(app.get('port'), function(){
        console.log( 'Express started in ' + app.get('env') +
            ' mode on http://localhost:' + app.get('port') +
            '; press Ctrl-C to terminate.' );
    });
}

if(require.main === module){
    // application run directly; start app server
    startServer();
} else {
    // application imported as a module via "require": export function to create server
    module.exports = startServer;
}