var roomMgr = require("./roommgr");
var userMgr = require("./usermgr");
var db = require("../utils/db");
var crypto = require("../utils/crypto");
var games = {}; // 所有对局游戏信息
var gameSeatsOfUsers = {};// 快速定位游戏内玩家

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
        console.log("有几个人准备好了 ", bingoCounter, "需要几人 ", roomInfo.playerNum);
        if (bingoCounter == roomInfo.playerNum) {
            exports.begin(roomId);
        } else {
            console.log('人数不满足开始游戏的条件');
        }
    } else {
        // 游戏已经存在,同步当前的游戏状态
        // 1，角色选择阶段
        // 2，游戏进行中阶段

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
        nextOperator: roomInfo.nextOperator, // 下局起手玩家
        gameSeats: [], // 玩家在游戏中的信息
        currentOperator: 0, // 当前在操作的玩家

        alreadyChosedRoleCounter: 0,//已经选择角色的玩家数量
    };
    roomInfo.numOfGames++; // 游戏进行了几句
    // 构建玩家游戏数据
    for (var i = 0; i < roomInfo.playerNum; ++i) {
        var data = {}; // 初始化一个座位上的玩家信息
        game.gameSeats.push(data);
        data.game = game;
        data.seatIndex = i;
        data.userId = seats[i].userId;
        data.coin = seats[i].coin;
        data.currentChessGirdIndex = seats[i].currentChessGirdIndex; // 棋盘上的位置
        data.chosedRole = -1; // 选择的角色--- 这是创建房间时没有的变量，创建游戏时新加入的
        data.occupyGround = [];// 玩家在游戏过程中购得的土地

        // 为了快速定位游戏内玩家,这样在存下
        gameSeatsOfUsers[data.userId] = data;
        // 同步下在进入房间时尚未初始化的参数--棋盘位置
        userMgr.broacastInRoom('game_update_chessIndex_push', { userId: data.userId, currentChessGirdIndex: data.currentChessGirdIndex }, roomInfo.creator, true);
    }
    // 保存游戏对局数据
    games[roomId] = game;


    // 广播通知,进行角色选择阶段
    game.state = "chosingRole";
    userMgr.broacastInRoom('game_chosingRole_push', { errcode: 0, errmsg: "DoIt" }, roomInfo.creator, true);
}
/**
 * 游戏是否开始
 */
exports.hasBegan = function (roomId) {
    // 有记录则表示正在对局，显然已经开始
    var game = games[roomId];
    if (game != null) {
        return true;
    }
    // 没记录则查看已经对局的局数
    var roomInfo = roomMgr.getRoom(roomId);
    if (roomInfo != null) {
        return roomInfo.numOfGames > 0;
    }
    return false;
};
//检查角色选择进度
exports.isChoosingEnd = function (game) {
    var playerNum = game.roomInfo.playerNum; // 玩家人数
    console.log('玩家选角色，总玩家数==', playerNum, '当前已经选择', game.alreadyChosedRoleCounter);
    if (game.alreadyChosedRoleCounter == playerNum) { // 流程结束
        return true;
    }
    return false;
}
// 玩家选择一个角色
exports.choseRole = function (userId, roleid) {
    var seatData = gameSeatsOfUsers[userId];
    if (seatData == null) {
        console.log("玩家游戏数据没找到，选不了角色.");
        return;
    }
    // 游戏状态检查
    var game = seatData.game;
    if (game.state != "chosingRole") {
        console.log("游戏状态在chosingRole时才能选角色，而不是 game.state == " + game.state);
        return;
    }
    // 角色索引赋值
    if (seatData.chosedRole < 0) {
        seatData.chosedRole = roleid;
        game.alreadyChosedRoleCounter++;
    } else {
        console.log("角色已经选定");
        return;
    }
    userMgr.broacastInRoom('game_chosingRole_notify_push', { userId: seatData.userId, roleIndex: roleid }, seatData.userId, true);

    if (exports.isChoosingEnd(game) == true) {
        // 通知选择角色阶段结束
        userMgr.broacastInRoom('game_chosingRole_finish_push', { errcode: 0, errmsg: "DoIt" }, seatData.userId, true);
        // 通知游戏循环开始
        game.state = "playing";
        userMgr.broacastInRoom('game_round_playing_push', { errcode: 0, errmsg: "DoIt" }, seatData.userId, true);
        // 通知第一个玩家操作
        exports.playerTakeHander(game);
    }
}
// 玩家选择一个角色
exports.arriveDestination = function (userId) {
    var seatData = gameSeatsOfUsers[userId];
    if (seatData == null) {
        console.log("玩家游戏数据没找到，选不了角色.");
        return;
    }
    // 游戏状态检查
    var game = seatData.game;
    if (game.state != "playing") {
        console.log("游戏状态在playing才会产生玩家移动，而不是 game.state == " + game.state);
        return;
    }
    // 验证操作对象
    var currentOperator = game.currentOperator;
    var currentOprUser = game.gameSeats[currentOperator].userId;
    if (currentOprUser == userId) {
        // 如果的确是我操作，则直接让下一个玩家操作
        exports.moveToNextPlayer(game);
    } else {
        console.log('现在不是轮到该玩家操作');
        return;
    }
}
// 将操作权移交到下一玩家
exports.moveToNextPlayer = function (game) {
    var currentOperator = game.currentOperator;
    var playerNum = game.roomInfo.playerNum;
    var nextOpr = (currentOperator + 1) % playerNum;
    game.currentOperator = nextOpr;
    exports.playerTakeHander(game);
}
// 让当前有操作权的玩家执行操作
exports.playerTakeHander = function (game) {
    var userData = game.gameSeats[game.currentOperator];
    if (!userData) {
        console.log('没有找到游戏座位信息', game.currentOperator)
        return;
    }
    // console.log('座位接管操作', game.currentOperator)
    var uid = userData.userId;
    userMgr.broacastInRoom('game_player_take_heander_push', { userId: uid }, uid, true);
}
// 玩家购得土地
exports.playerBuyGround = function (whoBuy, buyWhat, buyWhere) {
    var seatData = gameSeatsOfUsers[whoBuy];
    if (seatData == null) {
        console.log("玩家游戏数据没找到，买不了.");
        return;
    }
    // 游戏状态检查
    var game = seatData.game;
    if (game.state != "playing") {
        console.log("游戏状态在playing才会产生买土地，而不是 game.state == " + game.state);
        return;
    }
    // 更新玩家占有土地信息
    var buildingStruct = { userId: whoBuy, buildingId: buyWhat, belongToChessGird: buyWhere };
    seatData.occupyGround.push(buildingStruct);
    // 通知所有人
    userMgr.broacastInRoom('game_player_buy_ground_push', buildingStruct, whoBuy, true);
}
// 
exports.coinsTransfer = function (from, to, howMuch) {
    var seatDataFrom = gameSeatsOfUsers[from];
    if (seatDataFrom == null) {
        console.log("玩家游戏数据没找到，from.");
        return;
    }
    var seatDataTo = gameSeatsOfUsers[to];
    if (seatDataTo == null) {
        console.log("玩家游戏数据没找到，to.");
        return;
    }
    seatDataFrom.coin -= howMuch;
    seatDataTo.coin += howMuch;
    var transData = {
        transList: [{
            userId: from,
            coinVale: howMuch * -1,
        },
        {
            userId: to,
            coinVale: howMuch,
        }],
    }
    userMgr.broacastInRoom('game_player_coins_change_push', transData, from, true);
}