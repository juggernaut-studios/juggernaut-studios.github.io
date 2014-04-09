var http = require('http');
var server = http.createServer(function(request, response) {});




server.listen(1234, function() {
    console.log((new Date()) + ' Server is listening on port 1234');
});


var WebSocketServer = require('websocket').server;
wsServer = new WebSocketServer({
    httpServer: server
    
});


var count = 0;
var clients = {};



function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
               .toString(16)
               .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
         s4() + '-' + s4() + s4() + s4();
}

/*
autoAcceptConnections  :true
wsServer.on('connect', function(r){
    console.log(" connected client!" );
    
});*/



var count = 0;
var clients = {};


wsServer.on('request', function(r){
   var connection = r.accept('echo-protocol', r.origin);
    // Specific id for this client & increment count
    var id = count++;
    // Store the connection method so we can loop through & contact all clients
    clients[id] = connection
    
     console.log((new Date()) + ' Connection accepted [' + id + ']');
    
    // Create event listener
    connection.on('message', function(message) {

                // The string message that was sent to us
                var msgString = message.utf8Data;
                var mJSON = JSON.parse(msgString);
                console.log(typeof(mJSON))
                
                switch(mJSON.cmd)
                {
                    case 'connected':
                        // Loop through all clients
                        for(var i in clients){
                                    // Send a message to the client with the message
                                    mJSON.txt = " :D "+mJSON.uname+" has joined the chat server"
                                    clients[i].sendUTF(JSON.stringify(mJSON));
                            }
                        break;
                    case 'msg':
                            // Loop through all clients
                            for(var i in clients){
                                // Send a message to the client with the message
                                clients[i].sendUTF(msgString);
                            }
                        break;
                }
                

            });

    
    connection.on('close', function(reasonCode, description) {
                delete clients[id];
                console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
            });
    
    
    /*
    for(var i in clients){
            // Send a message to the client with the message
            if( i < count-1)
            {
                console.log(i +" vs "+count)    
                clients[i].sendUTF('{"cmd":"connected","data": '+(Object.keys(clients).length)+'}');
            }
        }*/
        
});