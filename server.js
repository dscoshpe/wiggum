
var globalConfig = {
    port: {
    	management: 8000,
    	wlan: 9000,
    	lan: 9001
	}
}

var express = require('express');
var app = express();
var net = require('net');
var carrier = require('carrier');
var macDb = require('mac-lookup');
var fs = require('fs');

var server = net.createServer(function(socket) {
	//socket.setNoDelay(true);
	var my_carrier = carrier.carry(socket, function(line) {
		if (line.trim() != '') {
			try {
				updateList(JSON.parse(line));
			} catch(e) {
				console.log(e.name + ': ' + e.message);
			}
		}
	});
});

// TODO: track recent new stations

/*
	actions:
		like - do substring match
		exists - just check if one/some objects exist?
		get - get summary info about 1 or more objects
		details - get complete dump of 1 or more objects
*/
/*
app.get('/stations/:action/*', function(req, res) {
	if (req.params.mac != "all") {
		res.send(JSON.stringify(stations[req.params.mac], null, "\t"));
	} else {
		res.send(JSON.stringify(stations, null, "\t"));
	}
});
*/
app.get('/stations', function(req, res) {
	res.send(JSON.stringify(stations, null, "\t"));
});

app.get('/services/:action/*', function(req, res) {
	if (req.params.name != "all") {
		res.send(JSON.stringify(services[req.params.name], null, "\t"));
	} else {
		res.send(JSON.stringify(services, null, "\t"));
	}
});

app.get('/stations/eventLog', function(req, res) {
	res.send(JSON.stringify(stationLog.getEventLog(), null, "\t"));
});

app.get('/network/getNodes', function(req, res) {
	res.send(JSON.stringify(Object.keys(stations), null, "\t"));
});

app.get('/network/getLinks', function(req, res) {
	var output = {};
	for (var sta in stations) {
		output[sta] = stations[sta].getLinks();
	}
	res.send(JSON.stringify(output, null, "\t"));
});

app.get('/getState', function(req, res) {
	// stations
	// services
	// events
	// stationLog
	res.send(JSON.stringify({
		stations: stations,
		services: services,
		events: events,
		stationLog: stationLog
	}));
});

// output a human readable representation of the observed networks
app.get('/network/summary', function(req, res) {
	var output = {};
	for (var sta in stations) {
		//
	}
	res.send(JSON.stringify(output, null, "\t"));
});

app.get('/search', function(req, res) {
});

app.post('/addEvent', function(req, res) {
	
});

function Queue(){
	var queue  = [];
	var offset = 0;
	
	this.getQueue = function() {
		return queue;
	}
	this.getLength = function(){
		return (queue.length - offset);
	}
	this.isEmpty = function(){
		return (queue.length == 0);
	}
	this.enqueue = function(item){
		queue.push(item);
	}
	this.dequeue = function(){
		if (queue.length == 0) return undefined;
		var item = queue[offset];
		if (++ offset * 2 >= queue.length){
			queue  = queue.slice(offset);
			offset = 0;
		}
		return item;
	}
	this.peek = function(pos){
		return (queue.length > 0 ? queue[(pos || 0) + offset] : undefined);
	}
	this.toJSON = function() {
		return queue;
	}
	this.restore = function(o) {
		queue = o;
	}
}

// special var for broadcast mac
var broadcast = 'ff:ff:ff:ff:ff:ff';
// map of all network stations  mac->Station()
var stations = {};
// convenience map of SSID name frequencies (for enumerating twins)
var services = {};
// let wiggum do something in response to some trigger
var events = [];

/*
function ServiceSet() {
	var name = undefined; // common name of the service set
	var macs = {}; // list of macs servicing this service set name
	
	this.update(n, m) {
		if (n != name && name != undefined) {
			
		}
	}
}
*/

