var chai = require('chai');
chai.use(require('sinon-chai'));
chai.should();
var assert = chai.assert;

var sinon = require('sinon');

var MockXhrFactory = require('../src/MockXhrFactory');
var MockXhr = require('../src/MockXhr');

it('factory should not return the global MockXhr object', function() {
  assert.notEqual(
    MockXhrFactory(),
    MockXhr
  );

  assert.equal(MockXhr, MockXhr);
});

it('factory should not return same instance of MockXhr object', function() {
  assert.notEqual(
    MockXhrFactory(),
    MockXhrFactory()
  );

  var mockSame = MockXhrFactory();
  assert.equal(mockSame, mockSame);
});

describe('different instances should have different', function() {
  it('onCreate function', function() {
    var func0 = function(){};
    var func1 = function(){};
    assert.notEqual(func0, func1);

    var mock0 = MockXhrFactory();
    mock0.onCreate = func0;
    assert.equal(mock0.onCreate, func0);

    var mock1 = MockXhrFactory();
    mock1.onCreate = func1;
    assert.equal(mock1.onCreate, func1);

    assert.notEqual(mock0.onCreate, mock1.onCreate);
  });

  it('onSend function', function() {
    var func0 = function(){};
    var func1 = function(){};
    assert.notEqual(func0, func1);

    var mock0 = MockXhrFactory();
    mock0.onSend = func0;
    assert.equal(mock0.onSend, func0);

    var mock1 = MockXhrFactory();
    mock1.onSend = func1;
    assert.equal(mock1.onSend, func1);

    assert.notEqual(mock0.onSend, mock1.onSend);
  });
});

describe('isolation of', function() {
  function OnComplete(callback) {
    this.callback = callback;
    this.awaitCount = 0;
  }
  OnComplete.prototype.await = function() {
    ++this.awaitCount;
    return this.resolve.bind(this);
  };
  OnComplete.prototype.resolve = function resolve() {
    if (--this.awaitCount === 0) this.callback();
  };

  it('factory instances', function(done) {
    var allSends = new OnComplete();

    var func0 = sinon.spy(allSends.await());
    var func1 = sinon.spy(allSends.await());

    allSends.callback = function() {
      try {
        func0.should.have.been.calledOnce;
        func1.should.have.been.calledOnce;
        done();
      } catch(err) {
        done(err);
      }
    };

    var LocalMock0 = MockXhrFactory();
    LocalMock0.onSend = func0;
    var xhr0 = new LocalMock0();
    xhr0.open('get', '0url');

    var LocalMock1 = MockXhrFactory();
    LocalMock1.onSend = func1;
    var xhr1 = new LocalMock1();
    xhr1.open('get', '1url');

    xhr0.send('0');
    xhr1.send('1');
  });

  it('local xhr onSend', function(done) {
    var allSends = new OnComplete();

    var func0 = sinon.spy(allSends.await());
    var func1 = sinon.spy(allSends.await());
    var func2 = sinon.spy(allSends.await());

    allSends.callback = function() {
      try {
        func0.should.have.been.calledOnce;
        func1.should.have.been.calledOnce;
        func2.should.have.been.calledOnce;
        done();
      } catch(err) {
        done(err);
      }
    };

    var LocalMock = MockXhrFactory();
    LocalMock.onSend = func0;

    var xhr1 = new LocalMock();
    xhr1.open('get', '/hi');
    xhr1.onSend = func1;

    var xhr2 = new LocalMock();
    xhr2.open('get', '/hi');
    xhr2.onSend = func2;

    xhr1.send('stuff1');
    xhr2.send('stuff2');
  });
});




describe('does not call global', function() {

  it('MockXhr.onCreate', function(done) {
    var globalOnCreateCalled = false;
    MockXhr.onCreate = function() {globalOnCreateCalled = true;};

    var Mock = MockXhrFactory();
    Mock.onCreate = function() {
      try {
        assert.isFalse(globalOnCreateCalled);
        done();
      } catch(err) {done(err);}
    };

    new Mock();
  });

  it('MockXhr.onSend', function(done) {
    var globalOnSubmitCalled = false;
    MockXhr.onSend = function() {
      globalOnSubmitCalled = true;
    };

    var Mock = MockXhrFactory();
    Mock.onSend = function() {
      try {
        assert.isFalse(globalOnSubmitCalled);
        done();
      } catch(err) {done(err);}
    };

    var mockInstance = new Mock();
    mockInstance.open('GET', '/url');
    mockInstance.send();
  });

});
