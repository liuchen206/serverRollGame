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
        var game = games[roomId];
        for (var i = 0; i < roomInfo.seats.length; ++i) {
            var sd = game.gameSeats[i];
            delete gameSeatsOfUsers[sd.userId];
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

    // 游戏相关逻辑
    var game = games[roomId];
    if (game == null) {// 游戏未创建
        // 检查准备情况
        var bingoCounter = 0;
        for (var i = 0; i < roomInfo.seats.length; ++i) {
            var s = roomInfo.seats[i];
            if (s.ready == true && userMgr.isOnline(s.userId) == true) {
                // 准备好了并且在线的视为等待开始游戏了
                bingoCounter++;
            }
        }
        //人到齐了，并且都准备好了，则开始新的一局
        console.log("rpg 有几个人准备好了 ", bingoCounter, "需要几人 ", roomInfo.playerNum);
        if (bingoCounter == roomInfo.playerNum) {
            exports.begin(roomId);
        } else {
            console.log('人数不满足开始游戏的条件');
        }
    } else {

    }
};
//开始新的一局
exports.begin = function (roomId) {
    var roomInfo = roomMgr.getRoom(roomId);
    if (roomInfo == null) {
        return;
    }
    var seats = roomInfo.seats;
    // 游戏运行环境
    var game = {
        state: "idle", // 游戏进行状态
        roomInfo: roomInfo, // 房间信息
        gameSeats: [], // 玩家在游戏中的信息

    };
    roomInfo.numOfGames++; // 游戏进行了几局
    // 构建玩家游戏数据
    for (var i = 0; i < roomInfo.playerNum; ++i) {
        console.log('构建游戏玩家数据', i, seats[i].userId)
        var data = game.gameSeats[i] = {}; // 初始化一个座位上的玩家信息
        // game.gameSeats.push(data);
        data.game = game;
        data.seatIndex = i;
        data.userId = seats[i].userId;
        data.currentGirdIndex = seats[i].currentGirdIndex; // 棋盘上的位置
        data.chosedRole = i; // 选择的角色--- 这是创建房间时没有的变量，创建游戏时新加入的
        data.currentHp = 100;
        data.currentMp = 100;
        data.maxHp = 100;
        data.maxMp = 100;
        // 为了快速定位游戏内玩家,这样在存下
        gameSeatsOfUsers[data.userId] = data;
    }
    // 保存游戏对局数据
    games[roomId] = game;

    // 通知游戏循环开始
    game.state = "playing";
    userMgr.broacastInRoom('game_rpg_round_playing_push', { errcode: 0, errmsg: "DoIt" }, roomInfo.creator, true);
};
