/**
 * @author deviator206
 */

function LandingScreen(a) {
	this.mApplication = a;
	this.mDivName = resource_data.dom['landing'];
	this.mGameSplashLoader = null;
	this.mGameAssetLoader = null;
	this.setUp()
}

LandingScreen.prototype = {
	setUp : function() {
		this.mApplication.showScreen(this.mDivName);

		var resourceKey, sHTML = this.mApplication.renderTemplate('landing_screen_ui', {
			img_landing_lady:resource_data.getPath("landing_lady"),
			img_landing_footer:resource_data.getPath("landing_footer")
		});
		document.getElementById(this.mDivName).innerHTML = sHTML;
		trace(" Landing Page..");

		//addEventListener
		//landing_btn_start
		//landing_btn_intro
		
		// UI edits
		document.getElementById('landing_btn_start').style.backgroundImage = "url('"+resource_data.getPath("common_start_btn")+"')";
		document.getElementById('landing_btn_intro').style.backgroundImage = "url('"+resource_data.getPath("landing_intro_btn")+"')";
		
		trace(" GRT :: "+"#"+this.mDivName+" .deviat_grtrThan");
		$("#"+this.mDivName+" .deviat_grtrThan").css("background-image","url('"+resource_data.getPath("grtr_logo_panel")+"')");
		
		
		this.mApplication.addEventHandler('landing_btn_start','click',this.clickHandler.bind(this));
		this.mApplication.addEventHandler('landing_btn_intro','click',this.clickHandler.bind(this));
		
		//document.getElementById('landing_btn_start').addEventListener("click", this.clickHandler.bind(this));
		//document.getElementById('landing_btn_intro').addEventListener("click", this.clickHandler.bind(this));

	},

	clickHandler : function(evt) {
		
		trace("Landing Page: CLICKED :" + evt.currentTarget.id);
		switch(evt.currentTarget.id) {
			case 'landing_btn_start':
				this.mApplication.moveTo('start');
				break;
			case'landing_btn_intro':
				this.mApplication.moveTo('intro');
				break;
		}
		return false;
	},
	onWrapperPush : function(cmd, data) {
		
	}
}

