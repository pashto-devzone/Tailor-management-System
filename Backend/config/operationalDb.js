"use strict";
const db = require("./db");
module.exports = {
  prepare: (sql) => db.prepareOperational(sql),
  get: (sql, params = []) => db.prepareOperational(sql).get(...(params || [])),
  all: (sql, params = []) => db.prepareOperational(sql).all(...(params || [])),
  run: (sql, params = []) => db.prepareOperational(sql).run(...(params || [])),
  exec: (sql) => db.exec(sql),
};
