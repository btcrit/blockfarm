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

// ---------- ---------- Data Structure ---------- ----------

/*
blocks = [
    {
        prev: id,               // What block this was built on
        content: text,          // What word(s) does it contain
        confirmed: false,       // Has it been mined?
        contributors: {
            socketID: clicks    // clicks contributed
        }
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

/*
socks = {
    socketID: {
        socket: socket,     // The connection object for communication
        total: clicks,      // How many clicks they've made in total
        counted: clicks     // How many clicks did they put in the longest chain?
    }
}
*/
var socks = {}; // socketID -> socket, total clicks

// Store a reference to the tallest block
var tallest = 0; // By default, the origin

// How difficult (avg clicks) is it to mine a block?
let difficulty = 50;

/*
    desc: Determine if a new block actually already exists
    args: {prev: id, content: "text"}
    returns: the ID of the block being mined, or -1 if none.
*/
function find_block(block){
    // Start at the ID being built on and work up
    for (var i = block.prev+1; i < blocks.length; i++) {
        // We've found a match if it builds on the same one and has the same content
        if(blocks[i].prev===block.prev && blocks[i].content.toUpperCase()===block.content.toUpperCase()){
            return i;
        }
    }
    return -1;
}

/*
Name: mine
Desc: Attempt to mine a block
Args:
    id - the block work is being done on
    socket - the user that is doing the work
*/
function mine(id, socket){

    // Make sure desired block exists
    if(!(blocks[id])){
        feedback(socket, "That block doesn't exist!")
        return;
    }

    // Make sure desired block is unconfirmed
    if(blocks[id].confirmed){
        feedback(socket, "That block has already been mined!")
        return;
    }

    // User (socket) is attempting to mine block (id)

    // Give user credit towards their total click count
    socks[socket.id]["total"]++;
    // Tell them about this
    socks[socket.id]["socket"].emit('counted', ""+(socks[socket.id]["counted"])+"/"+(socks[socket.id]["total"]));

    // Increase the total_work of this block
    blocks[id].total_work++;

    // Record that this user contributed to this block
    blocks[id].contributors[socket.id]++;

    // Test if the block was successfuly mined
    if(Math.random()*difficulty < 1){
        console.log("Block "+id+" Mined.");
        // Confirm the block
        blocks[id].confirmed = true;
        // Tell the user they suceeded
        feedback(socket, "You've mined that block!");
        // Tell the explorer to confirm the block
        ex.emit('block_mined', id);
        // Did we create a new tallest block?
        if(blocks[id].total_work > blocks[tallest].total_work){
            new_tallest(id);
        }
    }else{
        // Block wasn't mined - provide visual feedback of attempt
        ex.emit('block_attempted', id);
    }
}

// There's been an uprising, and a new king is born.
/*
Name: new_tallest
Desc: Re-calculate many things when a chain overtakes another
args: id - the id of the new tallest block
*/
function new_tallest(id){
    console.log("New Tallest Block: "+id+" With work: "+blocks[id].total_work);
    tallest = id;

    // WIPE COUNTED POINTS
    for(let sock in socks){
        socks[sock]["counted"] = 0;
    }

    // RE_CALC COUNTED POINTS
    // Start with the tallest block
    let cblock = blocks[tallest];
    do {
        // For every contributor
        for(let trib in cblock.contributors){
            // Increase the contributors score by how much they contributed to this block
            socks[trib]["counted"]+=cblock.contributors[trib];
        }
    // Do this for every block in this chain, down to the start.
    } while (cblock = blocks[cblock.prev]);

    // BROADCAST COUNTED POINTS
    // Tell each phone how many points they have
    for(let sock in socks){
        socks[sock]["socket"].emit('counted', ""+(socks[sock]["counted"])+"/"+(socks[sock]["total"]));
    }

    // Update the Explorer
    // So it can highlight the longest chain
    ex.emit('new_tallest', id);
}

