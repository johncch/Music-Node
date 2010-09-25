/**
 * Main Javascript File
 * @author Chong Han Chua
 */

var ID;
var flexapp;

var selectedInstrument = 0;
var selectedMarker = 0;
var selectedDuration = 0;

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

			function box(n) {
				var node = Y.Node.create('<div>');
				node.addClass('instrument');
				node.on('click', function() {
					Y.all('.instrument').removeClass('instrument-selected');
					this.addClass('instrument-selected');
					selectedInstrument = n;
				});
				Y.one('.panel').append(node);
			};

			for(var i = 0; i < 16; i++){
				box(i);
			}
			Y.one('.instrument').addClass('instrument-selected');

			function marker(n) {
				var node = Y.Node.create('<div>');
				node.addClass('marker');
				node.on('click', function() {
					Y.all('.marker').removeClass('marker-selected');
					this.addClass('marker-selected');
					selectedMarker = n;
				});
				Y.one('.panel').append(node);
			}
			
			for(var i = 0; i < 3; i++){
				marker(i);
			}
			Y.one('.marker').addClass('marker-selected');

			function duration(n) {
				var node = Y.Node.create('<div>');
				var duration = (n+1) * 5;
				node.addClass('duration');
				node.setContent(duration);
				node.on('click', function() {
					Y.all('.duration').removeClass('duration-selected');
					this.addClass('duration-selected');
					selectedDuration = duration;
				});
				Y.one('.panel').append(node);
			}

			for(var i = 0; i < 4; i++){
				duration(i);
			}
			Y.one('.duration').addClass('duration-selected');

			// Start of Canvas code
			// gCanvasElement.addEventListener("click", OnClick, false);
			
			Y.one('#canvas').on('click', function(e) {
				var clickx, clicky;
				if (e.pageX || e.pageY) {
					clickx = e.pageX;
					clicky = e.pageY;
				} else {
					clickx = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
					clicky = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
				}
				clickx -= this.getXY()[0];
				clicky -= this.getXY()[1];

				var i = parseInt((clickx - sq.o)/ (sq.w + sq.m));
				var j = parseInt((clicky - sq.o)/ (sq.h + sq.m));

				actions.push({
					instrument: selectedInstrument, 
					marker: selectedMarker,
					duration: selectedDuration,
					note: 30 + i,
					delay: 3
				});
			});
			
			draw();

			// join the server session
			join();
		});
});

var squaremap = new Array(30 * 20);

var mp = {
	w: 30,
	h: 20
}

/*
 * Drawing Code
 */
var sq = { // squares properties
	m: 4,
	w: 20,
	h: 20,
	r: 4,
	o: 2
}


function draw() {
	var gCanvasElement=document.getElementById('canvas');
	var ctx = gCanvasElement.getContext('2d');
	// drawing 30 by 20
	for(var i = 0; i < mp.w; i++){
		for(var j = 0; j < mp.h; j++){
			roundedRect(ctx, i * sq.w + i * sq.m + sq.o, j * sq.h + j * sq.m + sq.o, sq.w, sq.h, sq.r, "#CCC");
		}
	}
}

function fillIJRect(i, j){
	var gCanvasElement=document.getElementById('canvas');
	var ctx = gCanvasElement.getContext('2d');
	roundedFullRect(ctx, i * sq.w + i * sq.m + sq.o, j * sq.h + j * sq.m + sq.o, sq.w, sq.h, sq.r, "#F00");
}

function clickColorChange(ctx, x, y, width, height,radius, color){
	roundedFullRect(ctx,x, y, width,height,radius,color);
}

function roundedRect(ctx,x,y,width,height,radius, color){
	ctx.beginPath();
	ctx.moveTo(x,y+radius);
	ctx.lineTo(x,y+height-radius);
	ctx.quadraticCurveTo(x,y+height,x+radius,y+height);
	ctx.lineTo(x+width-radius,y+height);
	ctx.quadraticCurveTo(x+width,y+height,x+width,y+height-radius);
	ctx.lineTo(x+width,y+radius);
	ctx.quadraticCurveTo(x+width,y,x+width-radius,y);
	ctx.lineTo(x+radius,y);
	ctx.quadraticCurveTo(x,y,x,y+radius);
	ctx.strokeStyle = color;
	ctx.stroke();
}

function roundedFullRect(ctx,x,y,width,height,radius, color){
	ctx.beginPath();
	ctx.moveTo(x,y+radius);
	ctx.lineTo(x,y+height-radius);
	ctx.quadraticCurveTo(x,y+height,x+radius,y+height);
	ctx.lineTo(x+width-radius,y+height);
	ctx.quadraticCurveTo(x+width,y+height,x+width,y+height-radius);
	ctx.lineTo(x+width,y+radius);
	ctx.quadraticCurveTo(x+width,y,x+width-radius,y);
	ctx.lineTo(x+radius,y);
	ctx.quadraticCurveTo(x,y,x,y+radius);
	ctx.fillStyle = color;
	ctx.fill();
}

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
	// console.log("id is " + ID);
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
		if(entry.marker == 0){
			flexapp.play(entry.note, entry.instrument, 4);
		}
	}
	console.log('frame ' + frame + ' is ' + new Date().getTime());
}

