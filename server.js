HOST = null;
PORT = 8080;

var fu = require("./fu"), // stolen from node.js chat script
	sys = require("sys"),
	url= require("url"),
	qs = require("querystring");

var sessions = {};
var colors = {};

function createSession(id) {
	
	sys.puts("creating session for id " + id);

	for(var i in sessions) {
		var session = sessions[i];
		if(session && session.id == id) return null;
	}

	var color = {
		r: 128 + Math.round(Math.random() * 127),
		g: 128 + Math.round(Math.random() * 127),
		b: 128 + Math.round(Math.random() * 127),
	}

	//sys.puts('color: ' + JSON.stringify(color));

	var session = {
		id: id,
		timestamp: new Date().getTime(),
		latencies: [],
		setup: true,

		poke: function() {
			var now = new Date().getTime();
			session.timestamp = now;	
		},

		destroy: function() {
			delete colors[session.id]

			for(var i = eventQueues.length - 1; i > 0; i--){
				if(eventQueues[i].id == session.id){
					eventQueues.splice(i, 1);
				}
			}

			delete sessions[session.id];
		}
	}

	sessions[session.id] = session;
	colors[session.id] = color;
	return session;

}

// Starts the server
fu.listen(PORT, HOST);

// Serves static files
fu.get("/", fu.staticHandler("/index.html"));
fu.get("/index.html", fu.staticHandler("/index.html"));
fu.get("/main.js", fu.staticHandler("/main.js"));
fu.get("/raphael-min.js", fu.staticHandler("/raphael-min.js"));
fu.get("/SiONLib.swf", fu.staticHandler("/SiONLib.swf"));
fu.get("/swfobject.js", fu.staticHandler("/swfobject.js"));
fu.get("/fabridge.js", fu.staticHandler("/fabridge.js"));

// Handles other requests
fu.get("/ping", function(req, res) {
//	sys.puts("req.url" + req.url);
//	sys.puts("url.parse" + url.parse(req.url).query);

	id = qs.parse(url.parse(req.url).query).id;
//	sys.puts("user of id " + id + " has pinged us");

	res.simpleJSON(200, {
		ping: "pong"		
	});
	return;
});

fu.get("/join", function(req, res) {
	var query = qs.parse(url.parse(req.url).query);
	var id = query.id;
	sys.puts("got a join request from " + id);

	if(createSession(id)) {
		res.simpleJSON(200, {
			join: "success",
			timestamp: new Date().getTime()
		});
	} else {
		res.simpleJSON(400, {
			error: "session cannot be created"
		});
	}
	return;
});

fu.get("/setup", function(req, res){
	var query = qs.parse(url.parse(req.url).query);
	var id = query.id;
	var since = query.since;
	
	var session;
	if(id && sessions[id]) {
		session = sessions[id];
		session.poke();
	}

	var now = new Date().getTime();
	var latency = now - since;
	if(session.latencies.length < 2) {
		session.latencies.push(latency);
	} else {
		session.latencies.unshift();
		session.latencies.push(latency);
		var meanLat = 0;
		session.latencies.forEach(function(val, index){
			meanLat += val;
		});	
		meanLat = meanLat / session.latencies.length;
		var diff = 0;
		session.latencies.forEach(function(val, index){
			var thisdiff = meanLat - val;
			diff = diff + (thisdiff < 0)? ( -thisdiff) : thisdiff;
		});

		if(diff / 3 < 10){
			session.setup = false;
			res.simpleJSON(200, {
				timestamp: now,
				latency: meanLat,
				setup: true
			});
		}
		return;
	}
	
	res.simpleJSON(200, {
		timestamp: now
	});
	return;

});

fu.get("/recv", function(req, res){
	var query = qs.parse(url.parse(req.url).query);
	var id = query.id;
	var since = query.since;
	
	var session;
	if(id && sessions[id]) {
		session = sessions[id];
		session.poke();
	}

	var now = new Date().getTime();

	var data = JSON.parse(query.data);

	// sys.puts('data:' + typeof data + ", " + data + ", " + data.length);

	for(var i = 0; i < data.length; i++){
		var entry = data[i];
		if(entry.marker === 1){
			var spliced = false;
			for(var j = eventQueues.length - 1; j > 0; j--) {
				var oldEvent = eventQueues[j];
				if(oldEvent.id == id
						&& oldEvent.i == entry.i
						&& oldEvent.j == entry.j){
					eventQueues.splice(i, 1);
					spliced = true;
					break;
				}
			}
			if(spliced){
				continue;
			}
		}
		
		entry.id = id;
		entry.frame = frameNum;
		entry.color = colors[id];
		eventQueues.push(entry);
	}

	// sys.puts(JSON.stringify(eventQueues));
	/* 
	while(data.length > 0){
		var entry = data.shift();
		var num = entry.delay;
		if (num > frames.length) {
			for(var i = frames.length; i < num; i++){
				frames.push([]);
			}
		}
		frames[num - 1].push(entry);
	} */
	
	callbacks.push({
		id: id,
		res: res
	});

	return;
});

fu.get("/part", function(req,res){
	var query = qs.parse(url.parse(req.url).query);
	var id = query.id;
	var session = sessions[id];
	session.destroy();
});

// map is a 40 by 24 array
var map = new Array(40);
map = map.map(function(el){
	return new Array(24);
});

var callbacks = [];
var frameNum = 0;
var frames = [];
var eventQueues = [];

FRAME_WIDTH = 100; // in milliseconds

var HOLD_THRESHOLD = 50;
var count = 0;
var FRAME_MAX = 65525;

var CASE_ONE_DELAY = 2;

setInterval(function() {

	var empty = true;
	for(var i in sessions){
		empty = false;
		break;
	}
	if(empty){
		return;
	}

	frameNum = (frameNum + 1) % 65525;
	var now = new Date().getTime();

	// var load = frames.shift() || [];
	/*if(load.length == 0 && ++count <= HOLD_THRESHOLD){
		return;
	}*/
	
	var load = [];
	for(var i = eventQueues.length - 1; i > 0; i--){
		var entry = eventQueues[i];
		var framesdiff = 0;
		if(entry.frame > frameNum) {
			// assume wrap
			framesdiff = frameNum + (FRAME_MAX - entry.frame) 
		} else {
			framesdiff = frameNum - entry.frame;
		}
		switch(entry.marker) {
			case 0:
				if(framesdiff >= CASE_ONE_DELAY){
					load.push(entry);
					eventQueues.splice(i, 1);
				}
				break;
			case 1:
//				sys.puts('framesdiff: ' + framesdiff + " entry.duration: " + entry.duration);
				if(framesdiff % entry.duration == 0){
					load.push(entry);
				}
				break;
/* 			case 3:

				break; */
		}
	}	

//	sys.puts('load: ' + JSON.stringify(load));

	while(callbacks.length >0){
		var obj = callbacks.shift();
		var session = sessions[obj.id];

		// sys.puts(JSON.stringify(colors[obj.id]));

		var data = {
			nextFrame: frameNum,
			nextFrameTimestamp: now + FRAME_WIDTH,
			timestamp: now,
			load: load,
			recv: "ok"
		};

		obj.res.simpleJSON(200, data);
	}
}, FRAME_WIDTH);

// sesssion cleanup thread
SESSION_TIMEOUT = 30000;

setInterval(function() {
	var now = new Date().getTime();
	sys.puts("Reporting heartbeat.. " + now);

	for(var i in sessions){
		var session = sessions[i];
		if(now - session.timestamp > SESSION_TIMEOUT) {
			session.destroy();
		}
	}
}, SESSION_TIMEOUT)
