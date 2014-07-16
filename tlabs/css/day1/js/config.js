var gSlides =[
			
					{
						img:"banner02.jpg",
						data:"Text Content"
						
					},
					{
						img:"banner02.jpg",
						data:"Text Content"
						
					}
					,
					{
						img:"banner02.jpg",
						data:"Text Content"
						
					},{
						img:"banner02.jpg",
						data:"Text Content"
						
					}
		
		
		
			];
			
var gCodes =[ "123","abc","1aw","kil"]			



var app = {

	init :function()
	{
		var that = this;
		$(document).ready(function(){
			that.setUpImages();
		
		});
		
	
	},
	
	setUpImages :function()
	{
		var shtml="", i,len = gSlides.length;
		
		for(i=0;i<len;i++)
		{
			shtml += '<li><img src="img/banner02.jpg" title="Automatically generated caption"></li>';
		}
		
		$("#banner-fade .bjqs").append(shtml);
		
		 $('#banner-fade').bjqs({
            height      : 320,
            width       : 620,
            responsive  : true
          });
	},
	slideIndex :0,
	nextClicked:function()
	{
	
		console.log(gCodes[this.slideIndex]);
		var bReturn = true, val = prompt("Enter The Code");
		
		if(val !== gCodes[this.slideIndex])
		{
			bReturn =	false;
		}
		else
		{
		console.log(val)
		this.slideIndex++
		}
		return bReturn;
	}


};


app.init();