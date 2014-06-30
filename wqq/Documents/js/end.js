/**
 * @author deviator206
 */

function EndScreen(a) {
    this.mApplication = a;
    this.mDivName = resource_data.dom['end'];
    this.mGameSplashLoader = null;
    this.mGameAssetLoader = null;
    this.storeScore = [];
    this.setUp()
}

EndScreen.prototype = {
    setUp : function() {
        this.mApplication.showScreen(this.mDivName);

        var arrT = this.mApplication.getFinalScreenMsg(), resourceKey, sHTML = this.mApplication.renderTemplate('end_screen_ui', {
            main_ending_msg : arrT[0],

            n_second : arrT[1],
            n_star : arrT[2],
            url_app : location.href,
            url_diversity : resource_data.url_diversity,
            url_jobs : resource_data.url_jobs,
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
        $(".congrats-greater-than-img").css("background-image", "url('" + resource_data.getPath("grtr") + "' )");
        $(".award-img").css("background-image", "url('" + resource_data.getPath("award_" + String(this.storeScore[2]).toLowerCase()) + "' )");
        $("#endPage").css("background-image", "url('" + resource_data.getPath("congrats_bg") + "' )");

        $("#facebook").css("background-image", "url('" + resource_data.getPath("facebook") + "' )");
        $("#twitter").css("background-image", "url('" + resource_data.getPath("twitter") + "' )");
        $("#linkedin").css("background-image", "url('" + resource_data.getPath("linked_in") + "' )");
    },
    // manipulateSSNContent :function()
    // {
    // var str = resource_data.social_site_content;
    // //replace badge won
    // str = str.replace("<%badge_won%>",this.storeScore[2]);
    // //replace time taken
    // str = str.replace("<%time_taken%>",this.storeScore[1]);
    // //add link
    // str = str.replace("<%url_for_game%>",location.href);
    //
    // str = encodeURIComponent(str);
    //
    // return str
    //
    //
    // },

    manipulateSSNContent : function(sns_site_name, noencode) {
        var str = resource_data.social_site_content;
        switch(sns_site_name) {
            case 'facebook':
                str = resource_data.social_site_content_facebook;
                break;
            case 'twitter':
                str = resource_data.social_site_content_twitter;
                break;
            case 'linkedin':
                str = resource_data.social_site_content_linkedin;
                break;
            default :

                break;
        }

        //replace badge won
        str = str.replace("<%badge_won%>", this.storeScore[2]);
        //replace time taken
        str = str.replace("<%time_taken%>", this.storeScore[1]);
        //add link
        str = str.replace("<%url_for_game%>", location.href);

        if(noencode === undefined)
        str = encodeURIComponent(str);

        return str

    },
    clickHandler : function(event) {
        var url = "",imgURL,publishingContent;
        var publishingURL = location.href;
        //var publishingContent = this.manipulateSSNContent();

        var target = (event.currentTarget) ? event.currentTarget : event.srcElement;
        switch(target.id) {
            case 'facebook':

                publishingContent = this.manipulateSSNContent('facebook');
                /*
                https://www.facebook.com/sharer/sharer.php
                ?s=100
                &p[title]=Example Title
                &p[summary]=Example description text
                &p[url]=http://url-being-shared.com/
                &p[images][0]=http://url-of-image.com/image.jpg

                "https://www.facebook.com/dialog/feed?app_id=145634995501895&display=popup&caption=An%20example%20caption&link=https%3A%2F%2Fdevelopers.facebook.com%2Fdocs%2Fdialogs%2F&redirect_uri=https://developers.facebook.com/tools/explorer"
                * */
                //url = "http://www.facebook.com/sharer.php?u="+publishingURL+"&amp;t="+publishingContent;
                //url = "https://www.facebook.com/sharer/sharer.php?s=100&p[title]=Example%20Title&p[summary]=Example%20Title&p[url]=http://google.com/&p[images][0]=http://www.w3schools.com/images/w3logotest2.png"
                //url = "https://www.facebook.com/dialog/feed?app_id=145634995501895&display=popup&caption="+publishingContent+"&link="&redirect_uri=https://developers.facebook.com/tools/explorer"
                //picture
                //working
                //url = "https://www.facebook.com/dialog/feed?app_id=145634995501895&display=popup&caption=WQQ&description=" +publishingContent+ "&link=http://primary.careers-edit.accenture.com/&redirect_uri=http://facebook.com"
                //working as expected... with self app

                //http://careers.accenture.com/in-en/team-culture/diversity/PublishingImages/quiz/landing/bg-girl.png
                //http://careers.accenture.com/in-en/team-culture/diversity/PublishingImages/quiz/end/fb_post.jpg
                //working IMAGE SAMPLE :http://ginva.com/wp-content/uploads/2012/11/free-image-public-domain-31.jpg
                //				url = "https://www.facebook.com/dialog/feed?app_id=364527546948066&caption=WQQ&description=" +publishingContent+ "&link="+publishingURL+"&redirect_uri=http://facebook.com&picture=http://demo.appstute.in/wqq/PublishingImages/quiz/end/fb_post.jpg"
                url = "https://www.facebook.com/dialog/feed?app_id=364527546948066&caption=WQQ&description=" + publishingContent + "&link=" + publishingURL + "&redirect_uri=http://facebook.com&picture=http://careers.accenture.com/in-en/team-culture/diversity/PublishingImages/quiz/end/fb_post.jpg"
                window.open(url, "_blank");
                break;
            case 'twitter':
                publishingContent = this.manipulateSSNContent('twitter');
                url = "http://twitter.com/home?status=" + publishingContent;
                window.open(url, "_blank");
                break;
            case 'linkedin':
                publishingContent = this.manipulateSSNContent('linkedin',true);
                //https://developer.linkedin.com/documents/share-linkedin
                /*
                 url = 'http://www.linkedin.com/shareArticle?mini=true&title=Are you ready to raise the game?&summary='+publishingContent+'&source='+publishingURL+'&url=http%3A%2F%2Fcareers.accenture.com%2Fin-en%2Fteam-culture%2Fdiversity%2FPublishingImages%2Fquiz%2Fend%2Ffb_post.jpg';
                 window.open(url,"_blank");
                 */

                 imgURL = "http://careers.accenture.com/in-en/team-culture/diversity/PublishingImages/quiz/end/fb_post.jpg";
                IN.User.authorize(function() {
                    //alert("authenticated");

                    IN.API.Raw("/people/~/shares").method("POST").body(JSON.stringify({
                        "content" : {
                            "submitted-url" : window.location.href,
                            "title" : "WQQ",
                            "description" : "Women's Quotient Quiz",
                            "submitted-image-url" : imgURL
                        },
                        "visibility" : {
                            "code" : "anyone"
                        },
                        "comment" : publishingContent,
                    })).result(function(r) {
                        alert("POST OK");
                    }).error(function(r) {
                        alert("POST FAIL");
                    });

                });

                break;
            default :
                this.mApplication.moveTo('home');
                break;
        }

    },
    onWrapperPush : function(cmd, data) {

    }
}

