


function onMessageResponse (obj)
{
    console.log(" worker listennig..." );
    switch(obj.data.cmd)
    {
            case 'start':
            self.postMessage({message:obj.data.msg+'........Sir!!!'})
            break;
    }


}
//self.addEventListener("onmessage",onMessageResponse,false);

self.onmessage = onMessageResponse;





