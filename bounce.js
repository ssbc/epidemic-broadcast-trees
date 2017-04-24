//call fn only every interval, call immediately if it hasn't
//been called within interval, and if it's called again within
//
module.exports = function (fn, interval) {
  var _ts = 0
  function go () {
    clearTimeout(timeout);
    timeout = null;
    _ts = Date.now();
    fn()
  }

  return function () {
    var diff = Date.now() - _ts
    if(diff > interval) go()
    else if(!timeout) {
      timeout = setTimeout(go, interval - diff)
    }
  }
}

