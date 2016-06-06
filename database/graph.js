var routes = require('./routes.js');
var location = require('./location.js');
var mail = require('./mail.js');
var customerprice = require('./customerprice.js');

var segments = [];
var nodes = {};
var prices = [];
var days = {"Sunday" : 0, "Tuesday": 1, "Wednesday" : 2, "Thursday" : 3, "Friday" : 4, "Saturday" : 5, "Monday" : 6};
var isGraphLoaded = false;

/**
* @param {mail} mail being delivered
*/
var findRoute = function(mail){
  this.data = new mailRouteData();
  //if graph hasn't loaded,return error
  if(!isGraphLoaded){
    this.data.errorMessage = "The graph has not finished loading";
    return this.data;
  }
  //check if we have a price for this routes
  for(var price in prices){
    if(price.destination === mail.destination && price.origin === mail.origin){
      this.wCost = price.weightcost * mail.weight;
      this.vCost = price.volumecost * mail.volume;
      this.data.costToCustomer = this.wCost + this.vCost;
      break;
    }
    this.data.errorMessage = "We don't ship from" + mail.origin + " to " + mail.destination;
    return this.data;
  }

  if(mail.priority.toUpperCase() === "DOMESTIC PRIORITY" || mail.priority.toUpperCase() === "DOMESTIC STANDARD"){
    if(mail.destination.international > 0){
      this.data.errorMessage = "This mail must be sent via International Priority";
      return this.data;
    }
    return findDomesticRoute(mail, this.data);
  }
  if(mail.priority.toUpperCase() === "INTERNATIONAL PRIORITY"){
    if(mail.destination.international == 0){
      this.data.errorMessage = "This mail must be sent via Domestic Priority";
      return this.data;
    }
    return findInternationalAirRoute(mail, this.data);
  }
  if(mail.priority.toUpperCase() === "INTERNATIONAL STANDARD"){
    if(mail.destination.international == 0){
      this.data.errorMessage = "This mail must be sent via Domestic Priority";
      return this.data;
    }
    return findInternationalStandardRoute(mail, this.data);
  }
}

var findDomesticRoute = function(mail, data){
  //Create a set of all the unvisited nodes called the unvisited set and init node values
  var unvisited = [];
  for(var node in nodes){
    unvisited.push(nodes[node]);
    nodes[node].distance =  Number.POSITIVE_INFINITY;
    nodes[node].visited = false;
    nodes[node].fromSegment = null;
  }
  this.data = data;
  this.currentNode = nodes[mail.origin];
  this.currentNode.distance = 0;
  var sentDate = new Date().getTime();

  while(true){
    this.currentNode.visited = true;
    //If the destination node has been visited then stop. The algorithm has finished.
    if(nodes[mail.destination].visited){
      console.log("Reached Destination. Route:");
      this.cost = 0;
      this.currentNode = nodes[mail.destination];
      while(this.currentNode != nodes[mail.origin]){
        this.data.routeTaken.push(this.currentNode.fromSegment.id);
        console.log(this.currentNode.name + " from " + this.currentNode.fromSegment.startNode.name);
        this.cost += (this.currentNode.fromSegment.weightCost * mail.weight) + (this.currentNode.fromSegment.volumeCost * mail.volume);
        this.currentNode = this.currentNode.fromSegment.startNode;
      }
      this.data.routeTaken.reverse();
      this.data.costToCompany = this.cost;
      this.data.errorMessage = false;
      console.log("");
      return this.data;
    }
    //date and time mail arrived at current node
    this.arrivalTime = sentDate + this.currentNode.distance;

    //For the current node consider all of its unvisited neighbors
      for(var segmentId in this.currentNode.segments){
        var segment = this.currentNode.segments[segmentId];
        if(!segment.endNode.visited && segment.maxWeight >= mail.weight && segment.maxVolume >= mail.volume){

          //calculate time for next departure
          this.currentDay = new Date(this.arrivalTime).getDay();
          this.routeStart = days[segment.day];
          this.hours = ((this.arrivalTime) / 3600000) % 24;
          this.days = 0;
          if(this.currentDay === this.routeStart){
            this.days = 0;
          }
          if(this.currentDay < this.routeStart){
            this.days = 7 - this.routeStart + this.currentDay;
          }
          else{
            this.days = this.currentDay - this.routeStart;
          }

          this.waitTime = (segment.frequency - ((24 * this.days + this.hours) % segment.frequency));
          }

          //calculate tentative distance. Compare tentative distance to the current assigned value
          //assign the smaller one.

          if((this.currentNode.distance + segment.duration + this.waitTime) < segment.endNode.distance){
            segment.endNode.distance = this.currentNode.distance + segment.duration + this.waitTime;
            segment.endNode.fromSegment = segment;
          }
        }
      //When we are done considering all of the neighbors of the current node,
      //remove node from unvisited
      //A visited node will never be checked again.
      this.index = unvisited.indexOf(this.currentNode);
      if(index >= 0){
        unvisited.splice(index, 1);
      }

      //get the node with the smallest distance from unvisited
      this.smallestNode;
      for(var nodeId in unvisited){
        var node = unvisited[nodeId];
        if(nodeId == 0){
          this.smallestNode = node;
        }
        else if(this.smallestNode.distance > node.distance){
          this.smallestNode = node;
        }
      }

      //if the smallest distance in the unvisited set is infinity, the graph is not connected
      if(this.smallestNode.distance == Number.POSITIVE_INFINITY){
        console.log("No route");
        this.data.errorMessage = "No route";
        return this.data;
      }

      // Otherwise, select the unvisited node that is marked with the smallest tentative distance, set it as the new "current node", and go back to step 3.
      this.currentNode = this.smallestNode;
  }

}

