const net = require('net');

class AlarmServer {
    constructor(port) {
        this._clients = [];
        this._next_client = 1000;
        this._server = net.createServer(socket => {
            this.connection_listener(socket);
        });
        this._server.listen(port, this.server_started);
    }

    server_started() {
        console.log('Alarm Server');
        console.log('============');
        console.log();
        console.log('Server started.');
    }

    connection_listener(socket) {
        this._clients.push(new AlarmClient(this, this._next_client++, socket));
    }

    client_disconnected(client) {
        let i = this._clients.indexOf(client);
        if (i >= 0) this._clients.splice(i, 1);
    }
}

class AlarmClient {
    constructor(server, id, socket) {
        this._server = server;
        this._id = id;
        this._socket = socket;
        this._address = socket.address().address;
        this._port = socket.address().port;
        this._attempts = 0;
        this._pin = '';

        for (let i = 0; i < 4; i++)
            this._pin += String(Math.floor(Math.random() * 6) + 1);

        this.log(`Connected from ${this._address}:${this._port}`);
        this.log(`PIN set: ${this._pin}`);

        this._socket.on('close', () => {
            this.log('Disconnected');
            this._server.client_disconnected(this);
        });

        this.send_header();
        this.recv_pin();
    }

    get id() {
        return this._id;
    }

    log() {
        console.log(`[${this._id}]`, ...arguments);
    }

    send_header() {
        this.writeln('ALARM ACTIVE');
    }

    recv_pin() {
        this.writeln();
        this.write('Enter 4-digit PIN (1-6) to deactivate: ');
        this._socket.once('data', data => {
            this._attempts++;
            this.log(`Attempt ${this._attempts}, PIN entered: ${data}`);
            this.stall(data);
        });
    }

    stall(pin) {
        setTimeout(() => {
            this.send_result(pin.toString('utf8').trim());
        }, 1000);
    }

    send_result(pin) {
        const guess_arr = [...pin];
        const pin_arr = [...this._pin];
        const remaining_arr = [...this._pin];
        let correct = 0;

        this.writeln();

        if (pin === this._pin) {
            this.writeln('ACCESS GRANTED');
            this.writeln(`flag_{${require('./flag')}}`);
            this.disconnect();
            return;
        } else if (guess_arr.length === 4) {
            // Work through the guess, matching the correct values in their correct posision
            for (let i = 3; i >= 0; i--) {
                if (guess_arr[i] === pin_arr[i]) {
                    // If correct, increment the counter and remove the value from end of both guess and remaining
                    // arrays
                    correct += 1;
                    remaining_arr.splice(i, 1);
                    guess_arr.splice(i, 1)
                } 
            }

            // Now work through the remaining values that were not correct
            for (let i = guess_arr.length-1; i >= 0; i--) {
                // Work out if the guessed value is anywhere in the remaining array
                let j = remaining_arr.indexOf(guess_arr[i]);
                if (j >= 0) {
                    // Remove a match
                    remaining_arr.splice(j, 1);
                }
            }

            let wrong = 4 - correct - remaining_arr.length;
            this.writeln('ACCESS DENIED');
            this.writeln(`Correct digits in right position:   ${correct}`);
            this.writeln(`Remaining digits in wrong position: ${wrong}`);
        } else {
            this.writeln('ACCESS DENIED');
        }

        if (this._attempts < 6) {
            this.writeln(`${6 - this._attempts} attempts remaining`);
            this.recv_pin();
        } else {
            this.max_attempts();
        }
    }

    disconnect() {
        this._socket.end();
        this._socket.destroy();
    }

    max_attempts() {
        this.writeln('Maximum attempts reached');
        this.disconnect();
    }

    writeln(str) {
        this.write(`${str || ''}\r\n`);
    }

    write(str) {
        this._socket.write(str || '');
    }
}

const alarm_server = new AlarmServer(1338);
