var crypto = require('../utils/crypto');
var express = require('express');
var db = require('../utils/db');
var http = require('../utils/http');
const e = require('express');
var app = express();

exports.start = function ($config) {
    config = $config;
    app.listen(config.ROOM_PORT, config.FOR_ROOM_IP);
    console.log("大厅服 留给游戏服 端口= " + config.FOR_ROOM_IP + ":" + config.ROOM_PORT);
};

//设置跨域访问
app.all('*', function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
    res.header("X-Powered-By", ' 3.2.1');
    res.header("Content-Type", "application/json;charset=utf-8");
    next();
});
/**
 * 接受来自游戏服的同步请求
 */
app.get('/register_gs', function (req, res) {
    var ip = req.ip;
    var clientip = req.query.clientip;
    var clientport = req.query.clientport;
    var httpPort = req.query.httpPort;
    var load = req.query.load;
    var id = clientip + ":" + clientport;
    var serverType = req.query.serverType;
    // 该游戏服信息已经存在
    if (serverMap[id]) {
        var info = serverMap[id];
        if (info.clientport != clientport || info.httpPort != httpPort || info.ip != ip) {
            console.log("游戏服地址 重复注册 gsid:" + id + ",addr:" + ip + "(" + httpPort + ")" + "游戏的类型：" + serverType);
            http.send(res, 1, "重复注册 gsid:" + id);
            return;
        }
        info.load = load;
        http.send(res, 0, "ok", { ip: ip });
    } else {
        // 不存在，则保存新的地址
        serverMap[id] = {
            ip: ip,
            id: id,
            clientip: clientip,
            clientport: clientport,
            httpPort: httpPort,
            load: load,
            serverType: serverType
        };
        http.send(res, 0, "ok", { ip: ip });  // 返回注册成功
        console.log("游戏服地址成功注册 .\n\tid:" + id + "\n\taddr:" + ip + "\n\thttp port:" + httpPort + "\n\tsocket clientport:" + clientport + " 游戏的类型：" + serverType);
    }
});
// 寻找一个合适的游戏服
var serverMap = {};
function chooseServer(serverType) {
    console.log("查找类型为", serverType, "的游戏服");
    var serverinfo = null;
    for (var s in serverMap) {
        var info = serverMap[s];
        if (serverinfo == null) {
            if (serverType == info.serverType) {
                serverinfo = info;
            }
        } else {
            if (serverType == info.serverType) {
                if (serverinfo.load > info.load) {
                    serverinfo = info;
                }
            }
        }
    }
    if (serverinfo) console.log("返回游戏服", serverinfo.serverType, serverinfo.clientport, "的游戏服");
    return serverinfo;
}
// 创建一个房间
exports.createRoom = function (account, userId, roomConf, fnCallback) {
    var serverinfo = chooseServer(JSON.parse(roomConf).gameType);
    if (serverinfo == null) {
        fnCallback(101, null);
        return;
    }
    db.get_gems(account, function (data) {
        if (data != null) {
            // 构建向游戏服请求创建房间数据
            var reqdata = {
                userid: userId,
                gems: data.gems,
                conf: roomConf
            };
            // 构建游戏服签名
            reqdata.sign = crypto.md5(userId + roomConf + data.gems + config.ROOM_PRI_KEY);
            // console.log('hall room md5 == ', reqdata.sign)
            // console.log('hall room md5 == ', userId + roomConf + data.gems)
            http.get(serverinfo.ip, serverinfo.httpPort, "/create_room", reqdata, function (ret, data) {
                if (ret) {
                    if (data.errcode == 0) {
                        fnCallback(0, data.roomid);
                    } else {
                        fnCallback(data.errcode, null);
                    }
                    return;
                }
                fnCallback(102, null);
            });
        } else {
            fnCallback(103, null);
        }
    })
};
// 进入一个房间
exports.enterRoom = function (userId, name, roomId, fnCallback) {
    // 构建进入房间数据
    var reqdata = {
        userid: userId,
        name: name,
        roomid: roomId,
        sign: '',
    };
    reqdata.sign = crypto.md5(userId + name + roomId + config.ROOM_PRI_KEY);
    // 房间游戏是否已经开始
    var checkRoomIsRuning = function (serverinfo, roomId, callback) {
        var sign = crypto.md5(roomId + config.ROOM_PRI_KEY);
        http.get(serverinfo.ip, serverinfo.httpPort, "/is_room_runing", { roomid: roomId, sign: sign }, function (ret, data) {
            if (ret) {
                if (data.errcode == 0 && data.runing == true) {
                    callback(true);
                } else {
                    callback(false, data.errcode);
                }
            } else {
                callback(false, data.errcode);
            }
        });
    }
    // 请求进入房间
    var enterRoomReq = function (serverinfo) {
        http.get(serverinfo.ip, serverinfo.httpPort, "/enter_room", reqdata, function (ret, data) {
            if (ret) {
                if (data.errcode == 0) {
                    db.set_room_id_of_user(userId, roomId, function (ret) {
                        fnCallback(0, {
                            ip: serverinfo.clientip,
                            port: serverinfo.clientport,
                            token: data.token
                        });
                    });
                } else {
                    console.log(data.errmsg);
                    fnCallback(data.errcode, null);
                }
            } else {
                fnCallback(-1, null);
            }
        });
    };
    // 选中服务器并发起进入请求
    var chooseServerAndEnter = function (serverinfo) {
        console.log("chooseServerAndEnter 选中的服务器", JSON.stringify(serverinfo));
        serverinfo = chooseServer(serverinfo.serverType);
        if (serverinfo != null) {
            enterRoomReq(serverinfo);
        } else {
            fnCallback(-1, null);
        }
    }

    db.get_room_addr(roomId, function (ret, ip, port) {
        if (ret) {
            var id = ip + ":" + port;
            var serverinfo = serverMap[id];
            if (ip = '127.0.0.1' && !serverinfo) { // 当使用本地服务器是，注册时使用的 ‘localhost’ 但是创建房间时痛的ip地址段。也就是这里数据库返回的ip字段； 当使用外网时注册和写入数据库的都是ip
                serverinfo = serverMap['localhost' + ":" + port];
            }
            if (serverinfo != null) {
                checkRoomIsRuning(serverinfo, roomId, function (isRuning) {
                    if (isRuning) {
                        enterRoomReq(serverinfo);
                    } else {
                        chooseServerAndEnter(serverinfo);
                    }
                });
            } else {

            }
        } else {
            fnCallback(-2, null);
        }
    });
};