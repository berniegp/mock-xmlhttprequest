var assert = require('chai').assert;

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

// it.only('local MockXMLHttpRequest onSend and xhr onSend should both be called', function() {
//   function func0(){++func0.called};
//   func0.called = 0;
//   function func1(){++func1.called};
//   func1.called = 0;
//   function func2(){++func2.called};
//   func2.called = 0;

//   var mock = MockXhrFactory();
//   console.log('mock', mock)
//   console.log('mock.open', mock.open)
//   mock.onSend = func0;

//   var xhr1 = mock.open('get', '/hi')
//   xhr1.onSend = func1;

//   var xhr2 = mock.open('get', '/hi')
//   xhr2.onSend = func2;

//   xhr1.send()
//   assert.equal(func0.called, 1)
//   assert.equal(func1.called, 1)
//   assert.equal(func2.called, 0)

//   xhr2.send()
//   assert.equal(func0.called, 2)
//   assert.equal(func1.called, 1)
//   assert.equal(func2.called, 1)
// })

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

    setTimeout(function() {
      done(new Error('instance\'s onCreate not called'));
    }, 50);
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

    setTimeout(function() {
      done(new Error('instance\'s onSend not called'));
    }, 50);
  });

});
