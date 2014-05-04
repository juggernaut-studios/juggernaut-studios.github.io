/**
 * @author deviator206
 */

function EndScreen(a) {
	this.mApplication = a;
	this.mDivName = resource_data.dom['end'];
	this.mGameSplashLoader = null;
	this.mGameAssetLoader = null;
	this.storeScore=[]; 
	this.setUp()
}

EndScreen.prototype = {
	setUp : function() {
		this.mApplication.showScreen(this.mDivName);

		var arrT = this.mApplication.getFinalScreenMsg(), resourceKey, sHTML = this.mApplication.renderTemplate('end_screen_ui', {
			main_ending_msg : arrT[0],
			n_second : arrT[1],
			n_star : arrT[2],
			url_diversity:resource_data.url_diversity,
			url_jobs:resource_data.url_jobs,
		});
		
		this.storeScore = arrT;
		document.getElementById(this.mDivName).innerHTML = sHTML;
		trace(" END Page..");

		//addEventListener
		//document.getElementById('intro_btn_continue').addEventListener("click", this.clickHandler.bind(this));

		/*this.mApplication.addEventHandler('end_screen_back', 'click', this.clickHandler.bind(this));*/
		
		this.mApplication.addEventHandler('facebook', 'click', this.clickHandler.bind(this));
		this.mApplication.addEventHandler('twitter', 'click', this.clickHandler.bind(this));
		this.mApplication.addEventHandler('linkedin', 'click', this.clickHandler.bind(this));
			
		//set BGs
		$(".congrats-greater-than-img").css("background-image","url('"+resource_data.getPath("grtr")+"' )");
		$(".award-img").css("background-image","url('"+resource_data.getPath("award_"+String(this.storeScore[2]).toLowerCase())+"' )");
		$("#endPage").css("background-image","url('"+resource_data.getPath("congrats_bg")+"' )");
		
		$("#facebook").css("background-image","url('"+resource_data.getPath("facebook")+"' )");
		$("#twitter").css("background-image","url('"+resource_data.getPath("twitter")+"' )");
		$("#linkedin").css("background-image","url('"+resource_data.getPath("linked_in")+"' )");
	},
	manipulateSSNContent :function()
	{
		var str = resource_data.social_site_content;
		//replace badge won
		str = str.replace("<%badge_won%>",this.storeScore[2]);
		//replace time taken
		str = str.replace("<%time_taken%>",this.storeScore[1]);
		//add link
		str = str + ":"+location.href;
		
		return str
	
		
	},
	clickHandler : function(evt) {
		var url ="";
		var publishingURL = location.href;
		var publishingContent = this.manipulateSSNContent();
		
		var target = (event.currentTarget) ? event.currentTarget : event.srcElement;
		switch(target.id) {
			case 'facebook':
				url = "http://www.facebook.com/sharer.php?u="+publishingURL+"&amp;t="+publishingContent;
				window.open(url,"_blank");
				break;
			case 'twitter':
				url = "http://twitter.com/home?status="+publishingContent;
				window.open(url,"_blank");
				break;
			case 'linkedin':
				//https://developer.linkedin.com/documents/share-linkedin
				url = 'http://www.linkedin.com/shareArticle?mini=true&url='+publishingURL+'&title='+publishingContent+ '&summary= ' +publishingContent+ '&source='+publishingURL;
				window.open(url,"_blank");

				break;
			default :
				this.mApplication.moveTo('home');
				break;
		}

	},
	onWrapperPush : function(cmd, data) {

	}
}

