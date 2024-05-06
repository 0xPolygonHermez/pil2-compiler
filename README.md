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