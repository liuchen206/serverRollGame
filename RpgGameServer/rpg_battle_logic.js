var roomMgr = require("./roommgr");
var userMgr = require("./usermgr");
var db = require("../utils/db");
var crypto = require("../utils/crypto");
var games = {}; // 所有对局游戏信息
var gameSeatsOfUsers = {};// 快速定位游戏内玩家


// 关闭游戏
exports.closeGame = function (userId, delayTime) {
    if (!delayTime) delayTime = 100;
    var roomId = roomMgr.getUserRoom(userId);
    if (roomId == null) {
        console.log("玩家房间ID没找到");
        return;
    }
    var roomInfo = roomMgr.getRoom(roomId);
    if (roomInfo == null) {
        console.log("玩家房间数据没找到");
        return;
    }
    if (games[roomId]) {
        // console.log('删除房间', roomId, '玩家总数', roomInfo.seats.length)
        var game = games[roomId];
        for (var i = 0; i < roomInfo.seats.length; ++i) {
            var sd = game.gameSeats[i];
            if (sd) {// roommgr 是通过玩家数量构建的数据，可能存在玩家没有完全加入的情况（也就是数据有空的）
                // console.log('删除座上玩家', sd.userId)
                delete gameSeatsOfUsers[sd.userId];
            }
        }
        delete games[roomId];
    }
    setTimeout(function () {
        userMgr.kickAllInRoom(roomId);
        roomMgr.destroy(roomId);
    }, delayTime);
}
// 准备完成
exports.setReady = function (userId, callback) {
    // 玩家有没有房间
    var roomId = roomMgr.getUserRoom(userId);
    if (roomId == null) {
        return;
    }
    // 房间是不是有效
    var roomInfo = roomMgr.getRoom(roomId);
    if (roomInfo == null) {
        return;
    }
    // 对房间中我的位置信息更新我的准备状态
    roomMgr.setReady(userId, true);
    // 派发驱动指示
    var game = games[roomId];
    if (!game) {
        console.log('玩家都已经准备了，却没有游戏数据')
        return;
    }
    exports.setDriveClient(roomId);
    userMgr.sendMsg(userId, 'driveClientSet', { userId: game.driveClientId });
};
// 设置驱动客户端
exports.setDriveClient = function (roomId) {
    var game = games[roomId];
    if (!game) {
        console.log('没有找到游戏，无法设置驱动客户端')
        return false;
    }
    // 已经设置完毕且正常在线，不需要重复设置
    if (game.driveClientId > 0) {
        if (userMgr.isOnline(game.driveClientId) == true) {
            return true;
        }
    }
    // 选择一个在线的客户端座位驱动
    for (var index = 0; index < game.gameSeats.length; index++) {
        var seatData = game.gameSeats[index];
        if (userMgr.isOnline(seatData.userId) == true) {
            game.driveClientId = seatData.userId;
            userMgr.broacastInRoom('driveClientSet', { userId: game.driveClientId }, game.driveClientId, true);
            return true;
        }
    }
    game.driveClientId = 0;
    return false;
}
// 添加玩家
exports.addPlayerInGame = function (userId, userData) {
    // 玩家有没有房间
    var roomId = roomMgr.getUserRoom(userId);
    if (roomId == null) {
        return;
    }
    // 房间是不是有效
    var roomInfo = roomMgr.getRoom(roomId);
    if (roomInfo == null) {
        return;
    }
    // 更新相关逻辑
    var game = games[roomId];
    if (!game) { // 如果没有创建及时创建一个游戏
        exports.makeGame(roomId);
        game = games[roomId];
    }
    // 构建玩家游戏数据
    console.log('添加玩家', userData.userId, '到游戏座位', userData.seatIndex, '房间', roomId)
    var data = game.gameSeats[userData.seatIndex] = userData;
    data.game = game;
    // 为了快速定位游戏内玩家,这样在存下
    gameSeatsOfUsers[data.userId] = data;
}
// 玩家数据更新
exports.playerDataUpdate = function (userId, data, callback) {
    // 玩家有没有房间
    var roomId = roomMgr.getUserRoom(userId);
    if (roomId == null) {
        return;
    }
    // 房间是不是有效
    var roomInfo = roomMgr.getRoom(roomId);
    if (roomInfo == null) {
        return;
    }
    // 更新相关逻辑
    var game = games[roomId];
    if (game == null) {// 游戏未创建
        console.log('没有游戏没有进行')
    } else {
        var userData = gameSeatsOfUsers[userId];
        console.log('更新玩家', userData.userId, '到位置', data.gridX, data.gridY)
        if (data.action == 'girdXYSync') { // 请求立即同步
            userData.girdX = data.gridX;
            userData.girdY = data.gridY;

            // 玩家准备完毕之后，向玩家推送玩家游戏状态
            var ret = [];
            for (var index = 0; index < game.gameSeats.length; index++) {
                var seatData = game.gameSeats[index];
                ret.push({
                    userId: seatData.userId,
                    girdX: seatData.girdX,
                    girdY: seatData.girdY,
                })
            }
            userMgr.sendMsg(userId, 'syncRpgPlayers', ret);
        }
        if (data.action == 'walk') { // 寻路移动
            userData.girdX = data.gridX;
            userData.girdY = data.gridY;
        }
    }
};
//开始新的一局
exports.makeGame = function (roomId) {
    var roomInfo = roomMgr.getRoom(roomId);
    if (roomInfo == null) {
        return;
    }
    // 游戏运行环境
    var game = {
        state: "idle", // 游戏进行状态
        roomInfo: roomInfo, // 房间信息
        gameSeats: [], // 玩家在游戏中的信息
        driveClientId: 0,

    };
    // 保存游戏对局数据
    games[roomId] = game;

    // 通知游戏循环开始
    game.state = "playing";
};
