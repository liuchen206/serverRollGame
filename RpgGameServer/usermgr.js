var roomMgr = require('./roommgr');
var userList = {}; // 将连接游戏服的玩家保存管理
var userOnline = 0;
// 发起长连接的客户端绑定socket实例
exports.bind = function (userId, socket) {
    userList[userId] = socket;
    userOnline++;
};
/**
 * 将一个玩家移除管理
 */
exports.del = function (userId, socket) {
    delete userList[userId];
    userOnline--;
};
/**
 * 获得一个玩家的连接
 */
exports.get = function (userId) {
    return userList[userId];
};
// 玩家是否在长连接。绑定过的视为在长连接中
exports.isOnline = function (userId) {
    var data = exports.get(userId);
    if (data != null) {
        return true;
    }
    return false;
};
// 单独向玩家发送
exports.sendMsg = function (userId, event, msgdata) {
    console.log(event);
    var userInfo = userList[userId];
    if (userInfo == null) {
        return;
    }
    var socket = userInfo;
    if (socket == null) {
        return;
    }

    socket.emit(event, msgdata);
};
// 向玩家所在房间的其他玩家广播
exports.broacastInRoom = function (event, data, sender, includingSender) {
    var roomId = roomMgr.getUserRoom(sender);
    if (roomId == null) {
        return;
    }
    var roomInfo = roomMgr.getRoom(roomId);
    if (roomInfo == null) {
        return;
    }
    for (var i = 0; i < roomInfo.seats.length; ++i) {
        var rs = roomInfo.seats[i];
        //如果不需要发给发送方，则跳过
        if (rs.userId == sender && includingSender != true) {
            continue;
        }
        var socket = exports.get(rs.userId);
        if (socket != null) {
            socket.emit(event, data);
        }
    }
};
/**
 * 关闭房间内的所有玩家连接
 */
exports.kickAllInRoom = function (roomId) {
    if (roomId == null) {
        return;
    }
    var roomInfo = roomMgr.getRoom(roomId);
    if (roomInfo == null) {
        return;
    }

    for (var i = 0; i < roomInfo.seats.length; ++i) {
        var rs = roomInfo.seats[i];
        //如果不需要发给发送方，则跳过
        if (rs.userId > 0) {
            var socket = exports.get(rs.userId);
            if (socket != null) {
                exports.del(rs.userId);
                socket.disconnect();
            }
        }
    }
};