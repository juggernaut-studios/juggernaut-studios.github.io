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
		document.getElementById("loadingMessage").innerHTML = "<h1>Loading  Assets : Status :" + a + " % </h1>" ;
		trace(a)
	},
	onComplete : function() {
		console.log("ASSET Loading COMPLETE!")
		this.mApplication.nextScene();
	},
	onWrapperPush : function(cmd, data) {
		
	}
}

