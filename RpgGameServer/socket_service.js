var tokenMgr = require('./tokenmgr');
var userMgr = require('./usermgr');
var roomMgr = require('./roommgr');
var crypto = require('../utils/crypto');

var io = null;
exports.start = function (config, mgr) {
    io = require('socket.io')(config.CLIENT_PORT);
    console.log("游戏服 长连接 监听端口 " + config.CLIENT_PORT);

    io.sockets.on('connection', function (socket) {
        //断开链接
        socket.on('disconnect', function (data) {
            var userId = socket.userId;
            if (!userId) {
                return;
            }
            var data = {
                userId: userId,
                online: false
            };

            //通知房间内其它玩家，玩家掉线
            userMgr.broacastInRoom('user_rpg_net_state_push', data, userId);

            //清除玩家的在线信息
            userMgr.del(userId);
            socket.userId = null;
        });
        // 心跳保持
        socket.on('game_ping', function (data) {
            var userId = socket.userId;
            if (!userId) {
                return;
            }
            socket.emit('game_pong');
        });
        // 发起解散房间
        socket.on('dissolve_request', function (data) {
            var userId = socket.userId;
            if (userId == null) {
                return;
            }
            socket.gameMgr.closeGame(userId);
        });
        // 发起加入房间
        socket.on('join', function (data) {
            data = JSON.parse(data);
            console.log("游戏服 长连接来访", data.roomid);
            if (socket.userId != null) {
                //已经登陆过的就忽略
                return;
            }
            var token = data.token;
            var roomId = data.roomid;
            var time = data.time;
            var sign = data.sign;

            //检查参数合法性
            if (token == null || roomId == null || sign == null || time == null) {
                socket.emit('join_rpg_result', { errcode: 1, errmsg: "invalid parameters,on login" });
                return;
            }
            //检查参数是否被篡改
            var md5 = crypto.md5(roomId + token + time + config.ROOM_PRI_KEY);
            if (md5 != sign) {
                socket.emit('join_rpg_result', { errcode: 2, errmsg: "login failed. invalid sign!" });
                return;
            }
            //检查token是否有效
            if (tokenMgr.isTokenValid(token) == false) {
                socket.emit('join_rpg_result', { errcode: 3, errmsg: "token out of time." });
                return;
            }

            // tokenMgr 在进入游戏房间时提前通过玩家id生成了token，所以在长连接时，通过token反向获得玩家id
            var userId = tokenMgr.getUserID(token);
            userMgr.bind(userId, socket);
            socket.userId = userId;

            //返回房间信息
            var roomId = roomMgr.getUserRoom(userId);
            var roomInfo = roomMgr.getRoom(roomId);
            var seatIndex = roomMgr.getUserSeat(userId);
            roomInfo.seats[seatIndex].ip = socket.handshake.address;

            //构建给客户端的返回数据（数据由两部分构成，1是玩家进入房间时的个人数据，2时网络状态数据
            var userData = null; // 我自己游戏数据
            var seats = []; // 整个游戏玩家的数据（包含我自己）
            for (var i = 0; i < roomInfo.seats.length; ++i) {
                var rs = roomInfo.seats[i];
                var online = false;
                if (rs.userId > 0) {
                    online = userMgr.isOnline(rs.userId);
                }
                seats.push({
                    userId: rs.userId,
                    ip: rs.ip,
                    name: rs.name,
                    online: online,
                    ready: rs.ready,
                    seatIndex: i,
                    // 下面数据应该是 玩家进入房间时上报，但现在只设置默认值
                    currentGirdIndex: rs.currentGirdIndex, // 玩家当前的地图格子
                    chosedRole: i, // 玩家选择的角色
                    currentHp: 100, // 当前血量
                    currentMp: 100, // 当前蓝量
                    maxHp: 100, // 最大血量
                    maxMp: 100, // 最大蓝量
                });

                if (userId == rs.userId) {
                    userData = seats[i];
                }
            }
            // 构建前端返回数据
            var ret = {
                errcode: 0,
                errmsg: "ok",
                serverType: config.SERVER_TYPE,
                data: {
                    roomid: roomInfo.id,
                    numOfGames: roomInfo.numOfGames, //玩到第几局
                    creator: roomInfo.creator, // 房间创建者
                    gameType: roomInfo.gameType, // 游戏类型
                    subGameType: roomInfo.subGameType, // 子游戏类型
                    playerNum: roomInfo.playerNum, // 开始游戏的玩家数量
                    playRound: roomInfo.playRound, // 总共玩几盘
                    seats: seats, // 游戏内的玩家数据
                }
            };
            socket.emit('join_rpg_result', ret);
            //通知其它客户端
            userMgr.broacastInRoom('new_rpg_user_comes_push', userData, userId);
            //为本次连接设置游戏逻辑脚本
            socket.gameMgr = roomInfo.gameMgr;
            //玩家上线，直接设置为TRUE. 取消了玩家手动点准备的功能
            // socket.gameMgr.setReady(userId);

            // TODO 处理一进来就有发起解散房间的情况
            if (roomInfo.dr != null) {

            }
        });
        // 玩家准备
        socket.on('ready_rpg', function (data) {
            var userId = socket.userId;
            if (userId == null) {
                return;
            }
            socket.gameMgr.setReady(userId);
            userMgr.broacastInRoom('user_ready_rpg_push', { userId: userId, ready: true }, userId, true);
        });
        // 同步指令状态
        socket.on('syncRpgOBJAction', function (data) {
            data = JSON.parse(data);
            var userId = socket.userId;
            if (userId == null) {
                return;
            }
            var roomId = roomMgr.getUserRoom(userId);
            if (roomId == null) {
                console.log('没有房间信息，无法同步');
                return;
            }
            // var cmd = {
            //     action: 'walk',
            //     gridX: 0,
            //     gridY: 0,
            // }
            // var cmd = {
            //     action: 'walkByDir',
            //     dir: 0,
            // }
            // var cmd = {
            //     action: 'girdSet',
            //     gridX: 0,
            //     gridY: 0,
            // }
            if (data.action == 'walk' || data.action == 'walkByDir') {
                // console.log('syncOBJAction', data.action)
                data.userId = userId;
                userMgr.broacastInRoom('syncRpgOBJActionToOther', data, userId, false);
            }
        });


    });
}