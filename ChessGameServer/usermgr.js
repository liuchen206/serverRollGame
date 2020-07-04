var roomMgr = require('./roommgr');
var userList = {}; // 将连接游戏服的玩家保存管理
var userOnline = 0;
// 发起长连接的客户端绑定socket实例
exports.bind = function (userId, socket) {
    userList[userId] = socket;
    userOnline++;
};
// 玩家是否在长连接。绑定过的视为在长连接中
exports.isOnline = function (userId) {
    var data = userList[userId];
    if (data != null) {
        return true;
    }
    return false;
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
        var socket = userList[rs.userId];
        if (socket != null) {
            socket.emit(event, data);
        }
    }
};