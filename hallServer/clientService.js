var http = require('../utils/http');
var crypto = require('../utils/crypto');
var express = require('express');
var db = require('../utils/db');
var room_service = require("./roomService");

var app = express();
var config = null;

//设置跨域访问
app.all('*', function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
    res.header("X-Powered-By", ' 3.2.1');
    res.header("Content-Type", "application/json;charset=utf-8");
    next();
});

exports.start = function ($config) {
    config = $config;
    app.listen(config.CLEINT_PORT);
    console.log("大厅服 客户端端口: " + config.CLEINT_PORT);
};

// 检查是否传送了签名和账户
function check_account(req, res) {
    var account = req.query.account;
    var sign = req.query.sign;
    if (account == null || sign == null) {
        return false;
    }
    return true;
}
/**
 * 大厅服务器接受客户端发送登录请求
 */
app.get('/login', function (req, res) {
    if (!check_account(req, res)) {
        http.send(res, 1, "请求信息中没有账户和签名");
        return;
    }
    var ip = req.ip;
    if (ip.indexOf("::ffff:") != -1) {
        ip = ip.substr(7);
    }
    var account = req.query.account;
    console.log('请求登录账户 ', account);

    db.get_user_data(account, function (data) {
        if (data == null) { // 没有账户信息
            http.send(res, 0, "没有找到创建的账号信息，请创建角色"); // 此时错误码依旧返回0，让客户端在成功返回但没有ret信息的时候知道自己创建角色
            return;
        }
        var ret = {
            uid: data.uid,
            account: data.account,
            name: data.name,
            gems: data.gems,
        };
        http.send(res, 0, "ok", ret); // 返回查询的账户信息
    });
});

/**
 * 服务器接受客户端创建角色请求
 */
app.get('/create_user', function (req, res) {
    if (!check_account(req, res)) {
        http.send(res, 1, "请求信息中没有账户和签名");
        return;
    }
    var account = req.query.account;
    var name = req.query.name;
    var gems = 1102;
    console.log('新建玩家 ', name);

    db.is_user_exist(account, function (ret) {
        if (!ret) { // 不存在就创建一个
            db.create_user(account, name, gems, function (ret) {
                if (ret == null) {
                    http.send(res, 2, "写入数据库失败，检查数据是否初始化错误");
                } else {
                    http.send(res, 0, "ok");
                }
            });
        } else {
            http.send(res, 1, "账户重复创建.");
        }
    });
});

/**
 * 服务器接受客户端创建房间请求
 */
app.get('/create_private_room', function (req, res) {
    //验证参数合法性
    var data = req.query;
    //验证玩家身份
    if (!check_account(req, res)) {
        http.send(res, 1, "请求信息中没有账户和签名");
        return;
    }
    var account = data.account;
    data.account = null;
    data.sign = null;
    var conf = data.conf;
    // 获取玩家数据
    db.get_user_data(account, function (data) {
        if (data == null) {
            http.send(res, 1, "没有读取到玩家账户信息");
            return;
        }
        // 成功读取到玩家数据
        var userId = data.uid;
        var name = data.name;
        // 查找玩家已经存在的房间信息
        db.get_room_id_of_user(userId, function (roomId) {
            // console.log('查询玩家  roomId', userId, roomId)
            if (roomId != null) {
                // 已经有房间了，无法重新创建房间
                http.send(res, -1, "依旧加入房间", roomId);
                return;
            }
            // 正式创建房间
            room_service.createRoom(account, userId, conf, function (err, roomId) {
                if (err == 0 && roomId != null) {
                    // 创建成功 立即 进入房间
                    console.log('创建成功 立即 开始进入房间')
                    room_service.enterRoom(userId, name, roomId, function (errcode, enterInfo) {
                        if (enterInfo) {
                            var ret = {
                                roomid: roomId,
                                ip: enterInfo.ip,
                                port: enterInfo.port,
                                token: enterInfo.token,
                                time: Date.now()
                            };
                            ret.sign = crypto.md5(ret.roomid + ret.token + ret.time + config.ROOM_PRI_KEY);
                            http.send(res, 0, "ok", ret);
                            console.log('进入房间 成功')
                        } else {
                            if (errcode == -2) {
                                http.send(res, errcode, "读取房间网络地址失败.", errcode);
                            } else {
                                http.send(res, errcode, "进入房间失败，原因不明.", errcode);
                            }
                        }
                    });
                } else {
                    if (err == 101) {
                        http.send(res, err, "没有成功选中游戏服.");
                    } else if (err == 102) {
                        http.send(res, err, "没有得到游戏服响应.");
                    } else if (err == 103) {
                        http.send(res, err, "没有成功查询宝石数量.");
                    } else if (err == 104) {
                        http.send(res, err, "创建房间时没有正确的参数.");
                    } else if (err == 105) {
                        http.send(res, err, "游戏服验证签名失败.");
                    } else if (err == 106) {
                        http.send(res, err, "游戏配置数据错误.");
                    } else if (err == 107) {
                        http.send(res, err, "宝石数量不足.");
                    } else if (err == 108) {
                        http.send(res, err, "房间数据写入数据库失败.");
                    } else {
                        http.send(res, err, "未知原因.");
                    }
                }
            });

        })
    });
});