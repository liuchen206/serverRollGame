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
                // console.log('怪物扣血，向 怪物', data.toId, '从玩家 ', data.fromId, '伤害：', data.damage);
                var monData = gameMonstersMap[data.toId];
                if (monData) {
                    monData.currentHp -= data.damage;
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
    userMgr.sendMsg(userId, 'syncRpgPlayers', ret); // 向请求同步的玩家同步其他玩家的信息
}
// 玩家物品更新
exports.playerItemUpdate = function (userId, itemData) {
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
                console.log('更新成功', JSON.stringify(items))
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
