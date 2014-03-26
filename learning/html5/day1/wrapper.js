/**
 * @author C5189602
 */

window.addEventListener("load", function() {
	alert(" AWESOME !! ");
})



var app = app || {};


app.JNS =function()
{
	
	this.singleSlideContent;
	this.currentSlideContent;
	this.currentSlideNumber;
	this.totalNumberOfSlides;
	return this;
}


app.JNS.prototype = {
	
	setUp:function()
	{
		this.totalNumberOfSlides = data.ppt.length;	
		document.getElementById("next_anim").addEventListener("click",this.nextAnimation.bind(this))
	},
	
	nextAnimation:function()
	{
		//this.totalNumberOfSlides;
		//this.currentSlideContent
		//this.singleSlideContent
		//this.currentSlideNumber		
			
	}
}