/*
Name: Create
Desc: Attempt to make a new proposal
args:
    - block - {prev, content} - the block to create
    - socket - Who is responsible
*/
function create(block, socket){
    // Format the prev field to be an integer.
    block.prev = parseInt(block.prev);

    // If integer parsing failed, it's invalid, ignore it
    if(block.prev===NaN){
        feedback(socket, "Not a valid Integer");
        return;
    }

    // Make sure we are building on a block that exists
    if(!(blocks[block.prev])){
        feedback(socket, "The block you're trying to build on doesn't exist!")
        return;
    }

    // Make sure we are building on a confirmed block
    if(!(blocks[block.prev].confirmed)){
        feedback(socket, "The block you're trying to build on hasn't been confirmed yet!");
        return;
    }

    // If this block already exists, try and mine it, that's all.
    // This lets users mash the 'create' button
    let existing_block = find_block(block);
    if(existing_block!==-1){
        mine(existing_block, socket);
        return;
    }

    // Time to filter - Gotta keep it PG
    let text = block.content;
    text = text.trim();

    // Reject too long
    // Note - there are checks for this on client side as well, should be rare
    if(text.length > 10){
        feedback(socket, "Text Too Long");
        return;
    }

    // Reject empty
    if(text.length <=0){
        feedback(socket, "You must specify some text to include!");
        return;
    }

    // Character whitelist
    // This prevents strange symbols getting words past the profanity filter
    let stripped = text.replace(/[^a-zA-Z0-9 ,.?!'"]/gi, '');
    if(stripped !== text){
        feedback(socket, "Only Letters and Numbers permitted");
        return;
    }

    // Reject profanity
    if(filter.isProfane(text)){
        feedback(socket, "Text Triggered Profanity Filter");
        return;
    }

    // We've passed all the filter checks, let's creat the block!

    console.log("New Block: "+JSON.stringify(block, null, 4));
    // ID - add block to end of data structure
    let id = blocks.length;
    // CONFIRMED
    block.confirmed = false;
    // TOTAL WORK = last block's work plus 1
    block.total_work = 1+blocks[block.prev].total_work;
    // CONTRIBUTORS
    block.contributors = {};
    block.contributors[socket.id] = 1;
    // Credit the creator
    socks[socket.id]["total"]++;
    socks[socket.id]["socket"].emit('counted', ""+(socks[socket.id]["counted"])+"/"+(socks[socket.id]["total"]));
    // Announce
    blocks.push(block);
    ex.emit('block_created', {id: id, block: block});
}

/*
Name: feedback
Desc: Send feedback to clients so they know what's up
args:
    - socket - the client to send to
    - text - the message to send
*/
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
    // Create a new entry in the socks object
    socks[socket.id] = {};
    socks[socket.id]["socket"] = socket;
    socks[socket.id]["total"] = 0;
    socks[socket.id]["counted"] = 0;
    // Log Disconnections
    socket.on('disconnect', function(){
        console.log('DSCT:'+socket.id);
    });
    // Phones attempt to create blocks - handle that
    socket.on('create', function(block){
        create(block, socket);
    });
    // Phones attempt to help mine blocks - handle that also
    socket.on('mine', function(id){
        mine(id, socket);
    });
});

// Explorers
ex.on('connection', function(socket){
    console.log('EXPRCNCT:'+socket.id);
    // Send all current blocks
    socket.emit('all_blocks', blocks);
    socket.emit('new_tallest', tallest);
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
    // Relay nuke request - remove blocks that got past the profanity filter
    socket.on('nuke', function(id){
        if(!blocks[id]){
            console.log("Nuke Request for non-existing block "+id);
            return;}
        console.log("NUKE: Sending command to nuke "+id);
        ex.emit('nuke', id);
        blocks[id].content = "[removed]";
    });
    // Increase and Decrease the Difficulty
    socket.on('du', function(){
        difficulty+= 50;
        socket.emit('diffupdate', difficulty);
    });
    socket.on('dd', function(){
        difficulty-= 50;
        socket.emit('diffupdate', difficulty);
    });
});

// ---------- ---------- Activate, run ---------- ----------

// Listen on either the defined port or 80
var port = process.env.PORT || 80;
http.listen(port, function(){
    console.log('listening on port '+port);
});
