function doAction(evt){
    var str = evt.currentTarget.innerHTML;
    var sValue = str=str.replace(/^\s+|\s+$/g,'');
    var arrClassNames = ["rotate2dStyle","scale2dStyle","skew2dStyle","translate2dStyle","matrix2dStyle","rotate3dStyle","skew3dStyle","translate3dStyle","scale3dStyle","originStyle","transtionStyle moveDiv","loopedAnimation"];
    var arrliNames = ["2D Transform : Rotate","2D Transform : Scale","2D Transform : Skew","2D Transform : Translate","2D Transform : Matrix","3D Transform : Rotate","3D Transform : Skew","3D Transform : Translate","3D Transform : Scale","Transform : Shifting Origin And Rotate","Transition : width and height","keyFrames:Animation Looped"];
    var nIndex = arrliNames.indexOf(sValue);
    if(nIndex !== -1)
    {
    document.getElementById("ginnipig").className = arrClassNames[nIndex];
        document.getElementById("status").innerHTML= arrClassNames[nIndex];
    }
    
    //matrix - rotate, scale, move (translate), and skew elements.
}


function getStyle(className) {
    var classes = document.styleSheets[0].rules || document.styleSheets[0].cssRules
    for(var x=0;x<classes.length;x++) {
        if(classes[x].selectorText==className) {
                (classes[x].cssText) ? alert(classes[x].cssText) : alert(classes[x].style.cssText);
        }
    }
}

function PrintRules() {
    var rules = document.styleSheets[0].rules || document.styleSheets[0].cssRules
        for(var x=0;x<rules.length;x++) {
            document.getElementById("rules").innerHTML += rules[x].selectorText + "<br />";
        }
    }



function resetPage (evt)
{
    
    document.getElementById("ginnipig").className = "";
    document.getElementById("status").innerHTML=  "Display Class Content "
}


window.onload = function()
{
    
    var domCollections = document.getElementById("sidepanellist").childNodes;
    var len = domCollections.length , i =0;
    for(i=0;i<len;i++)
    {
        domCollections[i].addEventListener("click",doAction,false);
    }
    
    document.getElementById("resetbtn").addEventListener("click",resetPage,false);
}