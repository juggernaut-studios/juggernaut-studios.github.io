/**
 * @author C5189602
 */

var app = app || {};

app.Config = {

	assets : {
		'loading' : ['img/legendary.png'],
		'after_loading' : ['img/wait.jpg'],
		'ahh_what_is_result' : ['img/wait.png'],
		'shd_i_dance' : ['img/wait-result.jpg'],
		'yeah_go_for_it' : ['img/yeah.jpg'],
		'jump_1' : ['img/jump1.jpg'],
		'jump_2' : ['img/jump2.jpg'],
		'celebrations' : ['img/result.jpg'],
		'final_congrats' : ['img/aila-sahi.jpg']

	},
	timer : [1000, 1500, 1500, 2000, 1000, 1000, 1000, 1000, 1000, 2000, 1000],
	dailogue : ['aila!!result alle ka?', 'wat is it??', 'ohh!! kkk  waiting!!', 'shd i start!!', 'yeah go for it!', 'Afat!! Passed!!', 'Dinchak! dinchakkk..!!', 'aila Passed!!', 'Dinchak! dinchakkk..!!', 'yulp!! Congrats! u did it!!', 'zala na baba!!'],
	sequence : ['loading', 'after_loading', 'ahh_what_is_result', 'shd_i_dance', 'yeah_go_for_it', 'jump_1', 'jump_2', 'jump_1', 'jump_2', 'celebrations', 'final_congrats']

}
app.Main = function() {
	this.assetLoader = null;
	this.nSequenceCounter = 0;
	this.appTimer = -1;
	this.setUp();
	return (window.sandeep === undefined) ? this : window.sandeep;
}

app.Main.prototype = {

	setUp : function() {
		this.assetLoader = new PxLoader();

		var that = this;
		for (key in app.Config.assets)
		app.Config.assets[key][1] = this.assetLoader.addImage(app.Config.assets[key][0])

		this.assetLoader.addProgressListener(function(e) {
			document.getElementById('main_img_container').innerHTML = "loading...   <br>" + e.completedCount + ' / ' + e.totalCount
		})

		this.assetLoader.addCompletionListener(function(e) {
			document.getElementById('main_img_container').innerHTML = "";
			document.getElementById('start_app').addEventListener("click", function() {
				that.startApp();
			})
			that.startApp();
		})

		this.assetLoader.start();
	},
	startApp : function() {

		document.getElementById('start_app').style.opacity = "0";
		this.nSequenceCounter = 0;
		this.timerProgress();
		//this.appTimer = setInterval(this.timerProgress.bind(this), 1000);
	},
	timerProgress : function() {
		if (this.nSequenceCounter < app.Config.sequence.length - 1) {
			var n = app.Config.sequence[this.nSequenceCounter];
			document.getElementById('main_img_container').style.backgroundImage = "url(" + app.Config.assets[n][1].src + ")";
			document.getElementById('main_comment_container').innerHTML = "<span class='text-in-center'> " + app.Config.dailogue[this.nSequenceCounter] + "</span>";
			this.nSequenceCounter++;
			this.appTimer = setTimeout(this.timerProgress.bind(this), app.Config.timer[this.nSequenceCounter]);
		} else {
			clearInterval(this.appTimer);
			var n = app.Config.sequence[this.nSequenceCounter];
			document.getElementById('main_img_container').style.backgroundImage = "url(" + app.Config.assets[n][1].src + ")";
			document.getElementById('main_comment_container').innerHTML = "<span class='text-in-center'> " + app.Config.dailogue[this.nSequenceCounter] + "</span>";
			document.getElementById('start_app').style.opacity = "1";
		}
	}
};

window.addEventListener("load", function() {
	document.getElementById('main_wrapper').style.width = window.clientWidth;
	document.getElementById('main_wrapper').style.height = window.clientHeight;
	var appInstance = new app.Main();

});
