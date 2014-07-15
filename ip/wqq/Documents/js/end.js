/**
 * @author deviator206
 */

function EndScreen(a) {
	this.mApplication = a;
	this.mDivName = resource_data.dom['end'];
	this.mGameSplashLoader = null;
	this.mGameAssetLoader = null;
	this.setUp()
}

EndScreen.prototype = {
	setUp : function() {
		this.mApplication.showScreen(this.mDivName);

		var arrT = this.mApplication.getFinalScreenMsg(), resourceKey, sHTML = this.mApplication.renderTemplate('end_screen_ui', {
			thot_bubble_end_screen : resource_data.getPath("thot_bubble_end_screen"),
			main_ending_msg : arrT[0],
			n_second : arrT[1],
			n_star : arrT[2]
		});
		document.getElementById(this.mDivName).innerHTML = sHTML;
		trace(" END Page..");

		//addEventListener
		//document.getElementById('intro_btn_continue').addEventListener("click", this.clickHandler.bind(this));

		this.mApplication.addEventHandler('end_screen_back', 'click', this.clickHandler.bind(this));

	},
	clickHandler : function(evt) {
		this.mApplication.moveTo('home')

	},
	onWrapperPush : function(cmd, data) {

	}
}

