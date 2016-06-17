/*
	Copyright (c) 2016 Team 9: Harman, Neel, Paige, Elliot, David

	Permission is hereby granted, free of charge, to any person, except one that is enrolled
	in SWEN301: Structured Methods at Victoria University of Wellington,
	obtaining a copy of this software and associated documentation files (the "Software"),
	to deal in the Software without restriction, including without limitation the rights
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

*/


var express = require('express'),
    bodyParser = require('body-parser'),
    cookieParser = require('cookie-parser'),
    nunjucks = require('nunjucks'),
    assert = require('assert'),
    session = require('express-session'),
    Database = require('./database/database').Database,
    //following are used to interact with the database.
    Company = require('./database/company'),
    Mail = require('./database/mail').Mail,
    Location = require('./database/location'),
    Route = require('./database/routes'),
    Price = require('./database/customerprice'),
    Managers = require('./database/managers'),
    Graph = require('./database/graph'),
    logFile = require('./database/logFile.js');
    findRoute = Graph.findRoute;


// Set up express
app = express();
app.set('view engine', 'html');
app.set('views', __dirname + '/views');
app.use('/static', express.static(__dirname + '/static'));
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(cookieParser());
app.use(session({secret: 'apparentlythishastobeaverylongsessionsecret', resave: false, saveUninitialized: true}));

/*
 Configure nunjucks to work with express
 Not using consolidate because I'm waiting on better support for template inheritance with
 nunjucks via consolidate. See: https://github.com/tj/consolidate.js/pull/224
*/
var env = nunjucks.configure('views', {
    autoescape: true,
    express: app
});
/*
    Custom methods for nunjucks
 */
var nunjucksEnv = new nunjucks.Environment();

env.addFilter('isMailOrigin', function(locationid, mail) {
    return mail ? locationid == mail.origin : false;
});

env.addFilter('isMailDestination', function(locationid, mail) {
    return mail ? locationid == mail.destination : false;
});


var nunjucksDate = require('nunjucks-date');
nunjucksDate.setDefaultFormat('YYYY-MM-Do, hh:mm:ss');
env.addFilter("date", nunjucksDate);

var router = express.Router();


/**
 * Initialise the database.
 */
var database = new Database().init();
Mail = new Mail();
var logfile = logFile.logFile();
// Graph.loadGraph();


// Homepage
router.get("/", function(req, res) {
	"use strict";
	res.render('index',{title: "Dashboard", homeActive: true});
});

// Login page
router.get("/login", function (req, res) {
    "use strict";
    Managers.getAllManagers(function(result){
        console.log(result);
    });
    res.render('login', {});
});

router.post("/login", function(req, res) {
    console.log(req.body);
    var manager = req.body;
    var username = req.body.username;
    var password = req.body.password;
    Managers.loginManager(username, password, function(result){
        console.log("inside loginmanager function");
        console.log(result);
        if (result){
            req.session.manager = manager; //save user in session
        }
        res.render("index", {loggedin: req.session.manager ? true : false, error: "Invalid code."});
    });
});

router.get("/logFile", function(req, res) {
    "use strict";
    if(req.session.manager) {
        res.render('logFile', {loggedin: req.session.manager ? true : false});
    }
    else{
        res.render('login', {loggedin: req.session.manager ? true : false});
    }
});

router.get("/logout",function(req,res) {
    "use strict"
    console.log("POST: /logout");
    req.session.manager = null;
    console.log(req.session.manager ? true : false);
    res.render('index', {loggedin: req.session.manager ? true : false});
});

router.get("/graph", function (req, res) {
    "use strict";
    Graph.loadGraph();
    res.render('index', {title: "Dashboard", loggedin: req.session.manager ? true : false, homeActive: true});
});

// Location routes
router.use('/locations', require('./routes/locations'));

// Customer Price routes
router.use('/price', require('./routes/price'));

// Route Cost routes
router.use('/cost', require('./routes/routecost'));


//company
router.get("/companies", function(req, res) {
    "use strict";
    Company.getAllCompanies(function(allCompanies){
        res.render('company', {companyActive: true, title: "Company", loggedin: req.session.manager ? true : false, companies: allCompanies});
    });
});

router.get("/companies/:companyid", function(req, res){
    var companyid = req.params.companyid;
    Company.getCompanyById(companyid, function(company){
        console.log(company);
        res.render('updateCompany', {
            companyActive: true,
            title: "Update Company",
            loggedin: req.session.manager ? true : false,
            companyid: companyid,
            company: company
        });
    });
});

router.post("/companies/delete/:companyid", function(req,res){
    var companyid = req.params.companyid;

    Company.deleteCompany(companyid, function(result){
        console.log(result);
        if(result){
            //success
            Company.getAllCompanies(function(allCompanies){
                res.render('company', {companyActive: true, title: "Company", loggedin: req.session.manager ? true : false, companies: allCompanies, notify: "company successfully deleted", notifyType:"warning"});
            });
        } else {
            Company.getCompanyById(companyid, function(company){
                res.render('updateCompany', {
                    companyActive: true,
                    title: "Update Company",
                    loggedin: req.session.manager ? true : false,
                    companyid: companyid,
                    company: company,
                    notify: "Error deleting company: " + company.name,
                    notifyType: "danger"
                });
            });
        }
    });
});

