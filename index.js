var express = require('express');
var app = express();
var http = require('http').Server(app);
// Socket connections to Phones
var io = require('socket.io')(http);
// Socket connections to Viewers
var ex = io.of('/explorer');

// Highlight most recent block to appear
// Limit text input
// Make it easier to help mine a block
// prevent empty blocks
// Trim extra whitespace
// discard if more than one word
// Lanugage Filter bad-words
// Limit to only one word
// Handle capitalization

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
    desc: Find a block that mining is being done on
    args: {prev: id, content: "text"}
    returns: the ID of the block being mined, or -1 if none.
*/
function find_block(block){
    for (var i = block.prev+1; i < blocks.length; i++) {
        // We've found a match if it builds on the same one and has the same content
        if(blocks[i].prev===block.prev && blocks[i].content===block.content){
            return i;
        }
    }
    return -1;
}

function block_mine_attempt(block){
    // Format the prev field to be an integer.
    block.prev = parseInt(block.prev);

    // If integer parsing failed, it's invalid, ignore it
    if(block.prev===NaN){return;}

    // Make sure we are building on a block that exists
    if(!(blocks[block.prev])){return;}

    // TODO Make sure we are building on a confirmed block
    if(!(blocks[block.prev].confirmed)){return;}

    // Find the block
    let block_id = find_block(block);

    if(block_id!==-1){
        // We found the block!
        // If it's already mined, ignore it.
        if(blocks[block_id].confirmed){return;}

        // Attempt to Mine that Block. (currently 20% chance)
        if(Math.random()*200 < 1){
            console.log("Block "+block_id+" Mined.");
            // Block is now confirmed
            blocks[block_id].confirmed = true;
            // Tell the explorer about this event
            ex.emit('block_mined', block_id);
        }
    }else{
        console.log("New Block: "+JSON.stringify(block, null, 4));
        // We're attempting a new block!
        let new_block_id = blocks.length;
        let new_block = {
            prev: block.prev,
            content: block.content,
            confirmed: false
        };
        // Record this
        blocks.push(new_block);
        // TODO tell the explorer about this
        ex.emit('new_block', {id: new_block_id, block: new_block});
    }
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
    socket.on('block-mine-attempt', function(block){
        block_mine_attempt(block);
    });

});
// Explorers
ex.on('connection', function(socket){
    console.log('EXPRCNCT:'+socket.id);
    // TODO - send all current blocks
    socket.emit('all_blocks', blocks);
    //When the client disconnects
    socket.on('disconnect', function(){
        console.log('EXPRDSCT:'+socket.id);
    });
});

// ---------- ---------- Activate, run ---------- ----------

var port = process.env.PORT || 8000;
http.listen(port, function(){
    console.log('listening on port '+port);
});
