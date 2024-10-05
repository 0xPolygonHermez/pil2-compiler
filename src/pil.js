#!/usr/bin/env node

const path = require("path");
const fs = require("fs");
const version = require("../package").version;
const compile = require("./compiler.js");
const ffjavascript = require("ffjavascript");
const tty = require('tty');
const assert = require('./assert.js');
const debugConsole = require('./debug_console.js');

const argv = require("yargs")
    .version(version)
    .usage("pil <source.pil> -o <output.json> [-P <pilconfig.json>]")
    .alias("e", "exec")
    .alias("o", "output")
    .alias("n", "name")
    .alias("P", "config")
    .alias("v", "verbose")
    .alias("I", "include")
    .option("nofixed")
    .alias("l", "lib")
    .alias("f", "includePathFirst")
    .alias("a", "asserts")
    .alias("O", "option")
    .argv;

Error.stackTraceLimit = Infinity;

async function run() {
    let inputFile;
    if (argv._.length == 0) {
        console.log("You need to specify a source file");
        process.exit(1);
    } else if (argv._.length == 1) {
        inputFile = argv._[0];
    } else  {
        console.log("Only one circuit at a time is permited");
        process.exit(1);
    }

    const fullFileName = path.resolve(process.cwd(), inputFile);
    const fileName = path.basename(fullFileName, ".pil");

    let config = typeof(argv.config) === "string" ? JSON.parse(fs.readFileSync(argv.config.trim())) : {};

    if (argv.output) {
        config.outputFile = argv.output;
    } else if (typeof config.outputFile === 'undefined') {
        config.outputFile = fileName + ".pilout";
    }

    if (argv.name) {
        config.name = argv.name;
    } else if (typeof config.name === 'undefined') {
        config.name = path.parse(config.outputFile).name;
    }

    if (argv.verbose) {
        config.verbose = true;
        if (typeof config.color === 'undefined') {
            config.color = tty.isatty(process.stdout.fd);
        }
    }
    if (argv.nofixed) {
        config.fixed = false;
    }
    // only execute
    if (argv.exec || argv.output === 'none') {
        config.protoOut = false;
    }
    const F = new ffjavascript.F1Field((1n<<64n)-(1n<<32n)+1n );

    if (argv.lib) {
        config.includes = argv.lib.split(',');
    }
    if (argv.include) {
        config.includePaths = argv.include.split(',');
    }
    if (argv.asserts) {
        assert.enable(true);
    }

    if (argv.includePathFirst) {
        config.includePathFirst = true;
    }
    if (argv.option) {
        const options = Array.isArray(argv.option) ? argv.option : [argv.option];
        for (const option of options) {
            const posEqual = option.indexOf('=');
            const key = (posEqual > 0) ? option.substr(0, posEqual) : option;
            const value = (posEqual > 0) ? option.substr(posEqual + 1) : true;
            const camelCaseKey = key.replace(/-([a-z])/g, (m, chr) => chr.toUpperCase());
            config[camelCaseKey] = value;
        }
    }
    if (config.logLines) {
        debugConsole.init();
    }   
    const out = compile(F, fullFileName, null, config);
}    


run().then(()=> {
    process.exitCode = 0;
}, (err) => {
    console.log(err.stack);
    if (err.pos) {
        console.error(`ERROR at ${err.errFile}:${err.pos.first_line},${err.pos.first_column}-${err.pos.last_line},${err.pos.last_column}   ${err.errStr}`);
    } else {
        console.log(err.message);
    }
    process.exitCode = 1;
});