// object for signal tracking
function Signal() {
	var series = new Queue();
	var avg =  {one: 0, ten: 0, hun: 0}; // TODO: better default to use for 1?
	var sum =  {ten: 0, hun: 0};
	var best = {one: 0, ten: 0, hun: 0}; // track best signal
	
	this.restore = function(o) {
		avg = o.avg;
		sum = o.sum;
		best = o.best;
		series.restore(o.series);
	}
	
	this.update = function(sig) {
		series.enqueue(sig);
		sum.ten += sig;
		sum.hun += sig;
		avg.one = sig;
		
		var num = series.getLength();
		if (num > 10) sum.ten -= series.peek(num - 11);
		if (num > 100) {
			var out = series.dequeue(); // 101st element
			sum.hun -= out;
		}
		
		avg.ten = sum.ten / (num < 10 ? num : 10);
		avg.hun = sum.hun / (num < 100 ? num : 100);
		
		if (avg.one < best.one) best.one = avg.one;
		if (avg.ten < best.ten && num >= 10) best.ten = avg.ten;
		if (avg.hun < best.hun && num >= 100) best.hun = avg.hun;
	}
	this.getStats = function() {
		return {avg: avg, best: best};
	}
	this.getSeries = function() {
		return series.getQueue();
	}
	this.toJSON = function() {
		return {avg: avg, best: best, sum: sum, series: series};
	}
}

// object for tracking frequency
function Frequency() {
	var series = new Queue();
	var values = {};
	
	this.restore = function(o) {
		values = o.values;
		series.restore(o.series);
	}
	
	this.update = function(freq) {
		values[freq] = (values[freq] + 1) || 1;
		series.enqueue(freq);
		
		if (series.getLength > 100) {
			series.dequeue();
		}
	}
	
	this.getSeries = function() {
		return series.getQueue();
	}
	
	this.getMainFreqs = function(){}
	this.getAllFreqs = function(){}
	
	this.freqToChannel = function(freq) {
		// calculate the well defined channels first
		// https://en.wikipedia.org/wiki/List_of_WLAN_channels
		if (freq == 2484)
			return 14;
		if (freq >= 2412 && freq <= 2472)
			return (freq - 2407) / 5;
		
		// channels in other bands (incl 5ghz and 3 ghz) seem to use this formula
		var band = Math.floor(freq / 1000);
		return band + ":" + ((freq - (band * 1000)) / 5);
	}
	
	this.getMainChannels = function(){}
	this.getAllChannels = function(){}
	
	this.toJSON = function() {
		return {values: values, series: series};
	}
}

var typeNames = [
	'association request', 'association response', 'reassociation request', 
	'reassociation response', 'probe request', 'probe response', , , 
	'beacon', 'announcement traffic indication map (atim)', 'disassociation', 
	'authentication', 'deauthentication', 'action', , , , , , , , , , , 
	'block ack req', 'block ack', 'power save poll', 'request-to-send', 
	'clear-to-send', 'acknowledgement', 'Control frame end', , 'data', , , , 
	'null function', , , , 'QoS', , , , 'QoS Null function'
];

// a global event log handler
function EventLog(size, next) {
	var eventLog = new Queue();
	var logSize = size;
	var nextLog = (next || {logEvent: function(event) {return event}});
	
	this.restore = function(o) {
		eventLog.restore(o);
	}
	
	// store reference to event in the global log, add timestamp, run filters/triggers, return the event
	this.logEvent = function(event) {
		eventLog.enqueue(event);
		if (eventLog.getLength() > logSize) eventLog.dequeue();
		
		return nextLog.logEvent(event);
	}
	
	this.getEventLog = function() {
		return eventLog;
	}
	this.toJSON = function() {
		return eventLog.toJSON();
	}
}

var stationLog = new EventLog(1000);

