
var ws;
var userName 

function onErrorRcvd(evt)
{
    console.log(" ERROR RCVD !! ",evt)
    document.getElementById('status').innerHTML ="Error In communication with Server."
}

function onMessageRcvd(evt)
{
    var tempData =   JSON.parse(evt.data);
    switch(tempData.cmd)
    {
                case "connected":
                    console.log("connect number "+Number(tempData.data))
                break;
                case "message":
                    console.log("msg Sent "+tempData.data)
                break;
    }
    
    
}


function start ()
{
    
    if(ws === undefined)
    {
        ws = new WebSocket('ws://localhost:1234', 'echo-protocol');


        /*ws.addEventListener("message", function(e) {
                                    // The data is simply the message that we're sending back
                                    var msg = JSON.parse(e.data) //e.data;
                                    console.log(msg);    
                                    // Append the message
                                    document.getElementById('content').innerHTML += '<br>' + msg;
                                });

        */


        //ws.onmessage = onMessageRcvd;
        ws.addEventListener("message", function(e) {
            // The data is simply the message that we're sending back
            var msg = JSON.parse(e.data);
            var sMsg = "";
            if(msg.cmd == "msg")
            {
                sMsg = ""+msg.uname +" : "+msg.txt;
            }
            else
            {
                //if(msg.uname !== userName)
                sMsg = msg.txt;
                
            }
                
            // Append the message
            document.getElementById('content').innerHTML += '<br>' + sMsg;
        });

        ws.onerror = onErrorRcvd ;
        ws.onopen = function(e)
        {
            document.getElementById('status').innerHTML ="Connection Setup..."
            console.log(" on socket open : ");

        }
        ws.onclose = function(e)
        {
            document.getElementById('status').innerHTML ="Connection Closed"
            console.log(" on socket onclose");
        }
    }
    
}


/*
function sendChat()
{
    var message = document.getElementById('input').value;
    ws.send("{cmd:login, data:"+message+"}");
    
}*/


function sendChat(){
    var message = document.getElementById('input').value;
    document.getElementById('input').value ="";
    ws.send('{"uname":"'+userName+'", "cmd":"msg", "txt":"'+message+'"}');
}


function sendLogin(){
    var message = document.getElementById('login').value;
    userName  = message;
    ws.send('{"uname":"'+message+'", "cmd":"connected"}');
}