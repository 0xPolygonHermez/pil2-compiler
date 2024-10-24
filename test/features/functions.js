const chai = require("chai");
const { F1Field } = require("ffjavascript");
const assert = chai.assert;
const compile = require("../../src/compiler.js");
const ConstraintVerifier = require('../compiler_test.js');


describe("Functions", async function () {

    const F = new F1Field(0xffffffff00000001n);
    this.timeout(10000000);

    it("Functions Base Test", async () => {
        const cv = new ConstraintVerifier(compile(F, __dirname + "/functions.pil", null, { processorTest: true, proto: false }));

        cv.verifyNext('c1 - 2','witness@0 - 2');

        cv.verifyNext('c1 - 30','witness@0 - 30');

        cv.verifyNext('c1 - 27','witness@0 - 27');

        cv.verifyNext('c1 - vec[5]','witness@0 - witness@6');
        cv.verifyNext("c1 - 8'vec[5]","witness@0 - 8'witness@6");
        cv.verifyNext("c1 - vec[5]'10","witness@0 - witness@6'10");

        cv.verifyNext("c1 - 40320","witness@0 - 40320");
        cv.verifyNext("c1 - vec[6]","witness@0 - witness@7");
        cv.verifyNext("c1 - c1'120","witness@0 - witness@0'120");
        cv.verifyNext("c1 - 24'c1","witness@0 - 24'witness@0");

        cv.verifyNext("p1 - 100","witness@11 - 100");
        cv.verifyNext("p1 - 314","witness@12 - 314");

        cv.verifyNext("c1 - 24","witness@0 - 24");
        cv.verifyEnd();
    });

});
