console.log("Hello! Phone.js Loaded");

let help = document.getElementById('help_with');
let last = document.getElementById('last_block');
let content = document.getElementById('content');
let feedback = document.getElementById('feedback');
let points = document.getElementById('points');

// ~~~~~ Establish Network and Define Reactions to Events ~~~~~
//HEY SERVER! Here I am :)
var socket = io.connect();
//Server said hi!
socket.on('connect',function(){
    console.log('Connected! ID is'+socket.io.engine.id);
    document.getElementById('button').addEventListener("click", function(e){
        socket.emit('create', {
            prev: last.value,
            content: content.value
        });
        feedbackReset();
    });
    document.getElementById('help').addEventListener("click", function(e){
        socket.emit('mine', help.value);
        feedbackReset();
    });
});

socket.on('feedback', function(text){
    feedback.innerHTML = text;
    feedback.style.backgroundColor = "#750000";
});

socket.on('counted', function(pointst){
    points.innerHTML = "Points: "+pointst;
});

function feedbackReset(){
    feedback.style.backgroundColor = "#00754b";
    feedback.innerHTML = "All Systems Go";
}
