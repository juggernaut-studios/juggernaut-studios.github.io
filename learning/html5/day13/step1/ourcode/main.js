
var scr = ['page1', 'page2','page3', 'page4'];


function showScreen(id) { "use strict";
                        var i;
                       for(i=0;i<scr.length;i++)
                       {
                           document.getElementById(scr[i]).style.display ="none";
                       }
                       
                         document.getElementById(id).style.display ="block";
                      };

function windowLoaded() { "use strict";
                         showScreen('page1');
                            
            
                        };


window.addEventListener("load", windowLoaded, false);