var client_service = require("./clientService");
var room_service = require("./roomService");
var configs = require(process.argv[2]);
var config = configs.hall_server();

var db = require('../utils/db');
db.init(configs.mysql());

client_service.start(config);
room_service.start(config);