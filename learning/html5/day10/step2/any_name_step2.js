


var mLocalResponse = "";
var mCntr =0;
var mInterval
function onMessageResponse (obj)
{
    console.log(" worker listennig..." );
    switch(obj.data.cmd)
    {
            case 'start':
            mLocalResponse = obj.data.msg;
           clearInterval(mInterval);
            mCntr =0;
            mInterval =setInterval(talkToMaster,1000);
            break;
            case 'stop':
            self.close();
             //alert(mSandeep) // NOT ACCESSIBLE coz of SCOPING
            break;
    }


}


function talkToMaster ()
{
    mCntr++;
     self.postMessage({message:mCntr+")"+mLocalResponse+'........Sir!!!'})
}
//self.addEventListener("onmessage",onMessageResponse,false);

self.onmessage = onMessageResponse;