var findInternationalAirRoute = function(mail, data){
  //Create a set of all the unvisited nodes called the unvisited set and init node values
  var unvisited = [];
  for(var node in nodes){
    unvisited.push(nodes[node]);
    //init values
    nodes[node].distance =  Number.POSITIVE_INFINITY;
    nodes[node].visited = false;
    nodes[node].fromSegment = null;
  }

  this.data = data;
  //Set up starting node
  this.currentNode = nodes[mail.origin];
  this.currentNode.distance = 0;
  var sentDate = new Date().getTime();

  while(true){
    this.currentNode.visited = true;

    //If the destination node has been visited then stop. The algorithm has finished.
    if(nodes[mail.destination].visited){
      console.log("Reached Destination. Route:");
      this.cost = 0;
      this.currentNode = nodes[mail.destination];
      while(this.currentNode != nodes[mail.origin]){
        this.data.routeTaken.push(this.currentNode.fromSegment.id);
        console.log(this.currentNode.name + " from " + this.currentNode.fromSegment.startNode.name);
        this.cost += (this.currentNode.fromSegment.weightCost * mail.weight) + (this.currentNode.fromSegment.volumeCost * mail.volume);
        this.currentNode = this.currentNode.fromSegment.startNode;
      }
      this.data.routeTaken.reverse();
      this.data.costToCompany = this.cost;
      this.data.errorMessage = false;
      console.log("");
      return this.cost;
    }
    //date and time mail arrived at current node
    this.arrivalTime = sentDate + this.currentNode.distance;

    //For the current node consider all of its unvisited neighbors
      for(var segmentId in this.currentNode.segments){
        var segment = this.currentNode.segments[segmentId];
        if(!segment.endNode.visited && segment.type === "Air" && segment.maxWeight >= mail.weight && segment.maxVolume >= mail.volume){
          //calculate time for next departure
          this.currentDay = new Date(this.arrivalTime).getDay();
          //calculate time for next departure
          this.routeStart = days[segment.day];
          this.hours = (this.arrivalTime / 3600000) % 24;
          if(this.currentDay === this.routeStart){
            this.days = 0;
          }
          if(this.currentDay < this.routeStart){
            this.days = 7 - this.routeStart + this.currentDay;
          }
          else{
            this.days = this.currentDay - this.routeStart;
          }
          this.waitTime = (segment.frequency - ((24 * this.days + this.hours) % segment.frequency));

          //calculate tentative distance. Compare tentative distance to the current assigned value
          //assign the smaller one.
          if((this.currentNode.distance + segment.duration + this.waitTime) < segment.endNode.distance){
            segment.endNode.distance = this.currentNode.distance + segment.duration + this.waitTime;
            segment.endNode.fromSegment = segment;
          }
        }
      }

      //When we are done considering all of the neighbors of the current node,
      //remove node from unvisited
      //A visited node will never be checked again.
      this.index = unvisited.indexOf(this.currentNode);
      if(index >= 0){
        unvisited.splice(index, 1);
      }

      //get the node with the smallest distance from unvisited
      this.smallestNode;
      for(var nodeId in unvisited){
        var node = unvisited[nodeId];
        if(nodeId == 0){
          this.smallestNode = node;
        }
        else if(this.smallestNode.distance > node.distance){
          this.smallestNode = node;
        }
      }

      //if the smallest distance in the unvisited set is infinity, the graph is not connected
      if(this.smallestNode.distance == Number.POSITIVE_INFINITY){
        console.log("No route");
        this.data.errorMessage = "No route";
        return this.data;
      }

      // Otherwise, select the unvisited node that is marked with the smallest tentative distance, set it as the new "current node", and go back to step 3.
      this.currentNode = this.smallestNode;
  }
}

