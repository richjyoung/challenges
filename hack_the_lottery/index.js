const net = require('net');
const chalk = require('chalk');
const moment = require('moment');

const flag = require('./flag');

const interval = 5000;
const max_iterations = 20;
const clients = {};

const server = net.createServer(connection_listener);
const global_seed = Math.floor(Math.random() * interval + 1);

let current_id = 1000;
let draw_time = 0;
let draw_original = '';
let draw_sorted = '';

/*****************************************************************************
 *                           Connection Management                           *
 *****************************************************************************/

function connection_listener(socket) {
    let id = current_id++;
    client_register(id, socket);
    client_welcome(id);
}

function client_register(id, socket) {
    log(id, `Connected from ${socket.remoteAddress}:${socket.remotePort}`);
    clients[id] = { socket };
    socket.on('close', () => {
        log(id, 'Disconnected');
        delete clients[id];
    });
}

function shutdown(msg) {
    console.log(chalk.red(msg));
    for (var id in clients) clients[id].socket.destroy();
    server.close();
    process.exit(1);
}

/*****************************************************************************
 *                             Client Messaging                              *
 *****************************************************************************/

function client_welcome(id) {
    writeln(id, 'H4ck_tH3_L0tT3ry');
    writeln(id, '================');
    client_send_enter_draw(id);
}

function client_send_enter_draw(id) {
    writeln(id);
    writeln(id, 'Choose six numbers between 1 and 99, separated by spaces');
    write(id, '> ');
    clients[id].socket.once('data', data => {
        client_recv_entry(id, data);
    });
}

function client_recv_entry(id, data) {
    let entry = data
        .toString('utf8')
        .trim()
        .split(' ')
        .filter(x => x >= 1 && x <= 99)
        .filter((x, i, a) => a.indexOf(x) == i)
        .sort((a, b) => a - b);

    if (entry.length === 6) {
        clients[id].entry = entry.join('-');
        log(id, `Entry: ${clients[id].entry}`);
        client_send_wait(id);
    } else {
        log(id, 'Invalid entry');
        client_send_enter_draw(id);
    }
}

function client_send_wait(id) {
    writeln(id);
    writeln(id, `Current time: ${moment(Date.now()).format('HH:mm:ss')}`);
    writeln(id, `Next draw:    ${moment(draw_time).format('HH:mm:ss')}`);
}

/*****************************************************************************
 *                                   Draw                                    *
 *****************************************************************************/

function rng_6(draw_time) {
    // Add the global seed to the next draw time to get the draw seed
    let draw_seed = reverse(draw_time + global_seed);
    let rng_iv = draw_seed;

    // Draw unique numbers from the seeded RNG
    let draw = [];
    let counter = 0;
    while (draw.length < 6) {
        let a = (rng_iv % 99) + 1;
        rng_iv = Math.floor(rng_iv / a);
        rng_iv = rng_iv * (99 - a + 1);
        counter += 1;
        if (counter > max_iterations) {
            shutdown('RNG Failure');
            return;
        }
        if (draw.indexOf(a) < 0) draw.push(a);
    }
    return draw;
}

function setup_draw() {
    // Setup draw for next interval time (ensuring it is no sooner than half the interval away)
    draw_time = (Math.floor(Date.now() / interval) + 1) * interval;
    while (draw_time - Date.now() < interval / 2) draw_time += interval;

    // Draw numbers
    let draw = rng_6(draw_time);

    // Store original and sorted draw order
    draw_original = draw.join('-');
    draw.sort((a, b) => a - b);
    draw_sorted = draw.join('-');

    let next_time = moment(draw_time).format('HH:mm:ss');
    console.log('[%s] %s', next_time, draw_original);

    // Schedule draw execution
    setTimeout(run_draw, draw_time - Date.now());
}

function run_draw() {
    for (id in clients) {
        if (clients[id].entry) {
            writeln(id, `Draw result:  ${draw_original}`);
            if (clients[id].entry === draw_sorted) {
                log(id, `********** WINNER **********`);
                writeln(id, 'You win!');
                writeln(id, flag);
            } else {
                writeln(id, 'Better luck next time.');
            }
            delete clients[id].entry;
            client_send_enter_draw(id);
        }
    }
    setup_draw();
}

/*****************************************************************************
 *                              Utils & Startup                              *
 *****************************************************************************/

function writeln(id, str) {
    write(id, `${str || ''}\r\n`);
}

function write(id, str) {
    clients[id].socket.write(`${str || ''}`);
}

function log(id, msg) {
    console.log(`${id}: ${msg}`);
}

function reverse(i) {
    return Number(
        String(i)
            .split('')
            .reverse()
            .join('')
    );
}

server.listen(process.argv[2], function() {
    console.log('H4ck_tH3_L0tT3ry');
    console.log('================');
    console.log(`Draw will be chosen every ${interval}ms`);
    setup_draw();
});
