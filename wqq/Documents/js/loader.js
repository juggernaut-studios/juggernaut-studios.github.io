/**
 * @author deviator206
 */

function LoadingScreen(a) {
	this.mApplication = a;
	this.mDivName = resource_data.dom['loading'];
	this.mGameSplashLoader = null;
	this.mGameAssetLoader = null;
	this.setUp()
}

LoadingScreen.prototype = {

	setUp : function() {
		this.mApplication.showScreen(this.mDivName);

		var resourceKey, sHTML = this.mApplication.renderTemplate('loading_screen_ui', {
		});

		document.getElementById(this.mDivName).innerHTML = "";
		document.getElementById(this.mDivName).innerHTML = sHTML;

		this.mGameAssetLoader = new PxLoader();
		for (resourceKey in resource_data.images) {
			if (resource_data.images.hasOwnProperty(resourceKey))
				resource_data.images[resourceKey][1] = this.mGameAssetLoader.addImage(getAssetPath("img", resource_data.images[resourceKey][0]));
		}

		this.mGameAssetLoader.addProgressListener(this.onProgress.bind(this));
		this.mGameAssetLoader.addCompletionListener(this.onComplete.bind(this));

		this.mGameAssetLoader.start();

		trace(" loading..");
	},
	onProgress : function(c) {
		var a = (parseInt(c.completedCount / c.totalCount * 100) >> 0);

		//document.getElementById("loadingMessage").innerHTML = "<h1>Loading  Assets : Status :" + a + " % </h1>" ;

		trace(a);
		
		if (a <= 20) {
			var newTotal = 20;
			var newPercent = a / 20 * 100;
			$("#loader-1 .loader-inner-container").css("width", newPercent + "%");
		} else if (a <= 40) {
			var newTotal = 20;
			var newPercent = (a-20) / 20 * 100;
			$("#loader-1 .loader-inner-container").css("width", "100%");
			$("#loader-2 .loader-inner-container").css("width", newPercent + "%");

		} else if (a <= 60) {

			var newTotal = 20;
			var newPercent = (a-40) / 20 * 100;
			$("#loader-1 .loader-inner-container").css("width", "100%");
			$("#loader-2 .loader-inner-container").css("width", "100%");
			$("#loader-3 .loader-inner-container").css("width", newPercent + "%");

		} else if (a <= 80) {

			var newTotal = 20;
			var newPercent = (a-60) / 20 * 100;
			$("#loader-1 .loader-inner-container").css("width", "100%");
			$("#loader-2 .loader-inner-container").css("width", "100%");
			$("#loader-3 .loader-inner-container").css("width", "100%");
			$("#loader-4 .loader-inner-container").css("width", newPercent + "%");
		} else {

			var newTotal = 20;
			var newPercent = (a-80) / newTotal * 100;
			$("#loader-1 .loader-inner-container").css("width", "100%");
			$("#loader-2 .loader-inner-container").css("width", "100%");
			$("#loader-3 .loader-inner-container").css("width", "100%");
			$("#loader-4 .loader-inner-container").css("width", "100%");
			
			$("#loader-5 .loader-inner-container").css("width", newPercent + "%");
		}
		
		/*document.getElementById("loader_anim").style.width =  "100%"*/

		trace(a)
	},
	onComplete : function() {
		trace("ASSET Loading COMPLETE!")
		this.mApplication.nextScene();
	},
	onWrapperPush : function(cmd, data) {

	}
}