var findInternationalStandardRoute = function(mail, data){

  //Create a set of all the unvisited nodes called the unvisited set and init node values
  var unvisited = [];
  for(var node in nodes){
    unvisited.push(nodes[node]);
    //init values
    nodes[node].distance =  Number.POSITIVE_INFINITY;
    nodes[node].visited = false;
    nodes[node].fromSegment = null;
  }

  this.data = data;

  //set up starting node
  this.currentNode = nodes[mail.origin];
  this.currentNode.distance = 0;

  while(true){
    this.currentNode.visited = true;

    //If the destination node has been visited then stop. The algorithm has finished.
    if(nodes[mail.destination].visited){
      console.log("Reached Destination. Route:");
      this.cost = 0;
      this.currentNode = nodes[mail.destination];
      while(this.currentNode != nodes[mail.origin]){
        this.data.routeTaken.push(this.currentNode.fromSegment.id);
        console.log(this.currentNode.name + " from " + this.currentNode.fromSegment.startNode.name);
        this.cost += (this.currentNode.fromSegment.weightCost * mail.weight) + (this.currentNode.fromSegment.volumeCost * mail.volume);
        this.currentNode = this.currentNode.fromSegment.startNode;
      }
      this.data.routeTaken.reverse();
      this.data.costToCompany = this.cost;
      this.data.errorMessage = false;
      console.log("");
      return this.data;
    }
    //For the current node consider all of its unvisited neighbors
      for(var segmentId in this.currentNode.segments){
        var segment = this.currentNode.segments[segmentId];
        if(!segment.endNode.visited && segment.maxWeight >= mail.weight && segment.maxVolume >= mail.volume){
          //Add weighting penalty for using air
          this.airPenalty = 0;
          if(segment.type === "Air"){
            this.airPenalty = 1000;
          }
          this.weightCost = mail.weight * segment.weightCost;
          this.volumeCost = mail.volume * segment.volumeCost;
          //calculate tentative cost. Compare tentative distance to the current assigned value
          //assign the smaller one.
          if((this.currentNode.distance + this.weightCost + this.volumeCost + this.airPenalty) < segment.endNode.distance){
            segment.endNode.distance = this.currentNode.distance + this.weightCost + this.volumeCost + this.airPenalty;
            segment.endNode.fromSegment = segment;
          }
        }
      }
      //When we are done considering all of the neighbors of the current node,
      //remove node from unvisited
      //A visited node will never be checked again.
      this.index = unvisited.indexOf(this.currentNode);
      if(index >= 0){
        unvisited.splice(index, 1);
      }

      //get the node with the smallest distance from unvisited
      this.smallestNode;
      for(var nodeId in unvisited){
        var node = unvisited[nodeId];
        if(nodeId == 0){
          this.smallestNode = node;
        }
        else if(this.smallestNode.distance > node.distance){
          this.smallestNode = node;
        }
      }

      //if the smallest distance in the unvisited set is infinity, the graph is not connected
      if(this.smallestNode.distance == Number.POSITIVE_INFINITY){
        console.log("No route");
        this.data.errorMessage = "No route";
        return this.data;
      }
      // Otherwise, select the unvisited node that is marked with the smallest tentative distance, set it as the new "current node", and go back to step 3.
      this.currentNode = this.smallestNode;
  }
}


