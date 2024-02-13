'ues strict';

/**
 * @type {Chai.ExpectStatic}
 */
let expect = null;
const { _validate } = require('../src/utils');

describe('utils test case', () => {
  before(async function () {
    const chai = await import('chai');
    expect = chai.expect;
  })
  it('validate successfully', () => {
    _validate({
      name: 'test',
    }, {
      name: 'required|string',
    });
  });

  it('validate failed', () => {
    try {
      _validate({
        name: 'test',
      }, {
        name: 'required|email',
      }, true);
    } catch (err) {
      expect(err.message).to.be.equal('name: The name format is invalid.');
    }
  });

  it('validate failed without throw error', () => {
    const errors = _validate({
      name: 'test',
    }, {
      name: 'required|email',
      age: 'required|numeric',
    }, false);
    expect(errors).to.be.deep.equal({
      name: ['The name format is invalid.'],
      age: ['The age field is required.'],
    });
  });
});
