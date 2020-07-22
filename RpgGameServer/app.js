var bridge_to_hall = require("./bridgeToHall");
var socket_service = require("./socket_service");

//从配置文件获取服务器信息
var configs = require(process.argv[2]);
var config = configs.rpg_game_server();

var db = require('../utils/db');
db.init(configs.mysql());

// 开启联通大厅服务
bridge_to_hall.start(config);
//开启SOCKET长连接服务
socket_service.start(config);