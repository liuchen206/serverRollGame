var crypto = require('../utils/crypto');
var express = require('express');
var tokenMgr = require("./tokenmgr");
var http = require('../utils/http');
var roomMgr = require("./roommgr");

var app = express();
var config = null;

exports.start = function ($config) {
    config = $config;
    gameServerInfo = {
        id: config.SERVER_ID,
        clientip: config.CLIENT_IP,
        clientport: config.CLIENT_PORT,
        httpPort: config.HTTP_PORT,
        serverType: config.SERVER_TYPE,
        load: roomMgr.getTotalRooms(), // 负载
    };
    setInterval(update, 1000);
    app.listen(config.HTTP_PORT, config.FOR_HALL_IP);
    console.log("游戏服 监听地址 " + config.FOR_HALL_IP + ":" + config.HTTP_PORT);
};
app.all('*', function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
    res.header("X-Powered-By", ' 3.2.1');
    res.header("Content-Type", "application/json;charset=utf-8");
    next();
});
/**
 * 向大厅服务器同步房间信息
 */
var gameServerInfo = null;
var lastTickTime = 0;
var serverIp = ""; // 游戏服务器地址（起始就是自己的ip）
function update() {
    if (lastTickTime + config.HTTP_TICK_TIME < Date.now()) {
        lastTickTime = Date.now();
        gameServerInfo.load = roomMgr.getTotalRooms();
        http.get(config.HALL_IP, config.HALL_PORT, "/register_gs", gameServerInfo, function (ret, data) {
            if (ret == true) {
                if (data.errcode != 0) {
                    console.log(data.errmsg);
                }
                if (data.ip != null) {
                    serverIp = data.ip;
                }
            } else {
                lastTickTime = 0;
            }
        });

        // var mem = process.memoryUsage();
        // var format = function (bytes) {
        //     return (bytes / 1024 / 1024).toFixed(2) + 'MB';
        // };
        //console.log('Process: heapTotal '+format(mem.heapTotal) + ' heapUsed ' + format(mem.heapUsed) + ' rss ' + format(mem.rss)); // 内存监控
    }
}
// 创建一个新房间
app.get('/create_room', function (req, res) {
    var userId = parseInt(req.query.userid);
    var sign = req.query.sign;
    var gems = req.query.gems;
    var conf = req.query.conf;
    if (userId == null || sign == null || conf == null) {
        http.send(res, 104, "invalid parameters,on create_room");
        return;
    }
    var md5 = crypto.md5(userId + conf + gems + config.ROOM_PRI_KEY);
    // console.log('game md5 == ', md5)
    // console.log('game md5 == ', userId + conf + gems)
    if (md5 != req.query.sign) {
        http.send(res, 105, "sign check failed.");
        return;
    }

    conf = JSON.parse(conf);
    roomMgr.createRoom(userId, conf, gems, serverIp, config.CLIENT_PORT, function (errcode, roomId) {
        if (errcode != 0 || roomId == null) {
            http.send(res, errcode, "create failed.");
        } else {
            http.send(res, 0, "ok", { roomid: roomId });
        }
    });
});

// 房间是否已经开始游戏
app.get('/is_room_runing', function (req, res) {
    var roomId = req.query.roomid;
    var sign = req.query.sign;
    if (roomId == null || sign == null) {
        http.send(res, 1, "invalid parameters");
        return;
    }
    var md5 = crypto.md5(roomId + config.ROOM_PRI_KEY);
    if (md5 != sign) {
        http.send(res, 2, "sign check failed.");
        return;
    }
    http.send(res, 0, "ok", { runing: true });
});
// 进入房间请求
app.get('/enter_room', function (req, res) {
    var userId = parseInt(req.query.userid);
    var name = req.query.name;
    var roomId = req.query.roomid;
    var sign = req.query.sign;
    // 参数检查
    if (userId == null || roomId == null || sign == null) {
        http.send(res, 1, "数据不全");
        return;
    }
    // 签名检查
    // crypto.md5(userId + name + roomId + config.ROOM_PRI_KEY)
    // console.log('游戏服核算签名字串', userId + name + roomId + config.ROOM_PRI_KEY)
    var md5 = crypto.md5(userId + name + roomId + config.ROOM_PRI_KEY);
    if (md5 != sign) {
        http.send(res, 2, "签名验证失败.");
        return;
    }
    //安排玩家坐下
    roomMgr.enterRoom(roomId, userId, name, function (ret) {
        if (ret != 0) {
            if (ret == 1) {
                http.send(res, 4, "房间已满.");
            } else if (ret == 2) {
                http.send(res, 3, "找不到房间.");
            }
            return;
        }
        // 为长连接构建token---非常重要
        var token = tokenMgr.createToken(userId, 5000);
        http.send(res, 0, "ok", { token: token });
    });
});