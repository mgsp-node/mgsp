#!/usr/local/bin/node
const net = require('net');

function decodeVarIntFromHex(hex) {
    const buffer = Buffer.from(hex, 'hex');
    let value = 0;
    let offset = 0;

    while (offset < buffer.length) {
        const byte = buffer.readUInt8(offset);
        value += (byte & 0x7f) << (7 * offset);

        if (!(byte & 0x80)) {
            break;
        }

        offset++;
    }

    return value;
}

function encodeVarIntToHex(value) {
    const buffer = Buffer.alloc(8);
    let offset = 0;

    do {
        let byte = value & 0x7f;
        value >>= 7;

        if (value > 0) {
            byte |= 0x80;
        }

        buffer.writeUInt8(byte, offset);
        offset++;
    } while (value > 0);

    const encodedHex = buffer.slice(0, offset).toString('hex');
    return encodedHex;
}

function forgeHandshake(address, port) {
    let data = encodeVarIntToHex(address.length + 7).padEnd(4, 0);
    data += "fc05";
    data += encodeVarIntToHex(address.length);
    data += Buffer.from(address, 'utf8').toString('hex');
    data += unsignedShortToHex(parseInt(port));
    data += "01";
    data += "0100";

    return data.toLowerCase();
}

function getHost(target) {
    const targetSplit = target.split(":");
    return targetSplit[0];
}

function getPort(target) {
    const targetSplit = target.split(":");
    if (targetSplit.length == 1) {
        return 25565;
    } else {
        return targetSplit[1];
    }
}

function unsignedShortToHex(unsignedShort) {
    if (unsignedShort >= 0 && unsignedShort <= 0xFFFF) {
        const hexString = unsignedShort.toString(16).toUpperCase();
        return '0'.repeat(4 - hexString.length) + hexString;
    } else {
        console.error("Value is out of range for an unsigned short.");
        return false;
    }
}

if (process.argv.length == 3) {
    const target = process.argv[2];
    const hostname = getHost(target);
    const port = getPort(target);

    let stream = "";
    let expectedLength = false;
    let index = 0;

    const socket = new net.Socket();

    const socketTimeout = setTimeout(()=>{
        console.error("Server didn't send any data. Connection closed.")
        socket.end();
        socket.destroy();
    }, 5000);

    const forgedHandshake = forgeHandshake(hostname, port);

    socket.connect({ host: hostname, port: port}, () => {
        clearTimeout(socketTimeout);
        socket.write(Buffer.from(forgedHandshake, 'hex'), 'utf8', () => {});
    });

    socket.on('data', data => {
        const streamData = Buffer.from(data, 'utf8').toString('hex');
        stream += streamData;

        if (expectedLength === false) {
            if (expectedLength === false) {
                if (streamData.charAt(2) == "0" && streamData.charAt(3) == "0") {
                    expectedLength = decodeVarIntFromHex(streamData.slice(0, 2));
                    index = 2;
                } else if (streamData.charAt(4) == "0" && streamData.charAt(5) == "0") {
                    expectedLength = decodeVarIntFromHex(streamData.slice(0, 4)) + 2;
                    index = 4;
                } else if (streamData.charAt(6) == "0" && streamData.charAt(7) == "0") {
                    expectedLength = decodeVarIntFromHex(streamData.slice(0, 6)) + 2;
                    index = 6;
                }
            }
        }
        if (expectedLength === false) {
            socket.end();
        }
        if (stream.length/2 == expectedLength) {
            socket.end();
        }
    });

    socket.on('end', () => {
        let o = false;

        const JSONStart = (index*2)+2;
        const JSONSlice = stream.slice(JSONStart);
        const JSONData = Buffer.from(JSONSlice, 'hex').toString('utf8');

        try {
            o = JSON.parse(JSONData);
        } catch (e) {
            socket.end();
        }

        if (JSONData) {
            console.log(JSONData);
        } else {
            console.error("Failed to obtain valid JSON data from remote server.");
        }
    });

} else {
    console.log("Please specify a valid Minecraft server IP or hostname.");
}
