var roomMgr = require("./roommgr");
var userMgr = require("./usermgr");
var db = require("../utils/db");
var crypto = require("../utils/crypto");
var games = {}; // 所有对局游戏信息
var gameSeatsOfUsers = {};// 快速定位游戏内玩家
var gameMonstersMap = {};// 快速定位游戏内副本内的怪物


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
    // 没进入一个玩家尝试设置一次驱动并通知结果给进来的玩家
    var result = exports.isDriveClientRunning(roomId);
    if (result == true) {
        userMgr.sendMsg(userId, 'driveClientSet', { userId: game.driveClientId });
    } else {
        exports.setDriveClient(roomId);
    }
    // 给刚进来的玩家通知怪物信息
    userMgr.sendMsg(userId, 'monsterSync', game.gameMonsters);
    exports.syncRpgPlayers(userId, game);
};
// 设法已经设置了客户端驱动
exports.isDriveClientRunning = function (roomId) {
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
    return false;
}
// 设置驱动客户端
exports.setDriveClient = function (roomId) {
    var re = exports.isDriveClientRunning(roomId);
    if (re == true) {
        console.log('无需设置')
        return;
    }
    var game = games[roomId];
    if (!game) {
        console.log('没有找到游戏，无法设置驱动客户端')
        return false;
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
// 是否是驱动客户端
exports.isDriveClient = function (userId) {
    // 玩家有没有房间
    var roomId = roomMgr.getUserRoom(userId);
    if (roomId == null) {
        return false;
    }
    var game = games[roomId];
    if (game) {
        // 确认是选中的驱动
        if (userId == game.driveClientId) {
            return true;
        } else {
            return false;
        }
    } else {
        return false;
    }
}
// 怪物数据更新
exports.monsterDataUpdate = function (userId, data) {
    // 玩家有没有房间
    var roomId = roomMgr.getUserRoom(userId);
    if (roomId == null) {
        return false;
    }
    var game = games[roomId];
    if (game) {
        // 确认是选中的驱动
        if (exports.isDriveClient(data.userId)) {
            if (data.action == 'monsterDamageCause') {
                // 找到对应怪物数据
                console.log('怪物扣血，向 怪物', data.toId, '从玩家 ', data.fromId, '伤害：', data.damage);
                var monData = gameMonstersMap[data.toId];
                if (monData) {
                    monData.currentHp -= data.damage;

                    // 是否已经记录过仇恨
                    var isAdded = false;
                    for (var index = 0; index < monData.hateList.length; index++) {
                        var oneHate = monData.hateList[index];
                        // {
                        //     userId:xxx,
                        //     hate:xxx,
                        // }
                        console.log('遍历总览', oneHate.userId)
                        if (oneHate.userId == data.fromId) {
                            console.log('叠加仇恨值', oneHate.userId, data.fromId)
                            oneHate.hate += data.damage;
                            isAdded = true;
                            break;
                        }
                    }
                    if (isAdded == false) {
                        console.log('添加新仇恨值', data.fromId)
                        monData.hateList.push({
                            userId: data.fromId,
                            hate: data.damage,
                        })
                    }
                    var ret = {
                        monsterId: monData.id,
                        newHateList: monData.hateList,
                    }
                    userMgr.broacastInRoom('syncMonsterHateList', ret, userId, true);

                }
            }
            if (data.action == 'monsterDead') {
                console.log('怪物死亡：', data.monsterId);
                var monData = gameMonstersMap[data.monsterId];
                if (monData) {
                    delete gameMonstersMap[data.monsterId];
                    for (var i = 0; i < game.gameMonsters.length; i++) {
                        var monData = game.gameMonsters[i];
                        if (monData.id == data.monsterId) {
                            game.gameMonsters.splice(i, 1);
                            return true;
                        }
                    }
                }
            }
            return true;
        } else {
            // console.log('不是选中的驱动客户端的请求,丢弃')
            return false;
        }
    } else {
        console.log('无法添加怪物，没有找到游戏')
        return false;
    }
}
// 怪物寻路移动
exports.monsterWalk = function (userId, data) {
    // 玩家有没有房间
    var roomId = roomMgr.getUserRoom(userId);
    if (roomId == null) {
        return false;
    }
    var game = games[roomId];
    if (game) {
        // 确认是选中的驱动
        if (exports.isDriveClient(data.userId)) {
            // 找到对应怪物数据
            // console.log('怪物移动', data.monsterId, 'to', data.girdX, data.girdY);
            // var monData = gameMonstersMap[data.monsterId];
            // monData.girdX = data.girdX;
            // monData.girdY = data.girdY;
            return true;
        } else {
            // console.log('不是选中的驱动客户端的请求,丢弃')
            return false;
        }
    } else {
        console.log('无法添加怪物，没有找到游戏')
        return false;
    }
}
// 驱动客户端创建怪物
exports.createMonster = function (data) {
    // 玩家有没有房间
    var roomId = roomMgr.getUserRoom(data.driveId);
    if (roomId == null) {
        return false;
    }
    var game = games[roomId];
    if (game) {
        // console.log('服务器设置的驱动', game.driveClientId, '传送逻辑的玩家', data.driveId)
        if (game.driveClientId == data.driveId) {
            var monData = gameMonstersMap[data.id];
            if (monData) {
                monData = data;
            } else {
                game.gameMonsters.push(data);
                gameMonstersMap[data.id] = data;
            }
            // console.log('添加怪物', data.id)
        } else {
            // console.log('该玩家不是服务器选中的驱动客户端')
            return false;
        }
    } else {
        console.log('无法添加怪物，没有找到游戏')
        return false;
    }
    return true;
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
// 怪物击杀奖励
exports.monsterReward = function (userId, rewardList) {
    // 玩家有没有房间
    var roomId = roomMgr.getUserRoom(userId);
    if (roomId == null) {
        return false;
    }
    // 房间是不是有效
    var roomInfo = roomMgr.getRoom(roomId);
    if (roomInfo == null) {
        return false;
    }
    if (exports.isDriveClient(userId) == false) {
        return false;
    }
    console.log('1111');
    // 更新相关逻辑
    var game = games[roomId];
    if (game == null) {// 游戏未创建
        return false;
    } else {
        console.log('3333', rewardList.length);
        for (var i = 0; i < rewardList.length; i++) {
            var oneReward = rewardList[i];
            console.log('222');
            // 需要靠roll点决定归属的奖励
            if (oneReward.dropType == '装备') {
                console.log('roll奖励', oneReward.dropItemName)
                exports.addReward(roomId, userId, oneReward);
            }
        }
    }
    return true;
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
        console.log('没有游戏进行')
        return false;
    } else {
        var userData = gameSeatsOfUsers[userId];
        // console.log('更新玩家', userData.userId, data.action, JSON.stringify(data))
        if (data.action == 'girdXYSync') { // 请求立即同步
            userData.girdX = data.girdX;
            userData.girdY = data.girdY;
            exports.syncRpgPlayers(userId, game);
        }
        if (data.action == 'walk') { // 寻路移动
            userData.girdX = data.girdX;
            userData.girdY = data.girdY;
        }
        if (data.action == 'playerPropertySync') {
            console.log('同步属性', userId, data.phyDamage)
            userData.maxHp = data.maxHp;
            userData.maxMp = data.maxMp;
            userData.phyDamage = data.phyDamage;
            userData.magicDamage = data.magicDamage;
            userData.phyResis = data.phyResis;
            userData.magicResis = data.magicResis;
            userData.atkSpeed = data.atkSpeed;
            userData.critRate = data.critRate;
            userData.critDamage = data.critDamage;
            userData.atkRange = data.atkRange;
            userData.walkSpeed = data.walkSpeed;
            exports.syncRpgPlayers(userId, game);
        }
        if (data.action == 'playerBuffSync') { // buff 同步
            for (var i = 0; i < userData.buffs.length; i++) {
                if (userData.buffs[i].buffType == data.buffType) {
                    userData.buffs[i] = data; // 已经有这个buff就直接替换作为更新
                    return true;
                }
            }
            userData.buffs.push(data); // 没有就直接添加
        }
        if (data.action == 'playerDamageCause') {
            userData.currentHp -= data.damage;
            console.log('玩家掉血', userId, data.damage, userData.currentHp)
        }
        if (data.action == 'playerExpsUpdate') {
            // 个人经验等级数据保存在玩家信息之中
            console.log('更新玩家经验值', data.userId, data.newExps);
            db.set_player_exps(data.userId, data.newExps, function (data) {
                if (data == true) {
                    console.log('经验值更新完毕')
                }
            })
        }
        if (data.action == 'playerLevelUpdate') {
            db.set_player_level(data.userId, data.newLevel, function (data) {
                if (data == true) {
                    console.log('等级更新完毕')
                }
            })
        }
        if (data.action == 'playerHpRecover') {
            userData.currentHp = data.hpTo;
            console.log('生命值恢复到', userData.currentHp, userId)
            exports.syncRpgPlayers(userId, game);
        }
        if (data.action == 'playerMpRecover') {
            userData.currentMp = data.mpTo;
            console.log('魔法值恢复到', userData.currentMp, userId)
            exports.syncRpgPlayers(userId, game);
        }
        return true;
    }
};
// 向玩家同步玩家信息
exports.syncRpgPlayers = function (userId, game) {
    // 玩家准备完毕之后，向玩家推送玩家游戏状态
    var ret = [];
    for (var index = 0; index < game.gameSeats.length; index++) {
        var seatData = game.gameSeats[index];
        ret.push({
            userId: seatData.userId,
            girdX: seatData.girdX,
            girdY: seatData.girdY,
            currentHp: seatData.currentHp,
            currentMp: seatData.currentMp,
            maxHp: seatData.maxHp,
            maxMp: seatData.maxMp,
            phyDamage: seatData.phyDamage,
            magicDamage: seatData.magicDamage,
            phyResis: seatData.phyResis,
            magicResis: seatData.magicResis,
            atkSpeed: seatData.atkSpeed,
            critRate: seatData.critRate,
            critDamage: seatData.critDamage,
            atkRange: seatData.atkRange,
            walkSpeed: seatData.walkSpeed,
        })
    }
    /**
     * bug: 当有玩家同步自己的 游戏数据时，要同步给所有人，这其中自然包括了驱动客户端的玩家
     */
    userMgr.broacastInRoom('syncRpgPlayers', ret, userId, true); // 向请求同步的玩家同步其他玩家的信息
    // userMgr.sendMsg(userId, 'syncRpgPlayers', ret); // 向请求同步的玩家同步其他玩家的信息
}
// 玩家物品更新
exports.playerItemUpdate = function (userId, itemData, callback) {
    callback = callback == null ? nop : callback;

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
    // 玩家数据
    db.get_user_bag_items(userId, function (data) {
        if (data == null) { // 没有物品信息
            callback(null);
            return;
        }
        if (data.itemInBag.length > 0) {
            console.log('查询', userId, '背包信息：', data.itemInBag, '---', JSON.parse(data.itemInBag)[0]['所处位置']);
        }
        var items = data.itemInBag;
        if (items.length == 0) {
            items = [];
        } else {
            items = JSON.parse(data.itemInBag)
        }
        var isAlreadyHas = false;
        for (var i = 0; i < items.length; i++) {
            var alreadyHasItem = items[i];
            if (itemData['物品id'] == alreadyHasItem['物品id']) {
                console.log('更新物品', itemData['物品名字'], itemData['所处位置'])
                isAlreadyHas = true;
                items[i] = itemData;
                break;
            }
        }
        if (isAlreadyHas == true) {

        } else {
            items.push(itemData);
        }
        db.update_user_bag_items(userId, JSON.stringify(items), function (data) {
            if (data) {
                console.log('背包更新成功')
                callback(items);
            }
        })
    });
}
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
        gameMonsters: [], // 副本中的怪物信息
        driveClientId: 0, // 服务器选中的驱动客户端

    };
    // 保存游戏对局数据
    games[roomId] = game;

    // 通知游戏循环开始
    game.state = "playing";
};

