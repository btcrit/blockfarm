var express = require('express');
var app = express();
var http = require('http').Server(app);
// Socket connections to Phones
var io = require('socket.io')(http);
// Socket connections to Viewers
var ex = io.of('/explorer');
var ct = io.of('/control');
// Filter bad words
let Filter = require('bad-words');
let filter = new Filter();

let difficulty = 50;


// ---------- ---------- Data Structure ---------- ----------

/*
blocks = [
    {
        prev: id,
        content: text,
        confirmed: false
        contributors: {}; // socketID : Clicks
    },
]
// the block's position in the array is it's ID.
*/

var blocks = [
    {
        prev: "none",
        content: "Genesis Block",
        confirmed: true,
        total_work: 0
    }
];

var socks = {}; // socketID -> socket, total clicks

var tallest = blocks[0]; // Tallest block is origin

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

function mine(id, socket){
    // Make sure desired block exists
    if(!(blocks[id])){
        feedback(socket, "That block doesn't exist!")
        return;}
    // Make sure desired block is unconfirmed
    if(blocks[id].confirmed){
        feedback(socket, "That block has already been mined!")
        return;}

    // Mine
    // user gets credit (total)
    socks[socket.id]["total"]++;
    socks[socket.id]["socket"].emit('counted', ""+(socks[socket.id]["counted"])+"/"+(socks[socket.id]["total"]));
    // Increase block total work
    blocks[id].total_work++;
    // Record that one came from this user
    blocks[id].contributors[socket.id]++;
    if(Math.random()*difficulty < 1){
        console.log("Block "+id+" Mined.");
        blocks[id].confirmed = true;
        feedback(socket, "You've mined that block!");
        ex.emit('block_mined', id);
        // Did we create a new tallest block?
        if(blocks[id].total_work > tallest.total_work){
            console.log("New Tallest Block: "+id+" With work: "+blocks[id].total_work);
            tallest = blocks[id];
            // WIPE COUNTED POINTS
            for(let sock in socks){
                socks[sock]["counted"] = 0;
            }
            // RE_CALC COUNTED POINTS
            let cblock = tallest;
            do {
                for(let trib in cblock.contributors){
                    socks[trib]["counted"]+=cblock.contributors[trib];
                }
            } while (cblock = blocks[cblock.prev]);
            // BROADCAST COUNTED POINTS
            for(let sock in socks){
                socks[sock]["socket"].emit('counted', ""+(socks[sock]["counted"])+"/"+(socks[sock]["total"]));
            }
        }
    }else{
        ex.emit('block_attempted', id);
    }
}

function create(block, socket){
    // Format the prev field to be an integer.
    block.prev = parseInt(block.prev);

    // If integer parsing failed, it's invalid, ignore it
    if(block.prev===NaN){return;}

    // Make sure we are building on a block that exists
    if(!(blocks[block.prev])){
        feedback(socket, "That block doesn't exist!")
        return;
    }

    // Make sure we are building on a confirmed block
    if(!(blocks[block.prev].confirmed)){
        feedback(socket, "That block isn't mined yet!");
        return;
    }

    // If this block already exists, try and mine it, that's all.
    let existing_block = find_block(block);
    if(existing_block!==-1){
        mine(existing_block, socket);
        return;
    }

    // Time to filter
    let text = block.content;
    text = text.trim();

    // Reject too long
    if(text.length > 10){
        feedback(socket, "Text Too Long");
        return;}

    // Reject empty
    if(text.length <=0){
        feedback(socket, "No Empty Blocks");
        return;}

    // Character whitelist
    let stripped = text.replace(/[^a-zA-Z0-9 ,.?!'"]/gi, '');
    if(stripped !== text){
        feedback(socket, "Only Letters and Numbers permitted");
        return;}

    // Reject profanity
    if(filter.isProfane(text)){
        feedback(socket, "Text Triggered Profanity Filter");
        return;}

    // Okay, now actually create the new block.
    console.log("New Block: "+JSON.stringify(block, null, 4));
    // ID
    let id = blocks.length;
    // CONFIRMED
    block.confirmed = false;
    // TOTAL WORK
    block.total_work = 1+blocks[block.prev].total_work;
    // CONTRIBUTORS
    block.contributors = {};
    block.contributors[socket.id] = 1;
    socks[socket.id]["total"]++;
    socks[socket.id]["socket"].emit('counted', ""+(socks[socket.id]["counted"])+"/"+(socks[socket.id]["total"]));
    // Announce
    blocks.push(block);
    ex.emit('block_created', {id: id, block: block});
}

function feedback(socket, text){
    socket.emit('feedback', text);
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

// Send page for control
app.get('/control', function(req, res) {
    res.sendFile(__dirname + '/control.html')
})

// ---------- ---------- Setup Socket Behavior ---------- ----------

// Phones
io.sockets.on('connection', function(socket){
    // Log Connections
    console.log('CNCT:'+socket.id);
    socks[socket.id] = {};
    socks[socket.id]["socket"] = socket;
    socks[socket.id]["total"] = 0;
    socks[socket.id]["counted"] = 0;
    // Log Disconnections
    socket.on('disconnect', function(){
        console.log('DSCT:'+socket.id);
    });
    // Phones attempt to mine blocks - handle that
    socket.on('create', function(block){
        create(block, socket);
    });
    socket.on('mine', function(id){
        mine(id, socket);
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

// Control System
ct.on('connection', function(socket){
    console.log('CTRLCNCT:'+socket.id);
    //When the client disconnects
    socket.on('disconnect', function(){
        console.log('CTRLDSCT:'+socket.id);
    });
    socket.on('nuke', function(id){
        if(!blocks[id]){
            console.log("Nuke Request for non-existing block "+id);
            return;}
        console.log("NUKE: Sending command to nuke "+id);
        ex.emit('nuke', id);
        blocks[id].content = "[removed]";
    });
});

// ---------- ---------- Activate, run ---------- ----------

var port = process.env.PORT || 80;
http.listen(port, function(){
    console.log('listening on port '+port);
});
