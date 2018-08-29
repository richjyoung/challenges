const net = require('net');
const crypto = require('crypto');
const chalk = require('chalk');
const moment = require('moment');

const flag = require('./flag');

const server = net.createServer(connection_listener);
const clients = {};
const interval = 5000;
const magic_number = 69127;
const global_seed = Math.floor(Math.random() * interval + 1);
let draw_time = 0;
let lottery_draw = [];

/*****************************************************************************
 *                           Connection Management                           *
 *****************************************************************************/

function connection_listener(socket) {
    let id = gen_id();
    client_register(id, socket);
    client_welcome(id);
}

function client_register(id, socket) {
    log(id, `Connected from ${socket.remoteAddress}:${socket.remotePort}`);
    clients[id] = { socket };
    socket.on('close', function() {
        log(id, 'Disconnected');
        delete clients[id];
    });
}

/*****************************************************************************
 *                             Client Messaging                              *
 *****************************************************************************/

function client_welcome(id) {
    const socket = clients[id].socket;
    socket.write('H4ck_tH3_L0tT3ry\r\n');
    socket.write('================\r\n');
    client_send_enter_draw(id);
}

function client_send_enter_draw(id) {
    clients[id].socket.write(
        '\r\nChoose six numbers between 1 and 99, separated by spaces\r\n> '
    );
    clients[id].socket.once('data', function(data) {
        client_recv_entry(id, data);
    });
}

function client_recv_entry(id, data) {
    let entry = data
        .toString('utf8')
        .trim()
        .split(' ')
        .map(x => {
            let n = Number(x);
            if (n >= 1 && n <= 99) {
                return n;
            }
        })
        .filter((x, i, a) => {
            return a.indexOf(x) == i;
        });

    entry.sort((a, b) => {
        return a - b;
    });

    if (entry.length === 6) {
        clients[id].entry = entry.join('-');
        log(id, `Entry: ${clients[id].entry}`);
        client_send_wait(id);
    } else {
        client_send_enter_draw(id);
    }
}

function client_send_wait(id) {
    clients[id].socket.write(
        `\r\nCurrent time: ${moment(Date.now()).format('HH:mm:ss')}\r\n`
    );
    clients[id].socket.write(
        `Next draw:    ${moment(draw_time).format('HH:mm:ss')}\r\n`
    );
}

/*****************************************************************************
 *                                   Draw                                    *
 *****************************************************************************/

function setup_draw() {
    // Setup draw for next interval time (ensuring it is no sooner than half the interval away)
    draw_time = (Math.floor(Date.now() / interval) + 1) * interval;
    while (draw_time - Date.now() < interval / 2) {
        draw_time += interval;
    }

    // Add the global seed to the next draw time to get the draw seed
    let draw_seed = reverse(draw_time + global_seed);
    let rng_iv = draw_seed;

    // Draw unique numbers from the seeded RNG
    let draw = [];
    while (draw.length < 6) {
        let a = rng_iv % 99 + 1;
        rng_iv = Math.floor(rng_iv / a);
        rng_iv = rng_iv * (99 - a + 1)
        if (draw.indexOf(a) < 0) {
            draw.push(a);
        }
    }

    // Sort and store ready for comparison
    draw.sort((a, b) => {
        return a - b;
    });
    lottery_draw = draw.join('-');

    console.log(
        chalk.yellow(
            `Next: ${moment(draw_time).format(
                'HH:mm:ss'
            )}, seed: ${draw_seed}, draw: ${lottery_draw}`
        )
    );

    // Schedule draw execution
    setTimeout(run_draw, draw_time - Date.now());
}

function run_draw() {
    for (id in clients) {
        if (clients[id].entry) {
            clients[id].socket.write(`\r\nDraw result: ${lottery_draw}\r\n`);
            if (clients[id].entry === lottery_draw) {
                log(id, `WINNER`);
                clients[id].socket.write('You win!\r\n');
                clients[id].socket.write(`${flag}\r\n`);
                clients[id].socket.destroy();
                delete clients[id];
            } else {
                clients[id].socket.write('Better luck next time\r\n');
                delete clients[id].entry;
                client_send_enter_draw(id);
            }
        }
    }
    setup_draw();
}

/*****************************************************************************
 *                              Utils & Startup                              *
 *****************************************************************************/

function gen_id() {
    return crypto.randomBytes(8).toString('hex');
}

function log(id, msg) {
    console.log(`${chalk.cyan(id)} ${msg}`);
}

function reverse(i) {
    return Number(String(i).split('').reverse().join(''));
}

server.listen(1337, function() {
    console.log(chalk.bgRed(' H4ck_tH3_L0tT3ry '));
    console.log(chalk.bgRed(' ================ '));
    console.log(`Draw will be chosen every ${interval}ms`);
    setup_draw();
});
