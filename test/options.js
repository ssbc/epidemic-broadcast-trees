
module.exports = require('../events')(
  process.env.EBT_V == 2
  ? require('../v2')
  : require('../v3')
)
