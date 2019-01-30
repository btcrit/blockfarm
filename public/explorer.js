console.log("Hello! Explorer.js Loaded");

// Data Structure

// Blocks [{prev, content, confirmed, ROW}]
let blocks = [];

// Rows [rowreference,]
let rows = [];

window.onload = function(){
    rows.push(document.getElementById('genesis'));
}



function confirm_block(id){
    console.log("Block "+id+" CONFIRMED.");
    blocks[id].confirmed = true;
    // TODO update UI
    // Turn off unconfirmed styling
    blocks[id].element.setAttribute('class', 'block');
}

function new_block(neww){
    blocks[neww.id] = neww.block;
    console.log("Got new block: "+JSON.stringify(neww.block, null, 4));
    insert_block(neww.block, neww.id);
}

function load_all(all){
    blocks = all;
    console.log("Got all blocks: "+JSON.stringify(all, null, 4));
    for(let i=0; i<all.length; i++){
        insert_block(all[i], i);
    }
}

function insert_block(block, id){
    // We need to build the block and insert it in a row
    // Let's prepare the row first

    // If it's the Genesis block, do not insert.
    if(block.prev==="none"){
        // genesis! Already in via HTML
        block.row = 0;
        return;
    }

    // get the id of the row we want to insert into
    let rowid = blocks[block.prev].row+1;

    // Create that row if it doesn't exist
    if(rowid === rows.length){
        // create the row
        let div = document.createElement('div');
        div.setAttribute('class', 'row');
        let qrows = document.getElementById('rows');
        qrows.insertBefore(div, qrows.childNodes[0]);
        rows.push(div);
    }else if(rowid > rows.length){
        console.error("Recieved block where prev's row doesn't exist");
        console.error("rowid: "+rowid+" for block "+JSON.stringify(block, null, 4)+"\nrows: "+rows);
    }

    // The row exists now, get it.
    let row = rows[rowid];

    // Build the Block Content
    let title = document.createElement('h2');
    title.textContent = "Block #"+id;
    let content = document.createElement('h1');
    content.textContent = block.content;
    let link = document.createElement('h2');
    link.textContent = "Built on #"+block.prev;

    // Build the Block
    let ablock = document.createElement('div');
    ablock.setAttribute('class', 'block');
    ablock.appendChild(title);
    ablock.appendChild(content);
    ablock.appendChild(link);
    if(!block.confirmed){
        ablock.className += " unconfirmed";
        // Also store a reference to the element in the block,
        // so that we can confirm it later.
        block.element = ablock;
    }

    // Put the block in the row
    row.appendChild(ablock);

    // Now, scroll to the block so we can see it.
    ablock.scrollIntoView();

    // Tell the block what row it's in, so future blocks can build on it.
    block.row = rowid;
}

// ~~~~~ Establish Network and Define Reactions to Events ~~~~~

var socket = io('/explorer');

// handle connect, all_blocks([]), new_block(id,block), block_mined(id)

socket.on('connect',function(){
    console.log('Connected! ID is'+socket.io.engine.id);
});

socket.on('all_blocks', function(all){
    load_all(all);
});

socket.on('new_block', function(neww){
    new_block(neww);
});

socket.on('block_mined', function(id){
    confirm_block(id);
});
