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
        console.log('游戏已经存在，同步游戏信息')
        // 游戏已经存在,同步当前的游戏状态
        var struct = {
            state: game.state,
            currentOperator: game.gameSeats[game.currentOperator].userId,
            roomid: roomId,
            numOfGames: roomInfo.numOfGames,
            creator: roomInfo.creator,
            gameType: roomInfo.gameType,
            subGameType: roomInfo.subGameType,
            playerNum: roomInfo.playerNum,
            playRound: roomInfo.playRound,
        };
        struct.seats = [];
        for (var i = 0; i < game.gameSeats.length; ++i) {
            var seatData = game.gameSeats[i];

            var syncChessGird = 0;
            // 这是新增的判断，是为了处理。玩家已经开始走了。但是退出游戏，在回来。恢复玩家应该让他回退到刚刚丢筛子的位置重丢，而不是在已经走到的位置再丢
            if (seatData.playerStatus == 'moving') {
                // 正在移动中断线
                syncChessGird = seatData.moveStartChessGirdIndex;
            } else {
                syncChessGird = seatData.currentChessGirdIndex;
            }
            var sendingData = {
                userId: seatData.userId,
                ip: roomInfo.seats[i].ip,
                coin: seatData.coin,
                name: roomInfo.seats[i].name,
                online: userMgr.isOnline(seatData.userId),
                ready: roomInfo.seats[i].ready,
                seatIndex: seatData.seatIndex,
                chosedRole: seatData.chosedRole,
                currentChessGirdIndex: syncChessGird, // 恢复现场时，是恢复到没走完之前的位置
                occupyGround: seatData.occupyGround,
                isBankrupted: seatData.isBankrupted,
                lockDown: seatData.lockDown,
            };
            struct.seats.push(sendingData);
        }
        // userMgr.sendMsg(userId, 'game_sync_push', struct); // 单人恢复游戏
        userMgr.broacastInRoom('game_sync_push', struct, userId, true); // 游戏中所有人一起恢复
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
        currentOperator: 0, // 当前在操作的玩家座位号

        alreadyChosedRoleCounter: 0,//已经选择角色的玩家数量
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
        data.coin = seats[i].coin;
        data.currentChessGirdIndex = seats[i].currentChessGirdIndex; // 棋盘上的位置
        data.chosedRole = -1; // 选择的角色--- 这是创建房间时没有的变量，创建游戏时新加入的
        data.occupyGround = [];// 玩家在游戏过程中购得的土地
        data.isBankrupted = false; // 是否破产了
        data.lockDown = 0; // 锁定操作轮数剩余
        data.playerStatus = 'stay';//这个字段暂时没有逻辑意义，只为了让人明白点在干啥，玩家角色状态 TODO 在玩家正在走时，还没到目的地。会产生终点状态 'moving'
        data.moveStartChessGirdIndex = 0; // 玩家移动是的启动位置
        // 为了快速定位游戏内玩家,这样在存下
        gameSeatsOfUsers[data.userId] = data;
    }
    console.log('game 中游戏对象 0', game.gameSeats[0].userId)
    console.log('game 中游戏对象 1', game.gameSeats[1].userId)
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
// 玩家发起移动
exports.moveTo = function (who, toWhere) {
    var seatData = gameSeatsOfUsers[who];
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
    var seatData = gameSeatsOfUsers[who];
    if (seatData == null) {
        console.log("玩家游戏数据没找到.");
        return;
    }
    seatData.moveStartChessGirdIndex = seatData.currentChessGirdIndex;
    seatData.currentChessGirdIndex = toWhere;
    seatData.playerStatus = 'moving';
}
// 玩家抵达目的地
exports.arriveDestination = function (userId) {
    var seatData = gameSeatsOfUsers[userId];
    if (seatData == null) {
        console.log("玩家游戏数据没找到，选不了角色.");
        return;
    }
    seatData.moveStartChessGirdIndex = seatData.currentChessGirdIndex;
    seatData.playerStatus = 'stay';
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
        // 如果的确是我操作的，则直接让下一个玩家操作
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
    // 破产玩家无法再操作。
    var limit = 0; // 放置数据出错。堆栈崩溃
    while (game.gameSeats[nextOpr].isBankrupted == true) {
        nextOpr = (nextOpr + 1) % playerNum;
        limit++;
        if (limit > playerNum) return;
    }
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
    userMgr.broacastInRoom('game_player_take_heander_push', { userId: uid, lockDown: userData.lockDown }, uid, true);
    if (userData.lockDown > 0) {
        userData.lockDown -= 1; // 所以这个值可最小为0，客户端只判断锁定轮数是否大于零即可
    }
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
    var buildCost = 1000; // 购买费用（这里不论买什么建筑都花费1000）
    if (seatData.coin > buildCost) {
        seatData.coin -= buildCost;
        var buildingStruct = { result: 'ok', userId: whoBuy, buildingId: buyWhat, belongToChessGird: buyWhere, buildCost: buildCost };
        seatData.occupyGround.push(buildingStruct);
        // 通知所有人
        userMgr.broacastInRoom('game_player_buy_ground_push', buildingStruct, whoBuy, true);
    } else {
        var buildingStruct = { result: 'noOk', userId: whoBuy, buildingId: buyWhat, belongToChessGird: buyWhere, buildCost: buildCost };
        userMgr.broacastInRoom('game_player_buy_ground_push', buildingStruct, whoBuy, true);
    }

}
// 玩家金币从一个玩家转移到另一个玩家
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
    if (seatDataFrom.coin <= 0) {
        seatDataFrom.isBankrupted = true;
        var winner = exports.winnerCheck(seatDataFrom.game);
        if (winner > 0) {
            // 游戏即将结束
        } else {
            // 游戏还需继续，通知游戏中产出破产玩家
            userMgr.broacastInRoom('game_player_bankrupted_push', seatDataFrom.userId, from, true);
        }
    }
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
// 胜利检测
exports.winnerCheck = function (game) {
    var seats = game.gameSeats;
    if (!seats) {
        console.log('winnerCheck 时没有找到游戏座位信息')
        return;
    }
    var winner = 0;
    for (var index = 0; index < seats.length; index++) {
        var seatData = seats[index];
        if (seatData.isBankrupted == false) {
            // console.log('winnerCheck ', index, winner, seatData.userId)
            if (winner == 0) {
                winner = seatData.userId;
            } else {
                // 尚未破产的不是唯一，游戏未产生胜利者
                return 0;
            }
        }
    }
    if (winner == 0) return 0; // 这种情况发生在所有人都破产了。
    console.log('winnerCheck 胜利者产生', winner)
    userMgr.broacastInRoom('game_winner_come_push', winner, winner, true);
    exports.closeGame(winner, 5500);
    return winner;
}
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
// 禁止玩家操作
exports.lockDown = function (who, lockTimes) {
    var roomId = roomMgr.getUserRoom(who);
    if (roomId == null) {
        console.log("玩家房间ID没找到");
        return;
    }
    var roomInfo = roomMgr.getRoom(roomId);
    if (roomInfo == null) {
        console.log("玩家房间数据没找到");
        return;
    }
    var seatData = gameSeatsOfUsers[who];
    if (seatData == null) {
        console.log("玩家游戏数据没找到");
        return;
    }
    console.log('锁定轮数', lockTimes)
    seatData.lockDown = lockTimes;
}