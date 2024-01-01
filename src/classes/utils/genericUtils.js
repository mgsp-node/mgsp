class genericUtils {
    static decodeVarIntFromHex(hex) {
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

    static encodeVarIntToHex(value) {
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

    static getHost(target) {
        const targetSplit = target.split(":");
        return targetSplit[0];
    }

    static getPort(target) {
        const targetSplit = target.split(":");
        if (targetSplit.length == 1) {
            return 25565;
        } else {
            return targetSplit[1];
        }
    }

    static hexToUnsignedShort(hexString) {
        hexString = hexString.replace(/^0x/, '');

        const unsignedShort = parseInt(hexString, 16);

        if (unsignedShort >= 0 && unsignedShort <= 0xFFFF) {
            return unsignedShort;
        } else {
            console.error("Hex value is out of range for an unsigned short.");
            return false;
        }
    }

    static unsignedShortToHex(unsignedShort) {
        if (unsignedShort >= 0 && unsignedShort <= 0xFFFF) {
            const hexString = unsignedShort.toString(16).toUpperCase();
            return '0'.repeat(4 - hexString.length) + hexString;
        } else {
            console.error("Value is out of range for an unsigned short.");
            return false;
        }
    }
}

module.exports = genericUtils;
