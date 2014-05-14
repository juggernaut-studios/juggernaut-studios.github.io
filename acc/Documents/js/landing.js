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
			img_landing_footer : resource_data.getPath("landing_footer")
		});
		document.getElementById(this.mDivName).innerHTML = sHTML;

		// UI edits
		document.getElementById('landingPage').style.backgroundImage = "url('" + resource_data.getPath("landing_lady") + "')";
		//$("#" + this.mDivName + " .deviat_grtrThan").css("background-image", "url('" + resource_data.getPath("grtr_logo_panel") + "')");

		this.mApplication.addEventHandler('landing_btn_start', 'click', this.clickHandler.bind(this));
		this.mApplication.addEventHandler('landing_btn_intro', 'click', this.clickHandler.bind(this));

		$("#"+this.mDivName).addClass('home-page-bg')			
		//this.onScreenUpdate()	
	},

	clickHandler : function(evt) {
		var target = (evt.currentTarget) ? evt.currentTarget : evt.srcElement;
		trace("Landing Page: CLICKED :" + target.id);
		switch(target.id) {
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
		switch(cmd) {
			case 'screen_update':
						//this.onScreenUpdate()	
					break;
		}
	},
	onScreenUpdate:function()
	{
		var w, h;
		if (window.innerWidth) {
			w = window.innerWidth;
			h = window.innerHeight;
		} else {
			w = document.body.clientWidth;
			h = document.body.clientHeight;
		}
		
		console.log(w,h)
		switch(w)
		{
			case 3201:
				var ht =h - $(".deviator-landig-page-floor").height();
				
				$(".app-wrapper").css("height",h+"px");
				$(".deviator-logo-holder").css("height","131px");
				$(".deviator-landig-page-floor").css("position","absolute");
				$(".landing-lady").css("height","230px");
				$(".deviator-landig-page-floor").css("margin-top",ht+"px");
				
			break;
			
		}
		
	}
	
}

