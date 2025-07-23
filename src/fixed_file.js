const fs = require("fs");
const path = require("path");
const Context = require("./context.js");
const MAX_BUFF_SIZE = 1024 * 1024 * 16; // 8 * 32Mb
const HEADER_SIGNATURE = "cnst\x01\0\0\0\x01\0\0\0\x01\0\0\0";

module.exports = class FixedFile {
    constructor (valuesList, rows) {
        this.valuesList = valuesList;
        this.loaded = valuesList.map(() => false);
        this.rows = rows;
    }
    defineCol(col, values) {
        if (this.valuesList[col] !== undefined) {
            throw new Error(`Column ${col} already defined in fixed file`);
        }
        this.valuesList[col] = values;
    }
    saveToFile(filename) {
        const _filename = (!Context.config.outputDir || filename.startsWith('/')) ? filename : path.join(Context.config.outputDir, filename);
        const dirname = path.dirname(_filename);
        if (!fs.existsSync(dirname)) {
            fs.mkdirSync(dirname, { recursive: true });
        }
        const fd = fs.openSync(_filename, "w+");

        const cols = this.valuesList.length;
        const maxBuffSize = MAX_BUFF_SIZE;
        const totalSize = cols * this.rows;
        const buff = new BigUint64Array(Math.min(totalSize, maxBuffSize));

        let p=0;
        for (let irow = 0; irow < this.rows; irow++) {
            for (let icol = 0; icol < cols; ++icol) {
                let value = BigInt(this.valuesList[icol][irow]);
                // improvements if no negative 
                if (value < 0n) {
                    // value += Context.Prime;                
                    value += 0xFFFF_FFFF_0000_0001n;
                }
                // assert(value >= 0n, `Negative value ${value} at row ${irow} and column ${icol}`);
                buff[p++] = value;
                if (p == buff.length) {
                    const buff8 = new Uint8Array(buff.buffer);
                    fs.writeSync(fd, buff8);
                    p=0;
                }
            }
            
        }

        if (p) {
            const buff8 = new Uint8Array(buff.buffer, 0, p*8);
            fs.writeSync(fd, buff8);
        }

        fs.closeSync(fd);
    }    
    static loadColumnFromFile(filename, col, rows, values, label) {
        const fd = FixedFile.openFile(filename);
        const cols = fd.size / (8 * rows);
        console.log(`  > Loading fixed column ${label} on #${col} of file ${fd.filename} [size:${fd.size} rows:${rows} cols:${cols}]`);

        const maxBuffSize = MAX_BUFF_SIZE; 
        const totalSize = Math.min(cols * rows - col, fd.size / 8);
        const buff = new BigUint64Array(Math.min(totalSize, maxBuffSize));
        const buff8 = new Uint8Array(buff.buffer);

        // First read (assume that first row is lower than maxBuffSize)

        const length = Math.min(buff.length, totalSize) * 8;
        const bytesRead = fs.readSync(fd, buff8, {offset: 0, position: 8 * col, length});
        if (bytesRead < length) {
            throw new Error(`Error reading file ${filename}, expected to read ${length} bytes, but got ${bytesRead}`);
        }

        // First row        
        values[0] = BigInt(buff[0]);            

        // Rest of rows
        let index = cols;
        for (let irow = 1; irow < rows; irow++) {
            if (index >= buff.length) {
                const p = irow * cols + col;
                const length = Math.min(buff.length, totalSize + col - p) * 8;
                // Read next chunk
                const bytesRead = fs.readSync(fd, buff8, {offset: 0, position: 8 * p, length});
                if (bytesRead < length) {
                    throw new Error(`Error reading file ${filename}, expected to read ${length} bytes, but got ${bytesRead}`);
                }
                index = 0;
            }
            if (buff[index] === 'undefined') {
                throw new Error(`Error reading file ${filename}, column ${col} is undefined [row:${irow}/${rows} index:${index} length:${length}]`);
            }
            values[irow] = BigInt(buff[index]);
            index += cols;
        }
        fs.closeSync(fd);
    }
    /*
    load() {
        this.fullFilename = (!Context.config.inputDir || filename.startsWith('/')) ? filename : path.join(Context.config.inputDir, filename);
        if (!fs.existsSync(this.fullFilename)) {
            throw new Error(`Fixed file ${filename} (${this.fullFilename}) not found`);
        }
        this.fd = fs.openSync(this.fullFilename, "r");
        const size = fs.fstatSync(fd).size;
        this.loadHeader();

        const airgroupName = fdBin.readString();
        const airName = fdBin.readString();
        const N = fdBin.readULE64();
        const nFixedPols = await fdBin.readULE32();
        const cols = fd.size / (8 * this.rows);
        const maxBuffSize = MAX_BUFF_SIZE; 
        const totalSize = cols * this.rows;
        const buff = new BigUint64Array(Math.min(totalSize, maxBuffSize));
        const buff8 = new Uint8Array(buff.buffer);
        const load = new Array(cols).map((value, index) => this.loaded[index] !== true && typeof this.valuesList[index] !== 'undefined');

        // First read (assume that first row is lower than maxBuffSize)

        const length = Math.min(buff.length, totalSize) * 8;
        const bytesRead = fs.readSync(fd, buff8, {offset: 0, position: 0, length});
        if (bytesRead < length) {
            throw new Error(`Error reading file ${filename}, expected to read ${length} bytes, but got ${bytesRead}`);
        }

        // First row
        
        for (let icol = 0; icol < cols; ++icol) {
            if (load[icol]) {
                continue;
            }
            this.loaded[icol] = true;
            this.valuesList[icol][0] = BigInt(buff[icol]);            
        }           

        // Rest of rows
        let p = cols;
        for (let irow = 1; irow < this.rows; irow++) {
            for (let icol = 0; icol < cols; ++icol) {
                const index = p % buff.length;
                if (index == 0) {
                    const length = Math.min(buff.length, totalSize - p) * 8;
                    const bytesRead = fs.readSync(fd, buff8, {offset: 0, position: p * 8, length});
                    if (bytesRead < length) {
                        throw new Error(`Error reading file ${filename}, expected to read ${length} bytes, but got ${bytesRead}`);
                    }
                }
                if (load[icol]) {
                    this.valuesList[icol][irow] = BigInt(buff[index]);
                }
                p += 1;
            }            
        }
        fs.closeSync(fd);
    }*/
}
