var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var counter = 0;

// Allow clients to grab static css and js
app.use(express.static('public'));
// Send client html.
app.get('/', function(req, res) {
    res.sendFile(__dirname + '/client.html')
})

//Setup Server Behavior
io.sockets.on('connection', function(socket){
  console.log('CNCT:'+socket.id);
  //When the client disconnects
  socket.on('disconnect', function(){
      console.log('DSCT:'+socket.id);
  });

  socket.on('button', function(){
      console.log('Button! '+counter);
      counter++;
  });
});

//Make it live
var port = process.env.PORT || 8000;
http.listen(port, function(){
  console.log('listening on port '+port);
});
