/**
 * Main Javascript File
 * @author Chong Han Chua
 */

var ID;
var flexapp;

var Y = YUI().use("node", "yql", "json", "io", 
	// Begin entry point
	function(Y){
		
		// generate a new ID for the session
		ID = Math.random() * 99999999 + '.' + new Date().getTime();
		console.log(ID);

		// Initialize FABridge for connecting to SiON
		FABridge.addInitializationCallback("SiON", function() {
			flexapp = FABridge.SiON.root();
			console.log("initialized");
	
			for(var i = 0; i < 4; i++) {
				var node = Y.Node.create('<div>');
				node.addClass('button');
				var noteVal = 50 + i;
				node.on('click', function() {
					actions.push({
						action: 'play',
						value: noteVal,
						delay: 2
					});
				});
				Y.one('body').append(node);
			}

			join();
		});
});

var actions = [];

var lastpolltimestamp = 0;

function join() {
	console.log("joining id is " + ID);
	Y.io('/join', {
		method: 'GET',
		data: 'id=' + ID,
		on: {
			success: function(txnid, resp, args){
					console.log("obtained session");
					console.log("txnid:" + txnid + ", resp:" + resp.responseText + ", args: " + args);
					var response = Y.JSON.parse(resp.responseText);
					lastpolltimestamp = response.timestamp
	
					setup();
					 }
		}
	});
}

var timediff = 0;

function setup() {
	Y.io('/setup', {
		method: 'GET',
		data: 'id=' + ID + "&since=" + lastpolltimestamp,
		on: {
			success: function(txnid, resp, args){
						var response = Y.JSON.parse(resp.responseText);
						lastpolltimestamp = response.timestamp;
						var setupComplete = response.setup;

						if(setupComplete){
							var latency = response.latency;
							var now = new Date().getTime();
							/* console.log("date is " + now + " lastpolltimestamp " + lastpolltimestamp + " latency " + latency);
							console.log(now - lastpolltimestamp);
							console.log(latency/2); */
							timediff = (now - lastpolltimestamp) - (latency/2);
							console.log('timediff=' + timediff);
							longpoll();
						} else {
							setup();
						}
					 }
		}
	});
}

var frame = 0;
var framesets = [];

function longpoll() {
	console.log("id is " + ID);
	var data = Y.JSON.stringify(actions);
	actions = [];
	
	Y.io('/recv', {
		method: 'GET',
		data: 'id=' + ID + "&since=" + lastpolltimestamp + "&data=" + data,
		on: {
			success: function(txnid, resp, args) {
					var response = Y.JSON.parse(resp.responseText);
					lastpolltimestamp = response.timestamp;
					var nextFrameTimestamp = response.nextFrameTimestamp;
					var nextFrame = response.nextFrame;
					// console.log('nextFrame + ' + nextFrame);
					var load = response.load;
					// console.log(load);
					var now = new Date().getTime();
					if(nextFrameTimestamp - now - timediff > 0) {
						var diff = nextFrameTimestamp - now - timediff;
						framesets.push(load); 
						setTimeout(play, diff);
					}

					longpoll();
				 }
		}
	});
}

function play() {
	var load = framesets.shift();
	while(load.length > 0) {
		var entry = load.shift();
		if(entry.action == "play"){
			flexapp.play(entry.value);
		}
	}
	console.log('frame ' + frame + ' is ' + new Date().getTime());
}

