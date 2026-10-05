
## ⚠️ Disclaimer: Software Under Development ⚠️

This software is currently under **active development** and has not been audited for security or correctness.

Please be aware of the following:
* The software is **not fully tested**.
* **Do not use it in production environments** until a stable production release is available. 🚧
* Additional functionalities and optimizations **are planned for future releases**.
* Future updates may introduce breaking **backward compatible changes** as development progresses.

If you encounter any errors or unexpected behavior, please report them. Your feedback is highly appreciated in improving the software.

# PIL Compiler
Polynomial Identity Language 2 (pil2) compiler

## Setup
```sh
$ npm install
$ npm run build
```
## Usage

### Command line
Generate pilout file from pil file:
```sh
$ node src/pil.js <input.pil> -o <output.pilout>
```
Generate pilout file specifing paths where search pil files:
```sh
$ node src/pil.js <filename.pil> -o <filename.pilout> -I path1,path2,lib/std
```
The field is Goldilocks (`p = 2^64 - 2^32 + 1`) by default. To compile for the scalar field of BN128, the curve of Ethereum's precompiles (`alt_bn128`), pass `--field bn128`. Its order is `r = 21888242871839275222246405745257275088548364400416034343698204186575808495617`.
```sh
$ node src/pil.js <filename.pil> -o <filename.pilout> --field bn128
```
On a field larger than 64 bits, omit `-O fixed-to-file`: it only supports fields of 64 bits or less, and fails otherwise. The fixed data then stays inside the pilout, as by default.
## Quick Reference
In this section you will find a quick reference for the language in [doc/quick_reference.md](doc/quick_reference.md).
The STD library written in PIL2 is available in [pil2-components](https://github.com/0xPolygonHermez/pil2-proofman/tree/main/pil2-components).

## License

All crates in this monorepo are licensed under one of the following options:

- The Apache License, Version 2.0 (see LICENSE-APACHE or http://www.apache.org/licenses/LICENSE-2.0)

- The MIT License (see LICENSE-MIT or http://opensource.org/licenses/MIT)

You may choose either license at your discretion.

## Acknowledgements

ZisK is a collaborative effort made possible by the contributions of researchers, engineers, and developers dedicated to advancing zero-knowledge technology.

We extend our gratitude to the [Polygon zkEVM](https://github.com/0xpolygonhermez) team for their foundational work in zero-knowledge.

🚀 Special thanks to all contributors who have helped develop, refine, and improve pil2
