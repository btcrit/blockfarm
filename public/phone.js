console.log("Hello! Phone.js Loaded");

let last = document.getElementById('last_block');
let content = document.getElementById('content');

// ~~~~~ Establish Network and Define Reactions to Events ~~~~~
//HEY SERVER! Here I am :)
var socket = io.connect()
//Server said hi!
socket.on('connect',function(){
    console.log('Connected! ID is'+socket.io.engine.id);
    document.getElementById('button').addEventListener("click", function(e){
        socket.emit('block-mine-attempt', {
            prev: last.value,
            content: content.value
        });

    });
});
