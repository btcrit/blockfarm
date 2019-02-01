var express = require('express');
var app = express();
var http = require('http').Server(app);
// Socket connections to Phones
var io = require('socket.io')(http);
// Socket connections to Viewers
var ex = io.of('/explorer');
// Filter bad words
let Filter = require('bad-words');
let filter = new Filter();

let difficulty = 20;


// ---------- ---------- Data Structure ---------- ----------

/*
blocks = [
    {
        prev: id,
        content: text,
        confirmed: false
    },
]
// the block's position in the array is it's ID.
*/

var blocks = [
    {
        prev: "none",
        content: "Genesis Block",
        confirmed: true
    }
];

/*
    desc: Determine if a new block actually already exists
    args: {prev: id, content: "text"}
    returns: the ID of the block being mined, or -1 if none.
*/
function find_block(block){
    for (var i = block.prev+1; i < blocks.length; i++) {
        // We've found a match if it builds on the same one and has the same content
        if(blocks[i].prev===block.prev && blocks[i].content.toUpperCase()===block.content.toUpperCase()){
            return i;
        }
    }
    return -1;
}

function mine(id){
    // Make sure desired block exists
    if(!(blocks[id])){return;}
    // Make sure desired block is unconfirmed
    if(blocks[id].confirmed){return;}
    // Mine
    if(Math.random()*difficulty < 1){
        console.log("Block "+id+" Mined.");
        blocks[id].confirmed = true;
        ex.emit('block_mined', id);
    }else{
        ex.emit('block_attempted', id);
    }
}

function create(block){
    // Format the prev field to be an integer.
    block.prev = parseInt(block.prev);

    // If integer parsing failed, it's invalid, ignore it
    if(block.prev===NaN){return;}

    // Make sure we are building on a block that exists
    if(!(blocks[block.prev])){return;}

    // Make sure we are building on a confirmed block
    if(!(blocks[block.prev].confirmed)){return;}

    // If this block already exists, try and mine it, that's all.
    let existing_block = find_block(block);
    if(existing_block!==-1){
        mine(existing_block);
        return;
    }

    // Time to filter
    let text = block.content;
    text = text.trim();

    // Reject too long
    if(text.length > 10){return;}

    // Reject empty
    if(text.length <=0){return;}

    // Reject more than one word
    if(text.split(' ').length>1){return;}

    // Reject profanity
    if(filter.isProfane(text)){return;}

    // Okay, now actually create the new block.
    console.log("New Block: "+JSON.stringify(block, null, 4));
    let id = blocks.length;
    block.confirmed = false;
    // Record this
    blocks.push(block);
    // Announce to the explorers
    ex.emit('block_created', {id: id, block: block});
}

// ---------- ---------- Serve Static Files ---------- ----------

// Allow clients to grab static css and js
app.use(express.static('public'));

// Send the page for phone clients
app.get('/', function(req, res) {
    res.sendFile(__dirname + '/phone.html')
})

// Send page for projector screen, block viewer
app.get('/explorer', function(req, res) {
    res.sendFile(__dirname + '/explorer.html')
})

// ---------- ---------- Setup Socket Behavior ---------- ----------

// Phones
io.sockets.on('connection', function(socket){
    // Log Connections
    console.log('CNCT:'+socket.id);
    // Log Disconnections
    socket.on('disconnect', function(){
        console.log('DSCT:'+socket.id);
    });
    // Phones attempt to mine blocks - handle that
    socket.on('create', function(block){
        create(block);
    });
    socket.on('mine', function(id){
        mine(id);
    });
});

// Explorers
ex.on('connection', function(socket){
    console.log('EXPRCNCT:'+socket.id);
    // Send all current blocks
    socket.emit('all_blocks', blocks);
    //When the client disconnects
    socket.on('disconnect', function(){
        console.log('EXPRDSCT:'+socket.id);
    });
});

// ---------- ---------- Activate, run ---------- ----------

var port = process.env.PORT || 80;
http.listen(port, function(){
    console.log('listening on port '+port);
});
