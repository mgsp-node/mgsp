const fs = require('fs');
const GUtils = require('./genericUtils.js')

class mgspUtils {
    static forgeHandshake(address, port) {
        let data = GUtils.encodeVarIntToHex(address.length + 7).padEnd(4, 0);
        data += "fc05";
        data += GUtils.encodeVarIntToHex(address.length);
        data += Buffer.from(address, 'utf8').toString('hex');
        data += GUtils.unsignedShortToHex(parseInt(port));
        data += "01";
        data += "0100";

        return data.toLowerCase();
    }

    static getServerStatusData(file, raw = false) {
        const data = fs.readFileSync(file, 'UTF-8');
        if (raw) {
            return Buffer.from(data, "utf8").toString("utf8");
        } else {
            return mgspUtils.getServerStatusHexPrefix(data) + Buffer.from(data, "utf8").toString("hex");
        }
    }

    static getServerStatusHexPrefix(status) {
        const length = status.length;
        let pad;
        
        if (GUtils.encodeVarIntToHex(length).length == 6) {
            pad = 6;
        } else if (GUtils.encodeVarIntToHex(length).length == 4) {
            pad = 4;
        } else if (GUtils.encodeVarIntToHex(length).length == 2) {
            pad = 2;
        }

        const magicNumber = String(GUtils.encodeVarIntToHex(length)).padStart(pad, 0).length - 1;
        const prefix = GUtils.encodeVarIntToHex(length + magicNumber) + "00" + GUtils.encodeVarIntToHex(length);
        return prefix;
    }

    static log(text) {
        const d = new Date();
        const time = "[" + String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth()+1).padStart(2, "0") + "." + String(d.getFullYear()) + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") + ":" + String(d.getSeconds()).padStart(2, "0") + "]: ";
        console.log(`${time}${text}`);
    }

    static parseHandshake(handshake) {
        let hex = handshake.toString('hex');

        if (hex.endsWith("0100")) {
            hex = hex.slice(0, -4);
        }

        if (hex == "") {
            return
        }

        const hostnameLength = GUtils.decodeVarIntFromHex(hex.slice(0, 4)) - 7;

        if (hostnameLength) {
            const testData = hex.slice(0, 10 + hostnameLength * 2 + 4 + 2);
            if (testData.endsWith("01") || testData.endsWith("02")) {
                hex = testData;
            } else {
                return
            }
        } else {
            return
        }

        const hostname = Buffer.from(hex.slice(10).slice(0, hostnameLength * 2), 'hex').toString();

        if (parseInt(hostname.length + 7) != parseInt(GUtils.decodeVarIntFromHex(hex.slice(0, 4)))) {
            return
        }

        if (GUtils.decodeVarIntFromHex(hex.slice(8, 10)) != hostname.length) {
            return
        }

        const protocolVersion = GUtils.decodeVarIntFromHex(hex.slice(4, 8));

        const port = GUtils.hexToUnsignedShort(hex.slice(hex.length - 6, -2));

        let getStatus;
        let doLogin;
        switch (hex.slice(hex.length - 2)) {
            case "01":
                getStatus = true;
                doLogin = false;
                break;
            case "02":
                getStatus = false;
                doLogin = true;
                break;
            default:
                getStatus = false;
                doLogin = false;
        }

        const handshakeData = {
            protocolVersion: protocolVersion,
            hostname: hostname,
            port: port,
            getStatus: getStatus,
            doLogin: doLogin
        }

        return handshakeData;
    }

    static pickServerStatus(data) {
        if (typeof data == "object") {
            return data[Math.floor(Math.random()*data.length)];
        } else {
            return data;
        }
    }

    static writeJsonFile(file, jsonString) {
        if (!fs.existsSync(file)) {
            let o;
            try {
                o = JSON.stringify(JSON.parse(jsonString), null, 4);
            } catch (e) {
                console.error(`Failed to write ${write} because of invalid JSON.`);
                process.exit(1);
            }
            fs.writeFileSync(file, o);
        }
    }
}

module.exports = mgspUtils;
