console.log("Hello! Explorer.js Loaded");

// Data Structure

// Blocks [{prev, content, confirmed, ROW}]
let blocks = [];

// Rows [rowreference,]
let rows = [];

let attempt_blink_duration = 50; // milliseconds; 1000=1s
let most_recent_duration = 1000;


window.onload = function(){
    rows.push(document.getElementById('genesis'));
    update_svg();

}

window.onresize = function(){
    update_svg();
    re_draw_lines();
}

function update_svg(){
    let svg = document.getElementById('svg');
    let info = document.getElementById('svg_sizer').getBoundingClientRect();
    svg.setAttribute('width', info.width);
    svg.setAttribute('height', info.height);
}


function re_draw_lines(){
    // delete all lines
    let svg = document.getElementById('svg');
    while(svg.firstChild){
        svg.removeChild(svg.firstChild);
    }
    // Draw new lines
    for(let i=1; i<blocks.length; i++){
        // Only draw elements that exist
        if(blocks[i].element){
            draw_line(blocks[i].element, blocks[blocks[i].prev].element);
        }
    }
}

function draw_line(el1, el2){
    let svg = document.getElementById('svg');
    let el1_info = el1.getBoundingClientRect();
    let el2_info = el2.getBoundingClientRect();
    var newLine = document.createElementNS('http://www.w3.org/2000/svg','line');
    var newLine2 = document.createElementNS('http://www.w3.org/2000/svg','line');
    let el1x = el1.offsetLeft + el1_info.width/2;
    let el1y = el1.offsetTop + el1_info.height/2;
    let el2x = el2.offsetLeft + el2_info.width/2;
    let el2y = el2.offsetTop + el2_info.height/2;
    newLine.setAttribute('x1',el1x);
    newLine.setAttribute('y1',el1y);
    newLine.setAttribute('x2',el2x);
    newLine.setAttribute('y2',el2y);
    newLine.setAttribute("stroke", "white");
    newLine.setAttribute("stroke-width", "10");
    newLine2.setAttribute('x1',el1x);
    newLine2.setAttribute('y1',el1y);
    newLine2.setAttribute('x2',el2x);
    newLine2.setAttribute('y2',el2y);
    newLine2.setAttribute("stroke", "black");
    newLine2.setAttribute("stroke-width", "5");
    svg.appendChild(newLine);
    svg.appendChild(newLine2);
}

function findAbsolutePosition(htmlElement) {
  var x = htmlElement.offsetLeft;
  var y = htmlElement.offsetTop;
  for (var x=0, y=0, el=htmlElement;
       el != null;
       el = el.offsetParent) {
         x += el.offsetLeft;
         y += el.offsetTop;
  }
  return {
      "x": x,
      "y": y
  };
}

function block_attempted(id){
    blocks[id].element.classList.add('attempt');
    setTimeout(function(){
        blocks[id].element.classList.remove('attempt');
    }, attempt_blink_duration);
}

function block_mined(id){
    console.log("Block "+id+" CONFIRMED.");
    blocks[id].confirmed = true;
    // TODO update UI
    // Turn off unconfirmed styling
    blocks[id].element.setAttribute('class', 'block');
}

function block_created(neww){
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
        block.element = document.getElementById('genesis_block');
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
    }
    // Also store a reference to the element in the block,
    // so that we can confirm it later.
    block.element = ablock;

    // Put the block in the row
    row.appendChild(ablock);

    // Now, scroll to the block so we can see it.
    ablock.scrollIntoView();

    // Styling of most-recent added block:
    ablock.classList.add('recent');
    setTimeout(function(){
        ablock.classList.remove('recent');
    }, most_recent_duration);

    // Tell the block what row it's in, so future blocks can build on it.
    block.row = rowid;

    // Use SVG magic to draw lines
    update_svg();
    re_draw_lines();
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

socket.on('block_created', function(neww){
    block_created(neww);
});

socket.on('block_mined', function(id){
    block_mined(id);
});

socket.on('block_attempted', function(id){
    block_attempted(id);
});
