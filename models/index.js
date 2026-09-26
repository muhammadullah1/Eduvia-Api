"use strict";

const fs = require("fs");
const path = require("path");
const config = require("../config");
const { camelCase, upperFirst } = require("lodash");
const { Sequelize, DataTypes } = require("sequelize");

const basename = path.basename(__filename);
const db = {};

let sequelize = new Sequelize(
  config.get("db.name"),
  config.get("db.username"),
  config.get("db.password"),
  {
    host: config.get("db.host"),
    port: Number(config.get("db.port")),
    dialect: "postgres",
    pool: {
      max: 50,
      min: 10,
      idle: 10000,
      acquire: 30000,
    },
    logging: false, //process.env.NODE_ENV === "test" ? false : true,
  },
);
const logger = require("../utils/logger");

sequelize
  .authenticate()
  .then(() => {
    if (process.env.NODE_ENV !== "test") {
      logger.info("Database connection established successfully");
    }
  })
  .catch((err) => {
    logger.logError(err, { context: "Database connection" });
  });

fs.readdirSync(__dirname)
  .filter((file) => {
    return (
      file.indexOf(".") !== 0 && file !== basename && file.slice(-3) === ".js"
    );
  })
  .forEach((file) => {
    let model = require(path.join(__dirname, file));
    model = model(sequelize, DataTypes);
    let name = upperFirst(camelCase(model.name));
    db[name] = model;
  });

Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;
db.DataTypes = DataTypes;

module.exports = db;
