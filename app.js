var http = require('http');
var express = require('express');
var exphbs = require('express-handlebars');
var config = require('./config');
var formidable = require('formidable');
var jqupload = require('jquery-file-upload-middleware' );
var credentials = require('./credentials');
var compress = require('compression');
var nodemailer = require('nodemailer');
var mongoose = require('mongoose');

var mailTransport = nodemailer.createTransport('SMTP',{
    service: 'Gmail',
    auth: {
        user: credentials.gmail.user,
        pass: credentials.gmail.password,
    }
});

mongoose.connect(credentials.mongo.development.connectString);
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
    // we're connected!
    console.log("Connected correctly to server");
});

var app = express();
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

// use domains for better error handling
app.use(function(req, res, next){
    // create a domain for this request
    var domain = require('domain').create();
    // handle errors on this domain
    domain.on('error', function(err){
        console.error('DOMAIN ERROR CAUGHT\n', err.stack);
        try {
            // failsafe shutdown in 5 seconds
            setTimeout(function(){
                console.error('Failsafe shutdown.');
                process.exit(1);
            }, 5000);

            // disconnect from the cluster
            var worker = require('cluster').worker;
            if(worker) worker.disconnect();

            // stop taking new requests
            server.close();

            try {
                // attempt to use Express error route
                next(err);
            } catch(error){
                // if Express error route failed, try
                // plain Node response
                console.error('Express error mechanism failed.\n', error.stack);
                res.statusCode = 500;
                res.setHeader('content-type', 'text/plain');
                res.end('Server error.');
            }
        } catch(error){
            console.error('Unable to send 500 response.\n', error.stack);
        }
    });

    // add the request and response objects to the domain
    domain.add(req);
    domain.add(res);

    // execute the rest of the request chain in the domain
    domain.run(next);
});

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
    res.locals.partials.articleContext = getArticleData();
    res.locals.partials.postContext = getPostData();
    next();
});

app.use(function(req, res, next){
    if(!res.locals.partials) res.locals.partials = {};

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

app.get(['/', '/login'], function(req, res) {
    res.render('login');
});

app.get('/home', function(req, res){
    res.render('home');
});


app.get('/about', function(req, res){
    var randomeFortune = fortunes[Math.floor(Math.random() * fortunes.length)];
    res.render('about', {
        fortune: randomeFortune,
        pageTestScript: '/qa/test-about.js'
    });
});

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


var fortunes = [
    "Победи свои страхи, или они победят тебя.",
    "Рекам нужны истоки.",
    "Не бойся неведомого.",
    "Тебя ждет приятный сюрприз.",
    "Будь проще везде, где только можно.",
];

function getArticleData() {
    return {
        articles: [
            {
                image: 'img/js_file_encr.jpg',
                heading: 'Encryption App',
                titleDiscription: 'Title description',
                publicDate: 'April 7, 2014',
                text: 'Mauris neque quam, fermentum ut nisl vitae, convallis maximus nisl. Sed mattis nunc id lorem euismod placerat. Vivamus porttitor magna enim, ac accumsan tortor cursus at. Phasellus sed ultricies mi non congue ullam corper. Praesent tincidunt sed tellus ut rutrum. Sed vitae justo condimentum, porta lectus vitae, ultricies congue gravida diam non fringilla.',
                fullText: ''
            },
            {
                image: 'img/learning-react-real-time-node.png',
                heading: 'Build a real time app',
                titleDiscription: 'Title description',
                publicDate: 'April 2, 2014',
                text: 'Mauris neque quam, fermentum ut nisl vitae, convallis maximus nisl. Sed mattis nunc id lorem euismod placerat. Vivamus porttitor magna enim, ac accumsan tortor cursus at. Phasellus sed ultricies mi non congue ullam corper. Praesent tincidunt sed tellus ut rutrum. Sed vitae justo condimentum, porta lectus vitae, ultricies congue gravida diam non fringilla.',
                fullText: ''
            },
            {
                image: 'img/js_2.jpg',
                heading: 'Encryption App',
                titleDiscription: 'Title description',
                publicDate: 'April 7, 2014',
                text: 'Mauris neque quam, fermentum ut nisl vitae, convallis maximus nisl. Sed mattis nunc id lorem euismod placerat. Vivamus porttitor magna enim, ac accumsan tortor cursus at. Phasellus sed ultricies mi non congue ullam corper. Praesent tincidunt sed tellus ut rutrum. Sed vitae justo condimentum, porta lectus vitae, ultricies congue gravida diam non fringilla.',
                fullText: ''
            }
        ]
    }
}

function getPostData() {
    return {
        posts: [
            {
                image: '/img/js_cube.jpg',
                heading: 'Some info about ES7',
                description: 'Sed mattis nunc'
            },
            {
                image: '/img/js_cube.jpg',
                heading: 'Some info about ES7',
                description: 'Sed mattis nunc'
            },
            {
                image: '/img/js_cube.jpg',
                heading: 'Some info about ES7',
                description: 'Sed mattis nunc'
            }
        ]
    }
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