var roomMgr = require("./roommgr");
var userMgr = require("./usermgr");
var db = require("../utils/db");
var crypto = require("../utils/crypto");

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

    // todo 游戏相关逻辑
};