var expect = require("chai").expect;

describe("Test test", function() {
  it("should pass this test", function() {
    expect(true).to.be.true;
  });

  it("should fail this test", function() {
    expect(true).to.be.false;
  });
});
