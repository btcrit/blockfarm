console.log("Hello!");

// ~~~~~ Establish Network and Define Reactions to Events ~~~~~
//HEY SERVER! Here I am :)
var socket = io.connect()
//Server said hi!
socket.on('connect',function(){
    console.log('Connected! ID is'+socket.io.engine.id);
    document.getElementById('button').addEventListener("click", function(e){
        socket.emit('button');
    });
});
