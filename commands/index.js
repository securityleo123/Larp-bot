const moderation   = require('./moderation');
const announce     = require('./announce');
const media        = require('./media');
const leveling     = require('./leveling');
const staff        = require('./staff');

module.exports = {
  ...moderation,
  ...announce,
  ...media,
  ...leveling,
  ...staff,
};