/**
 * 游戏房间奖励获取分配系列操作 start
 */
var rewardDecideList = []; // 具有未分配奖励的副本房间
// 添加一个待分配的奖励
exports.addReward = function (roomId, userId, rewardItemData) {
    console.log('奖励获取分配 新增奖励');
    var roomInfo = roomMgr.getRoom(roomId);
    if (roomInfo == null) {
        return null;
    }
    var seatIndex = roomMgr.getUserSeat(userId);
    if (seatIndex == null) {
        console.log('请求失败，玩家不在座位上');
        return null;
    }
    if (roomInfo.rewardDecide == null) {
        roomInfo.rewardDecide = [];
    }
    //  添加待分配的奖励. 默认认为最多5个人同时在房间副本
    var states = []; // 玩家是否已经决定
    var randomNum = []; // 玩家roll点结果
    var onlineList = roomMgr.getOnlineUserList(roomId);
    console.log('副本房间在线人数', onlineList.length);
    if (onlineList.length > 0) {
        for (var i = 0; i < onlineList.length; i++) {
            states.push(false);
            randomNum.push(-1);
        }
    }
    roomInfo.rewardDecide.push({
        endTime: Date.now() + 10000,
        onlineList: onlineList, // 有资格获得奖励的玩家列表
        states: states, // 玩家是否已经操作（需求或者放弃）
        randomNum: randomNum, // roll点结果
        rewardItemData: rewardItemData, // 奖励内容
        isDone: false,// 是否分配结束（当标记为分配结束时，update函数会删除记录)
    });

    rewardDecideList.push(roomId); // 这里添加一个物品就加入一个房间id会导致列表中有多个房间id。但这样不会产生问题，就不追究了
    // 通知客户端开始roll点
    var ret = {
        rewardItemData: rewardItemData,
        timeToDecide: 60,
    }
    userMgr.broacastInRoom('rewardRollStart', ret, userId, true); // 向请求同步的玩家同步其他玩家的信息

};
// 玩家放弃奖励
exports.giveUpRequest = function (roomId, userId, rewardItemData) {
    var roomInfo = roomMgr.getRoom(roomId);
    if (roomInfo == null) {
        console.log('请求失败，游戏找不到房间信息');
        return null;
    }

    if (roomInfo.rewardDecide == null) {
        console.log('请求失败，游戏找不到奖励信息');
        return null;
    }

    var seatIndex = roomMgr.getUserSeat(userId);
    if (seatIndex == null) {
        console.log('请求失败，玩家不在座位上');
        return null;
    }
    // 将对应奖励的获取资格中去除放弃的玩家
    for (var i = 0; i < roomInfo.rewardDecide.length; i++) {
        var oneData = roomInfo.rewardDecide[i];
        if (rewardItemData['物品id'] == oneData.rewardItemData['物品id']) {
            var index = -1;
            for (var j = 0; j < oneData.onlineList.length; j++) {
                var userCanGetReward = oneData.onlineList[j];
                if (userCanGetReward == userId) {
                    index = j;
                }
            }
            if (index < 0) continue; // 玩家没有资格获得该奖励
            oneData.states[index] = true; // 标记玩家已经操作
            oneData.randomNum[index] = -1; // 让放弃的玩家roll点为-1.那么一定是roll不过需求的玩家，最后还是以roll点的大小决定奖励的归属
            // 检查奖励判定是否结束
            var doAllAgree = true;
            for (var k = 0; k < oneData.states.length; ++k) {
                if (oneData.states[k] == false) {
                    doAllAgree = false;
                    break;
                }
            }
            if (doAllAgree == true) {
                // 所有人都决定了。可以分配奖励
                oneData.isDone = true;
                exports.sendReward(userId, oneData);
            }
        }
    }
};
// 玩家需求奖励
exports.requireRequest = function (roomId, userId, rewardItemData, randomNum) {
    var roomInfo = roomMgr.getRoom(roomId);
    if (roomInfo == null) {
        console.log('失败，玩家不在座位上');
        return null;
    }

    if (roomInfo.rewardDecide == null) {
        console.log('失败，房间没有解散信息');
        return null;
    }

    var seatIndex = roomMgr.getUserSeat(userId);
    if (seatIndex == null) {
        console.log('失败，玩家不在座位上');
        return null;
    }
    // 设置玩家的roll点数
    for (var i = 0; i < roomInfo.rewardDecide.length; i++) {
        var oneData = roomInfo.rewardDecide[i];
        if (rewardItemData['物品id'] == oneData.rewardItemData['物品id']) {
            var index = -1;
            for (var j = 0; j < oneData.onlineList.length; j++) {
                var userCanGetReward = oneData.onlineList[j];
                if (userCanGetReward == userId) {
                    index = j;
                }
            }
            if (index < 0) continue; // 玩家没有资格获得该奖励
            oneData.states[index] = true; // 标记玩家已经操作
            oneData.randomNum[index] = randomNum; // roll 点结果
            // 检查奖励判定是否结束
            var doAllAgree = true;
            for (var i = 0; i < oneData.states.length; ++i) {
                if (oneData.states[i] == false) {
                    doAllAgree = false;
                    break;
                }
            }
            if (doAllAgree == true) {
                // 所有人都决定了。可以分配奖励
                oneData.isDone = true;
                exports.sendReward(userId, oneData);
            }
        }
    }
};
/**
 * 发送奖励归属
 */