// object for all new stations
function Station(m, f, r) {
	var s = {
		mac: m, // the mac of the transmitting station
		hash: 0, // an attempt to create a unique hash for each station based on WLAN attributes
		count: 0, // the number of times this station has been observed
		last: f.frame.time_epoch, // the time this station was last observed
		chanType: f.radiotap.channel.type, // a, b, g, pure, mixed, etc
		knows: {}, // freq map of the other stations that this one talks to
		freq: new Frequency(), // the observed channel frequencies of this station over time
		attributes: {}, // automated notes about this station (AP, out of spec, etc)
		signal: new Signal(), // the observed signal strength of this station over time (per interface?)
		frameTypes: {}, // track who sends what to find abnormality (lots of deauths, etc)
		ap: {
			index: 0, // if more than 1 station service this SSID, this is the n-th one observed
			status: "unknown", // the AP status of this station (is AP, is associated, is probing, etc..)
			bssid: undefined, // mac of the station managing the Basic Service Set
			ssidName: undefined // common name of the service set
		},
		vendor: '',
		eventLog: new EventLog(100, stationLog) // array of log entry objects
	}
	
	console.log('Adding MAC: ' + m);
	
	this.restore = function(o) {
		var freq = o.freq;
		var sig = o.signal;
		var el = o.eventLog;
		
		s = o;
		s.freq = new Frequency();
		s.signal = new Signal();
		s.eventLog = new EventLog(100, stationLog);
		
		s.freq.restore(freq);
		s.signal.restore(sig);
		s.eventLog.restore(el);
	}
	
	this.setVendor = function(err, name) {
		s.vendor = name;
		if (name == null) s.eventLog.logEvent({
			desc: "[" + s.mac + "] OUI not listed in database",
			timestamp: s.last
		});
	}
	this.toJSON = function() {
		return s;
	}
	this.getLinks = function() {
		return s.knows;
	}
	this.logEvent = function(event, conditions) {
		// if this event is logged conditionally, evaluate the criteria
		if (conditions) {
			var count = 0;
			for (var c in conditions) {
				if (conditions[c] == event[c]) count++;
			}
			if (count == 0) return;
		}
		
		//event.timestamp = Math.floor(Date.now() / 1000);
		event.timestamp = s.last;
		s.eventLog.logEvent(event);
	}
	this.log = function(brief, detail) {
		this.logEvent({desc: "[" + brief + "] " + detail}, undefined);
	}
	
	if (!r) {
		macDb.lookup(m.substring(0, 8), this.setVendor);
		this.log("new station", m);
	}
	
	this.update = function(f) {
		s.count++;
		
		// update the fields that are expected to change frequently
		s.last = f.frame.time_epoch;
		//s.freqs[f.radiotap.channel.freq] = (s.freqs[f.radiotap.channel.freq] + 1 || 1);
		s.frameTypes[f.wlan.fc.type_subtype] = (s.frameTypes[f.wlan.fc.type_subtype] + 1 || 1);
		s.signal.update(f.radiotap.dbm_antsignal);
		s.freq.update(f.radiotap.channel.freq);
		
		// check channel type status
		if (s.chanType != f.radiotap.channel.type) {
			// TODO: log warning about changing channel type (B->G->A, etc)
			this.log(s.mac, "channel type changed: " + s.chanType + " -> " + f.radiotap.channel.type);
			s.chanType = f.radiotap.channel.type;
		}
		
		// check service set status
		if (f.wlan.bssid != undefined && f.wlan.bssid != s.ap.bssid) {
			// TODO: log warning about changing service set
			this.log(s.mac, "BSSID changed: " + s.ap.bssid + " -> " + f.wlan.bssid);
			s.ap.bssid = f.wlan.bssid;
		}
		
		// if there is a service set name, track it
		if (f.wlan_mgt != undefined && f.wlan_mgt.ssid != undefined) {
			if (s.ap.ssidName != f.wlan_mgt.ssid) {
				// TODO: log warning about ssid name changing
				this.log(s.mac, 'SSID changed: "' + s.ap.ssidName + '" -> "' + f.wlan_mgt.ssid + '"');
				s.ap.ssidName = f.wlan_mgt.ssid;
			}
			if (services[s.ap.ssidName] == undefined) {
				// TODO: log the discovery of a new service name
				this.log(s.mac, 'new SSID discovered: "' + s.ap.ssidName + '"');
				services[s.ap.ssidName] = {count: 0, macs: {}};
			}
			if (services[s.ap.ssidName].macs[s.ap.bssid] == undefined) {
				// TODO: log the discovery of a new service station mac
				services[s.ap.ssidName].macs[s.ap.bssid] = 0;
				s.ap.index = services[s.ap.ssidName].count++;
				this.log(s.mac, "discovered MAC #" + Object.keys(services[s.ap.ssidName].macs).length + " servicing " + s.ap.ssidName + "(" + s.ap.index + "): " + s.ap.bssid);
			}
			services[s.ap.ssidName].macs[s.ap.bssid]++;
		}
		
		// check if this frame reveals any topology

		// TODO: using this path means that this station is acting like an AP (representing an eth device)
		// TODO: resolving the topology of the ta/sa relationship might need more work - should their relationship affect the ra/da result?
		if (f.wlan.sa) {
			stations[f.wlan.sa] = (stations[f.wlan.sa] || new Station(f.wlan.sa, f));
			stations[f.wlan.sa].connect(s.mac, 'as', 'eth->wlan');
		}
		if (f.wlan.ra == f.wlan.da) {
			if (f.wlan.ra == broadcast) {
				this.logEvent(
					this.connect(broadcast, 'broadcast', typeNames[f.wlan.fc.type_subtype]),
					{createdConnection: true, createdState: true, changedState: true}
				);
			} else {
				// TODO: using this path means that the receiver is acting like a simple WLAN station (wlan mac == eth mac)
				this.connect(f.wlan.ra, 'as', 'wlan-sta+eth'); // aka "regular associated client"
			}
		} else {
			// TODO: using this path means that the receiver has network access
			this.connect(f.wlan.ra, 'as', 'wlan-sta');
			this.connect(f.wlan.da, 'as', 'wlan->eth');
		}
	}
	
	// TODO: add a new label event?
	// three connection events to trigger on: create connection, created state, changed state
	this.connect = function(to, label, method) {
		if (!to) return {source: 'Station.connect', error: true, desc: 'connection destination undefined'};
		if (to == s.mac) return {source: 'Station.connect', error: true, desc: 'connection source and destination are the same'};
		
		var description = ["[" + label + "] " + s.mac + " -> " + to];
		var events = {
			createdConnection: false, createdState: false, changedState: false
		}
		
		// creating a first connection
		if (!s.knows[to]) {
			s.knows[to] = {};
			events.createdConnection = true;
			description.push("first connection"); 
		}
		
		s.knows[to][label] = (s.knows[to][label] || {});
		
		// creating a new state
		if (!s.knows[to][label][method]) {
			s.knows[to][label][method] = 1;
			events.createdState = true;
			description.push("creating a new state: " + method); 
		} else {
			// changing states
			if (s.knows[to][label]['_last'] != method) {
				events.changedState = true;
				description.push("changing states: " + s.knows[to][label]['_last'] + " -> " + method); 
			}
		}
		
		s.knows[to][label][method] = s.knows[to][label][method] + 1;
		s.knows[to][label]['_last'] = method;
		events.desc = description.join("; ");
		
		return events;
	}
	
}

