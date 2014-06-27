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
		});
		
		document.getElementById(this.mDivName).innerHTML = sHTML;
		trace(" IntroScreen Page..");

		$(".ladding-ladder-img").css("background-image","url('"+resource_data.getPath("intro_side_static_content") +"')");
		
		
		//addEventListener
		//document.getElementById('intro_btn_continue').addEventListener("click", this.clickHandler.bind(this));
		this.mApplication.addEventHandler('intro_btn_continue','click',this.clickHandler.bind(this));

	},

	clickHandler : function(event) {
		
		var target = (event.currentTarget) ? event.currentTarget : event.srcElement;
		trace("Intro Page: CLICKED :" + target.id);
		switch(target.id) {
			case 'intro_btn_continue':
				this.mApplication.nextScene();
				break;
		}
		return false;
	},
	onWrapperPush : function(cmd, data) {
		
	}
}

