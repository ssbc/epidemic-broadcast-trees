//call fn only every interval, call immediately if it hasn't
//been called within interval, and if it's called again within
//
module.exports = function (fn, interval) {
  var _ts = 0, timer
  function go () {
    clearTimeout(timer);
    timeout = null;
    _ts = Date.now();
    fn()
  }

  return function () {
    var diff = Date.now() - _ts
    if(diff > interval) go()
    else if(!timer) {
      timer = setTimeout(go, interval - diff)
    }
  }
}