var updateList = function(f){
	if (!f.wlan.ta) return; // some wlan frames dont have a transmitter address - not sure how to handle those yet

	// get the mac
	var mac = f.wlan.ta;
	
	// add a new station to the list if this one is new
	if (!stations[mac]) {
		stations[mac] = new Station(mac, f);
	}
	
	// make updates to the station record
	stations[mac].update(f);
	
	// based on what gets adjusted, we make a log entry (ignore if new)
	
	// run checks for suspicousness, log if needed
//	if (mac.indexOf('64:66:b3:e4:00:12') >= 0) {
//		console.log(f.frame.time_epoch + ' HS! type:' + f.radiotap.channel.type + ' freq:' + f.radiotap.channel.freq + ' sig:' + f.radiotap.dbm_antsignal);
//	}
	
};


//////////////////////////////////////////////
// if restoring a previously stored state, do it before starting


function restoreStation(s) {
	var sta = new Station(s.mac, {frame: {time_epoch: s.last}, radiotap: {channel: {type: s.chanType}}}, true);
	sta.restore(s);
	return sta;
}

if (process.argv[2]) {
	var state = JSON.parse(fs.readFileSync(process.argv[2]));
	
	for (s in state.stations) {
		stations[s] = restoreStation(state.stations[s]);
	}
	
	stationLog.restore(state.stationLog);
	services = state.services;
}

//////////////////////////////////////////////

events.push({check: function(f) {
	if (f.mac.indexOf('e8:94:f6:f3:d5:9a') >= 0) {
		console.log(f.frame.time_epoch + ' FOX! type:' + f.radiotap.channel.type + ' freq:' + f.radiotap.channel.freq + ' sig:' + f.radiotap.dbm_antsignal);
	}
}});

events.push({check: function(f) {
	if (f.mac.indexOf('64:66:b3:e4:00:12') >= 0) {
		console.log(f.frame.time_epoch + ' HS! type:' + f.radiotap.channel.type + ' freq:' + f.radiotap.channel.freq + ' sig:' + f.radiotap.dbm_antsignal);
	}
}});



//////////////////////////////////////////////



// start the web app at port 'globalConfig.port.management'
app.listen(globalConfig.port.management);
console.log('HTTP frontend is listening on port: ' + globalConfig.port.management);

// open a generic TCP port at 'globalConfig.port.wlan'
server.listen(globalConfig.port.wlan);
console.log('TCP backend is listening for WLAN frames on port: ' + globalConfig.port.wlan);