var createPrices = function(customerprices){
  prices = customerprices;
  isGraphLoaded = true;
}

var createNodes = function(locs){
  if(typeof locs != 'undefined'){
    for(var i = 0;i < locs.length; i++){
      console.log(locs[i]);
      nodes[locs[i].name] = new node(locs[i].locationid, locs[i].name, locs[i].isInternational);
    }
    routes.getAllRoutes(createSegments);
  }
  else{
    console.log("Locs undefined");
  }
}

var createSegments = function(costs){
  if(typeof costs != 'undefined'){
    for(var i = 0; i < costs.length; i++){
      this.segment = new segment(costs[i].routeid, nodes[costs[i].origin], nodes[costs[i].destination], costs[i].type, costs[i].weightcost, costs[i].volumecost, costs[i].maxweight, costs[i].maxvolume, costs[i].duration, costs[i].frequency, costs[i].day);
      segments.push(this.segment);
      nodes[costs[i].origin].segments.push(this.segment);
    }
    customerprice.getAllPrices(createPrices);
  }
  else{
    console.log("Costs undefined: ");
  }
}

exports.loadGraph = function(){
    location.getAllLocations(createNodes);
}

var printAll = function(){
  console.log("Printing Nodes: ");
  for(var node in nodes){
    console.log(node);
  }
  console.log("Printing Segments: ");
  for(var seg in segments){
    console.log(seg);
  }
}

var testMail = function(){
  mail.getAllMail(mailFunction);
}

var mailFunction = function(mailList){
  for(var mail in mailList){
      console.log("Finding route from "+ mailList[mail].origin + " to " + mailList[mail].destination + " with priority " + mailList[mail].priority);
      mailList[mail].date = new Date();
      findRoute(mailList[mail]);
  }
}

/**
* @param {int} id Unique identifier
* @param {node} sNode Node where this segment originates
* @param {node} eNode Node where this segment terminates
* @param {string} type Type of transport, land, air or sea
* @param {int} wc weight cost
* @param {int} vc volume cost
* @param {int} mw max weightCost
* @param {int} mv max volumeCost
* @param {int} dur Time it takes this segment to transport
* @param {int} freq The frequency this segment sets out at
* @param {string} day Which day the transport cycle starts at
*/
var segment = function(id, sNode, eNode, type, wc, vc, mw, mv, dur, freq, day){
  this.id = id;
  this.startNode = sNode;
  this.endNode = eNode;
  this.type = type;
  this.weightCost = wc;
  this.volumeCost = vc;
  this.maxWeight = mw;
  this.maxVolume = mv;
  this.duration = dur;
  this.frequency = freq;
  this.day = day;

}

/**
* @param {int} id Unique identifier
* @param {string} name Name of location
* @param {int} inter Is location international
*/
var node = function(id, name, inter){
  this.id = id;
  this.name = name;
  this.segments = [];
  this.distance = Number.POSITIVE_INFINITY;
  this.visited = false;
  this.fromSegment = null;
  this.international = inter;
}


var mailRouteData = function(){
  this.routeTaken = [];//a list of route Id's, in order from origin to destination
  this.costToCompany;//total cost to company
  this.costToCustomer;//customer price
  this.errorMessage;//if search was success this is false, else it contains a string
}