router.post("/companies/update/:companyid", function(req,res){
    var company = req.body;
    var companyid = req.params.companyid;
    Company.updateCompany(companyid, company, function(result){
        console.log(result);
        if (result){
            Company.getAllCompanies(function(allCompanies){
                res.render('company', {companyActive: true, title: "Company", loggedin: req.session.manager ? true : false, companies: allCompanies, notify: company.name + " successfully updated", notifyType: "warning"});
            });
        } else {
            //could not update the location
            Company.getCompanyById(companyid, function(company){
                res.render('updateCompany', {
                    companyActive: true,
                    title: "Update Company",
                    loggedin: req.session.manager ? true : false,
                    companyid: companyid,
                    company: company,
                    notify: "Error deleting company: " + company.name,
                    notifyType: "danger"
                });
            });
        }
    });
});

router.post("/companies", function (req, res) {
    console.log(req.body);
    var newCompany = req.body;
    Company.insertCompany(newCompany, function (result) {
        console.log(result);
        Company.getAllCompanies(function (allCompanies) {
            if (result) {
                res.render('company', {
                    companyActive: true,
                    title: "Company",
                    loggedin: req.session.manager ? true : false,
                    companies: allCompanies,
                    notify: "Successfully added: " + newCompany.name
                });
            } else {
                res.render('company', {
                    companyActive: true, title: "Company",
                    loggedin: req.session.manager ? true : false,
                    companies: allCompanies,
                    notify: "Error occurred",
                    notifyType: "danger"
                });
            }
        });
    });
});

router.post("/addMail", function(req,res, next){
   "use strict";
    console.log("/addMail");
    console.log(req.body);
    var mail = req.body;
    req.session.mail = mail; //save mail in session
    var error = ""; //server side error message to be displayed
    //server-side error checking. Destination and origin cannot be the same
    if (mail.destination == mail.origin) {
        if (mail.destination) {
            error += "Unknown error occurred.\n";
        }
        error += "Destination cannot be same as Origin.";
        Location.getAllLocations(function (locations) {
            Mail.getAllMail(function (mails) {
                res.status(404);
                res.render('mails', {
                    mailActive: true,
                    title: "Mails",
                    loggedin: req.session.manager ? true : false,
                    error: error,
                    mail: mail,
                    mails: mails,
                    locations: locations
                });
            });
        });
    } else {
        //perform error checking such as determine if route can be calculated
        /*
         If route can be calculated then update the business and customer cost
         Then add mail to event and insert into database
         */
        /**
         * 1. render the confirmation page while sending the mail object
         */
        Graph.loadGraph(function() {
            Location.getLocationById(mail.origin, function (originLocation) {
                Location.getLocationById(mail.destination, function (destinationLocation) {
                    var testMail = {
                        origin: originLocation.name,
                        destination: destinationLocation.name,
                        weight: mail.weight,
                        volume: mail.volume,
                        priority: mail.priority
                    };
                    console.log(testMail);
                    var mailFindRoute = findRoute(testMail);
                    console.log("mailFindRoute:");
                    console.log(mailFindRoute);
                    if(mailFindRoute.routeTaken.length > 0 && !mailFindRoute.errorMessage) {
                        mail.totalcustomercost = mailFindRoute.costToCustomer;

                        mail.totalbusinesscost = mailFindRoute.costToCompany;
                        res.render('confirmMail', {
                            mail: mail,
                            title: "Mails",
                            loggedin: req.session.manager ? true : false,
                            origin: originLocation,
                            destination: destinationLocation,
                            mailActive: true
                        });
                    } else {
                        Location.getAllLocations(function(locations){
                            console.log(locations);
                            Mail.getAllMail(function(mails){
                                res.render('mails', {
                                    mailActive: true,
                                    title: "Mails",
                                    loggedin: req.session.manager ? true : false,
                                    mail: req.session.mail,
                                    mails: mails,
                                    locations: locations,
                                    error: mailFindRoute.errorMessage,
                                    notify: "Could not add Mail",
                                    notifyType: "danger"
                                });
                            });
                        });
                    }
                });
            });
        });
    }
});

router.get('/confirmMail', function(req,res){
    //insert mail
    console.log
    var mail = req.session.mail;
    console.log('confirmMail');
    console.log(mail);
    Mail.insertMail(mail, function (result) {
        console.log("mail entered");
        console.log(result);
        Location.getAllLocations(function(locations){
            Mail.getAllMail(function(mails){
                if (result) {
                    //add notification of mail added successfully
                    res.render('mails', {
                        mailActive: true,
                        title: "Mails",
                        loggedin: req.session.manager ? true : false,
                        mailAdded: true,
                        locations: locations,
                        mails: mails,
                        notify: "Successfully inserted Mail"
                    });
                    req.session.mail = null;

                } else {
                    //could not insert mail
                    res.render('mails', {
                        mailActive: true,
                        title: "Mails",
                        loggedin: req.session.manager ? true : false,
                        mailAdded: true,
                        locations: locations,
                        mails: mails,
                        notify: "Error occurred",
                        notifyType: "danger"
                    });
                }
            });
        });
    });
});

router.get("/mails", function(req, res) {
	"use strict";
    Location.getAllLocations(function(locations){
        console.log(locations);
        Mail.getAllMail(function(mails){
            res.render('mails', {
                mailActive: true,
                title: "Mails",
                loggedin: req.session.manager ? true : false,
                mail: req.session.mail,
                mails: mails,
                locations: locations
            });
        });
    });
});




// Use the router routes in our application
app.use('/', router);

// Start the server listening
var server = app.listen(3000, function() {
	var port = server.address().port;
	console.log('KPSmart App listening on port %s.', port);
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
	res.status(err.status || 500);
	//TODO: add error.html page --> res.render('error',{err : {message : err.message, error: err}});
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  //TODO: add error.html page --> res.render('error', {err : {message : err.message, error : {}}});
});

module.exports = server;
