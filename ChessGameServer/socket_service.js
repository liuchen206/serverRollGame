
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
                userid: userId,
                online: false
            };

            //通知房间内其它玩家，玩家掉线
            userMgr.broacastInRoom('user_state_push', data, userId);

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
                socket.emit('join_result', { errcode: 1, errmsg: "invalid parameters,on login" });
                return;
            }
            //检查参数是否被篡改
            var md5 = crypto.md5(roomId + token + time + config.ROOM_PRI_KEY);
            if (md5 != sign) {
                socket.emit('join_result', { errcode: 2, errmsg: "login failed. invalid sign!" });
                return;
            }
            //检查token是否有效
            if (tokenMgr.isTokenValid(token) == false) {
                socket.emit('join_result', { errcode: 3, errmsg: "token out of time." });
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
                    userid: rs.userId,
                    ip: rs.ip,
                    coin: rs.coin,
                    name: rs.name,
                    online: online,
                    ready: rs.ready,
                    seatindex: i,
                    chosedRole: -1,
                    currentChessGirdIndex: rs.currentChessGirdIndex,
                    isBankrupted: false,
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
            socket.emit('join_result', ret);
            //通知其它客户端
            userMgr.broacastInRoom('new_user_comes_push', userData, userId);
            //为本次连接设置游戏逻辑脚本
            socket.gameMgr = roomInfo.gameMgr;
            //玩家上线，直接设置为TRUE. 取消了玩家手动点准备的功能
            // socket.gameMgr.setReady(userId);

            // TODO 处理一进来就有发起解散房间的情况
            if (roomInfo.dr != null) {

            }
        });
        // 玩家准备
        socket.on('ready', function (data) {
            var userId = socket.userId;
            if (userId == null) {
                return;
            }
            socket.gameMgr.setReady(userId);
            userMgr.broacastInRoom('user_ready_push', { userid: userId, ready: true }, userId, true);
        });
        //解散房间，在游戏未开始阶段，房主可以通过此消息立即解散房间，不需要其他玩家同意
        socket.on('dispress', function (data) {
            var userId = socket.userId;
            if (userId == null) {
                console.log('找不到玩家，无法解散');
                socket.emit('dispress_result', { errcode: 1, errmsg: "找不到玩家，无法解散" });
                return;
            }

            var roomId = roomMgr.getUserRoom(userId);
            if (roomId == null) {
                console.log('找不到房间号，无法解散');
                return;
            }

            //如果游戏已经开始，则不可以
            if (socket.gameMgr.hasBegan(roomId)) {
                console.log('游戏已经开始，请使用 dissolve_request 请所有人投票解散房间');
                socket.emit('dispress_result', { errcode: 1, errmsg: "游戏已经开始，请使用 dissolve_request 请所有人投票解散房间" });
                return;
            }

            //如果不是房主，则不能解散房间
            if (roomMgr.isCreator(roomId, userId) == false) {
                console.log('不是房主，无法解散');
                socket.emit('dispress_result', { errcode: 1, errmsg: "不是房主，使用exit退出房间" });
                return;
            }

            userMgr.broacastInRoom('dispress_result', { errcode: 0, errmsg: "OK" }, userId, true);
            // 关闭整个房间的玩家连接
            userMgr.kickAllInRoom(roomId);
            // 清除房间内存
            roomMgr.destroy(roomId);
            socket.disconnect();
        });
        //退出房间
        socket.on('exit', function (data) {
            var userId = socket.userId;
            if (userId == null) {
                return;
            }
            var roomId = roomMgr.getUserRoom(userId);
            if (roomId == null) {
                socket.emit('exit_result', { errcode: 1, errmsg: "没有房间信息" });
                return;
            }
            //如果游戏已经开始，则不可以
            if (socket.gameMgr.hasBegan(roomId)) {
                socket.emit('exit_result', { errcode: 1, errmsg: "游戏已经开始" });
                return;
            }
            //如果是房主，则只能走解散房间
            if (roomMgr.isCreator(userId)) {
                socket.emit('exit_result', { errcode: 1, errmsg: "你是房主" });
                return;
            }
            //通知其它玩家，有人退出了房间
            userMgr.broacastInRoom('exit_notify_push', userId, userId, false);

            //清除个人在房间内的信息
            roomMgr.exitRoom(userId);
            //清除个人的长连接信息
            userMgr.del(userId);

            socket.emit('exit_result', { errcode: 0, errmsg: "OK" });
            socket.disconnect();
        });
        // 发起解散房间
        socket.on('dissolve_request', function (data) {
            var userId = socket.userId;
            if (userId == null) {
                return;
            }
            socket.gameMgr.closeGame(userId);
        });

        /**
         * 游戏内消息
         */
        // 选择游戏角色
        socket.on('chosingRole', function (data) {
            if (socket.userId == null) {
                return;
            }
            var roleid = data;
            socket.gameMgr.choseRole(socket.userId, roleid);
        });
        // 同步指令状态
        socket.on('syncOBJAction', function (data) {
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
            if (data.action == 'walk') {
                // console.log('syncOBJAction', data.action)
                data.userId = userId;
                userMgr.broacastInRoom('syncOBJActionToOther', data, userId, false);
            }
        });
        // 玩家抵达消息
        socket.on('arriveDestination', function (data) {
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
            // var data = {
            //     userId: uid,
            // }
            // console.log('arriveDestination', userId, data.userId)
            socket.gameMgr.arriveDestination(socket.userId);
        });
        // 玩家购得土地
        socket.on('playerBuyGround', function (data) {
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
            // var data = {
            //     userId: uid, // 谁买
            //     buildingId: 1, // 买了什么样的
            //     belongToChessGird: 0,// 买在哪个棋盘格子上
            // }
            // console.log('playerBuyGround', data.belongToChessGird, data.userId)
            socket.gameMgr.playerBuyGround(data.userId, data.buildingId, data.belongToChessGird);
        });
        // 玩家金币转移
        socket.on('coinsTransfer', function (data) {
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
            // from: from,
            // to: to,
            // coisValue: coisValue,
            // console.log('coinsTransfer', data.coisValue)
            socket.gameMgr.coinsTransfer(data.from, data.to, data.coisValue);
        });
        // 锁定回合
        socket.on('lockDown', function (data) {
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
            // who: gameSettingIns.uid, 锁定谁
            // lockTimes: 2, 锁定几个回合
            console.log('lockDown', data.lockTimes)
            socket.gameMgr.lockDown(data.who, data.lockTimes);
        });

    });
};