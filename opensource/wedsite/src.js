/**
 * @author C5189602
 */

var deviator = {}
deviator = {
	mNoise : -1,
	can : null,
	ctx : null,
	show : function(id) {

		document.getElementById(id).style.display = "block"
	},
	hide : function(id) {
		document.getElementById(id).style.display = "none"
	},

	initCanvas : function(str) {

		deviator.can = document.getElementById(str);
		console.log(deviator.can)

		if (deviator.can.getContext) {
			deviator.ctx = deviator.can.getContext("2d");
			//deviator.generateNoise();

		} else {
			alert("OOps No CANVAS supported on ur browser");
		}
	},
	drawPlainBG : function(clr) {
		deviator.ctx.fillStyle = clr;
		deviator.ctx.fillRect(0, 0, deviator.can.width, deviator.can.height);
	},

	generateNoise : function() {

		console.log("generating noise ", deviator.can)
		var number, opacity = deviator.getRandomArbitary(0.3, 1);
		deviator.ctx.clearRect(0, 0, deviator.can.width, deviator.can.height);
		for ( x = 0; x < deviator.can.width; x++) {
			for ( y = 0; y < deviator.can.height; y++) {
				number = Math.floor(Math.random() * 60);

				deviator.ctx.fillStyle = "rgba(" + number + "," + number + "," + number + "," + opacity + ")";
				deviator.ctx.fillRect(x, y, 1, 1);
			}
		}
	},
	getRandomArbitary : function(min, max) {
		return Math.random() * (max - min) + min;
	},
	timeBasedNoise : function(start) {

		if (start)
			deviator.mNoise = setInterval(deviator.generateNoise.bind(deviator), 300);
		else {
			clearInterval(deviator.mNoise);
			deviator.drawPlainBG("black");
		}

	},
	addEventListener : function(id, callback, type) {
		type = (type === undefined) ? "click" : type;
		document.getElementById(id).addEventListener(type, callback, false);
	},
	hasClass : function(id, classN) {
		var st = document.getElementById(id).className;
		var bReturn = false;
		bReturn = (st.indexOf(classN) == -1) ? false : true
		return bReturn;
	},
	removeClass : function(id, classN) {
		var st = document.getElementById(id).className;
		st = st.replace(classN, "");
		document.getElementById(id).className = st;
	},
	addClass : function(id, classN) {
		var st = document.getElementById(id).className;
		if (st.indexOf(classN) == -1) {
			st = st + " " + classN;
			document.getElementById(id).className = st;
		}
	},
}

window.dev = deviator;

var video = document.getElementById("video");
window.onload = function() {

	dev.show("main_app_content");
	dev.hide("while_page_loading");

	dev.initCanvas("computer");
	dev.can = document.getElementById("computer");
	dev.drawPlainBG("grey");

	dev.addEventListener("channel_1", function(e) {
		if (dev.hasClass('channel_1', 'buton_position_1')) {
			dev.removeClass('channel_1', 'buton_position_1')
			//dev.timeBasedNoise(true);
			dev.can.style.webkitFilter ="sepia(1) blur(10px)";
			dev.addClass('channel_1', 'buton_position_2')
		} else {
			dev.removeClass('channel_1', 'buton_position_2')
			//dev.timeBasedNoise(false);
			dev.can.style.webkitFilter ="sepia(0) blur(0px)";
			dev.addClass('channel_1', 'buton_position_1')
		}
	});

	dev.addEventListener("channel_2", function(e) {
		//dev.timeBasedNoise(false);
	});

	navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
	if (navigator.getUserMedia) {

		function successCallback(stream) {
			if (window.webkitURL) {
				var ur = window.webkitURL.createObjectURL(stream);
				console.log(ur);
				video.src =ur;
			} else if (video.mozSrcObject !== undefined) {
				video.mozSrcObject = stream;
			} else {
				video.src = stream;
			}
		}

		function errorCallback(error) {
		console.log(" NO RTC");
		}


		navigator.getUserMedia({
			video : true
		}, successCallback, errorCallback);

		requestAnimationFrame(tick);
	}
}
function tick() {
	requestAnimationFrame(tick);
	if (video.readyState === 4) {
		snapshot();
	}
}

function snapshot() {
	dev.ctx.clearRect(0,0, dev.can.width, dev.can.height);
	dev.ctx.drawImage(video, 0, 0, dev.can.width, dev.can.height);
}