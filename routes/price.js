/**
 * Created by elliot on 17/06/16.
 */

var express = require('express');
var router = express.Router();


var Location = require('../database/location'),
	Price = require('../database/customerprice');


router.get("/", function(req, res){
  console.log('PRICE: GET');
  Location.getAllLocations(function(cb){
      Price.getAllPrices(function(prices){
          console.log(prices);
          res.render('updPrice', {priceActive: true, title: "Customer Prices", locations: cb, customerprices: prices});
      });
  });
});

router.post("/", function(req, res){
    console.log("PRICE: POST");
    console.log(req.body);
    var err = [];
    if (!req.body.sourceLocation) {err.push('Origin cannot be Blank.');}
    if (!req.body.destLocation) {err.push('Destination cannot be Blank.');}
    if (!req.body.wgt) {err.push('Weight Price cannot be Blank.');}
    if (!req.body.vol) {err.push('Volume Price cannot be Blank.');}
    console.log(err);
    if (err.length) {
        Location.getAllLocations(function(cb){
            Price.getAllPrices(function(prices){
                console.log(prices);
                res.render('updPrice', {priceActive: true, title: "Customer Prices", locations: cb, customerprices: prices, error: err});
            });
        });
    } else {
        var price = req.body;
        console.log('insert');
        console.log('origin: ' + price.sourceLocation);
        console.log('destination: ' + price.destLocation);

        Price.insertCustomerPrice({
            origin: price.sourceLocation,
            destination: price.destLocation,
            weightcost: price.wgt,
            volumecost: price.vol,
            priority: price.priority
        }, function (result){
            console.log(result);
            Location.getAllLocations(function(allLocations){
               Price.getAllPrices(function(allPrices){
                   res.render('updPrice', {priceActive: true, title: "Customer Prices", locations: allLocations, customerprices: allPrices, notify: "Price successfully inserted"});
               });
            });
        });
    }
});

router.get("/:customerpriceid", function(req, res){
    var customerpriceid = req.params.customerpriceid;
    Price.getPriceById(customerpriceid, function(customerprice){
        console.log(customerprice);
        Location.getAllLocations(function(allLocations){
            console.log(allLocations);
            res.render('updatePrice', {
                priceActive: true,
                title: "Customer Prices",
                locations: allLocations,
                customerprice: customerprice,
                customerpriceid: customerpriceid
            });
        });
    });
});

router.post("/delete/:priceid", function(req,res){
    var priceid = req.params.priceid;
    Price.deleteCustomerPrice(priceid, function(result){
       console.log(result);
        Location.getAllLocations(function(allLocations){
           if(result){
               Price.getAllPrices(function(allPrices){
                   res.render('updPrice', {priceActive: true, title: "Customer Prices", locations: allLocations, customerprices: allPrices, notify: "Price successfully deleted", notifyType:"warning"});
               });
           } else {
               Price.getPriceById(priceid, function(customerprice){
                   console.log(customerprice);
                   res.render('updatePrice', {
                       priceActive: true,
                       title: "Customer Prices",
                       locations: allLocations,
                       customerprice: customerprice,
                       priceid: priceid,
                       notify: "Error deleting price",
                       notifyType: "danger"
                   });
               });
           }
        });
    });
});

router.post("/update/:priceid", function(req,res){
    var customerprice = req.body;
    var priceid = req.params.priceid;
    Price.updateCustomerPrice(priceid, customerprice, function(result){
       console.log(result);
        Location.getAllLocations(function(allLocations){
           if(result){
               Price.getAllPrices(function(allPrices){
                   res.render('updPrice', {priceActive: true, title: "Customer Prices", locations: allLocations, customerprices: allPrices, notify: "Price successfully updated", notifyType:"warning"});
               });
           } else {
               Price.getPriceById(priceid, function(customerprice){
                   console.log(customerprice);
                   res.render('updatePrice', {
                       priceActive: true,
                       title: "Customer Prices",
                       locations: allLocations,
                       customerprice: customerprice,
                       priceid: priceid,
                       notify: "Error updating price",
                       notifyType: "danger"
                   });
               });
           }
        });
    });
});

module.exports = router;