exports.sendReward = function (userId, oneData) {
    var maxNum = -1;
    var maxIndex = -1;
    for (l = 0; l < oneData.randomNum.length; l++) {
        if (oneData.randomNum[l] > maxNum) {
            maxNum = oneData.randomNum[l];
            maxIndex = l;
        }
    }
    if (maxIndex < 0) {
        // 表示所有人放弃了
        maxIndex = 0; // 就给第一个人把(也是第一个进房间的，也是房间的创建者)
    }
    var ret = {
        maxNum: maxNum,
        winner: oneData.onlineList[maxIndex],
        onlineList: oneData.onlineList, // 参与roll点玩家
        randomNum: oneData.randomNum, // roll点结果
        rewardItemData: oneData.rewardItemData, // 奖励物品
    }
    userMgr.broacastInRoom('rewardRollResult', ret, userId, true); // 向请求同步的玩家同步其他玩家的信息
}

function update() {
    for (var i = rewardDecideList.length - 1; i >= 0; --i) {
        var roomId = rewardDecideList[i];

        var roomInfo = roomMgr.getRoom(roomId);
        if (roomInfo != null && roomInfo.rewardDecide != null && roomInfo.rewardDecide.length > 0) {
            for (var j = 0; j < roomInfo.rewardDecide.length; j++) {
                var oneData = roomInfo.rewardDecide[j];
                if (Date.now() > oneData.endTime || oneData.isDone == true) {
                    if (Date.now() > oneData.endTime) {
                        console.log("超过了决定时间，立即发放", oneData.rewardItemData['物品名字']);
                        exports.sendReward(oneData.onlineList[0], oneData);
                    }
                    if (oneData.isDone == true) {
                        console.log("已经决出roll点胜者", oneData.rewardItemData['物品名字']);
                    }
                    roomInfo.rewardDecide.splice(j, 1);
                }
            }
        } else {
            rewardDecideList.splice(i, 1);
        }
    }
}

setInterval(update, 1000);
/**
 * 游戏房间奖励获取分配系列操作 end
 */
