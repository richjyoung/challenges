const net = require('net');
const crypto = require('crypto');

class ISHServer {
    constructor(port) {
        this._clients = [];
        this._next_client = 1000;
        this._server = net.createServer(socket => {
            this.connection_listener(socket);
        });
        this._server.listen(port, () => this.server_started(port));
    }

    server_started(port) {
        console.log('ISH Server');
        console.log('==========');
        console.log();
        console.log(`Server started on *:${port}`);
    }

    connection_listener(socket) {
        const id = this._next_client++;
        const client = new ISHClient(id, socket);
        client.log(`Connected (${socket.remoteAddress}:${socket.remotePort})`);
        this._clients.push(client);

        socket.on('close', () => {
            client.log(`Disconnected`);
            let i = this._clients.indexOf(client);
            if (i >= 0) this._clients.splice(i, 1);
        });
    }
}

class ISHClient {
    constructor(id, socket) {
        this._id = id;
        this._socket = socket;
        this._addr = socket.remoteAddress;
        this._prefix_len = 6;
        this._secret = this.calc_prefix(this._addr, 'guest', 'guest', 123456);
        this._default_pass = `flag_{${require('./flag')}}`;

        this.send_header();
    }

    calc_prefix(addr, user, pass, pin) {
        const pin_hex = Number(pin).toString(16);
        const input = `${addr}:${user}:${pass}:${pin_hex}`;

        const prefix = crypto
            .createHash('md5')
            .update(input)
            .digest('hex')
            .substring(0, this._prefix_len);

        this.log(`${input} - ${prefix}`);

        return prefix;
    }

    send_header() {
        this.writeln('ISH (Insecure SHell)');
        this.writeln('====================');
        this.writeln();
        this.writeln(`You are connected from ${this._addr}`);
        this.writeln('Guest Account user/password/PIN: guest/guest/123456');
        this.writeln();

        this.user();
    }

    user() {
        this.write('User:     ');
        this._socket.once('data', data => this.recv_user(data));
    }

    recv_user(user) {
        this._user = user.toString('utf8').trim();
        this.password();
    }

    password() {
        this.write('Password: ');
        this._socket.once('data', data => this.recv_password(data));
    }

    recv_password(password) {
        this._pass = password.toString('utf8').trim();
        this.pin();
    }

    pin() {
        this.write('PIN:      ');
        this._socket.once('data', data => this.recv_pin(data));
    }

    recv_pin(pin) {
        this._pin = parseInt(pin.toString('utf8').trim());
        this.check();
    }

    check() {
        const prefix = this.calc_prefix(
            this._addr,
            this._user,
            this._pass,
            this._pin
        );

        if (prefix === this._secret) {
            this.writeln(`Logged in as ${this._user}`);
            if (this._user === 'guest') {
                this.writeln('No flags for guests.');
            } else if (this._user === 'admin') {
                if (this._pass.length < 32) {
                    this.write('Weak password detected: ');
                    this.writeln(this._pass || this._default_pass);
                }
            } else {
                this.writeln('Nice work, flags are for admins only.');
            }
        } else {
            this.writeln('Incorrect user, password or PIN.');
        }
        this.disconnect();
    }

    disconnect() {
        this._socket.end();
        this._socket.destroy();
    }

    log() {
        console.log(`[${this._id}]`, ...arguments);
    }

    writeln(str) {
        this.write(`${str || ''}\r\n`);
    }

    write(str) {
        this._socket.write(str || '');
    }
}

const server = new ISHServer(process.argv[2]);
