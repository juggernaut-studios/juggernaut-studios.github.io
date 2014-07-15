/**
 * @author deviator206
 */

function IntroScreen(a) {
	this.mApplication = a;
	this.mDivName = resource_data.dom['intro'];
	this.mGameSplashLoader = null;
	this.mGameAssetLoader = null;
	this.setUp()
}

IntroScreen.prototype = {
	setUp : function() {
		this.mApplication.showScreen(this.mDivName);

		var resourceKey, sHTML = this.mApplication.renderTemplate('intro_screen_ui', {
			img_thot_bubbles : resource_data.getPath("img_thot_bubbles")
		});
		document.getElementById(this.mDivName).innerHTML = sHTML;
		trace(" IntroScreen Page..");

		document.getElementById('intro_btn_continue').style.backgroundImage = "url('" + resource_data.getPath("intro_continue_btn") + "')";
		//addEventListener
		//document.getElementById('intro_btn_continue').addEventListener("click", this.clickHandler.bind(this));
		this.mApplication.addEventHandler('intro_btn_continue','click',this.clickHandler.bind(this));

	},

	clickHandler : function(evt) {
		trace("Intro Page: CLICKED :" + evt.currentTarget.id);
		switch(evt.currentTarget.id) {
			case 'intro_btn_continue':
				this.mApplication.nextScene();
				break;
		}
		return false;
	},
	onWrapperPush : function(cmd, data) {
		
	}
}

