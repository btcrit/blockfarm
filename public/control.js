console.log("Hello! control.js Loaded");

let help = document.getElementById('help_with');

// ~~~~~ Establish Network and Define Reactions to Events ~~~~~
//HEY SERVER! Here I am :)
var socket = io.connect('/control');

//Server said hi!
socket.on('connect',function(){
    console.log('Connected! ID is'+socket.io.engine.id);
    document.getElementById('help').addEventListener("click", function(e){
        socket.emit('nuke', help.value);
    });
});
