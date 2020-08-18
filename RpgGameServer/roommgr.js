var db = require('../utils/db');
/**
 * 生成一个房间id
 */
function generateRoomId() {
    var roomId = "";
    var luckyNum = Math.floor(Math.random() * 10);
    var luckyNum2 = Math.floor(Math.random() * 10);
    var luckyNum3 = Math.floor(Math.random() * 10);

    var rangArray = [1, 2, 3];
    var luckyRang = rangArray[Math.floor(Math.random() * 100) % 3];
    for (var i = 0; i < 6; ++i) {
        if (luckyRang == 1) { //6个数字中总共有1个数字
            roomId += luckyNum;
        }
        if (luckyRang == 2) { //6个数字中总共有2个数字
            if (i < 3) {
                roomId += luckyNum;
            } else {
                roomId += luckyNum2;
            }
        }
        if (luckyRang == 3) { //6个数字中总共有2个数字
            if (i < 2) {
                roomId += luckyNum;
            } else if (i >= 2 && i < 4) {
                roomId += luckyNum2;
            } else {
                roomId += luckyNum3;
            }
        }
    }
    console.log('房间号生成', roomId);
    return roomId;
}
/**
 * 返回房间总数
 */
var totalRooms = 0;
exports.getTotalRooms = function () {
    return totalRooms;
};
var rooms = {}; // key = roomId;value=roomInfo
var creatingRooms = {};
// 创建一个新房间
exports.createRoom = function (creator, roomConf, gems, ip, port, callback) {
    // gameType: 'Rpg_Battle', // 棋盘经营
    // subGameType: "map_forest", // 子玩法类型
    // playerNum: 2,//玩家人数
    // 参数检查
    if (roomConf.subGameType == null
        || roomConf.gameType == null
        || roomConf.playerNum == null) {
        callback(106, null); // 给你参数不够
        return;
    }
    // 宝石检查
    if (gems <= 0) {
        callback(107, null); // 宝石不够
        return;
    }
    var fnCreate = function () {
        var roomId = generateRoomId();
        if (rooms[roomId] != null || creatingRooms[roomId] != null) {
            // 房间号已经被占用
            fnCreate();
        } else {
            creatingRooms[roomId] = true; // 占用住id
            db.is_room_exist_rpg(roomId, function (ret) {
                if (ret) {
                    // 房间在数据库中存在
                    delete creatingRooms[roomId];
                    fnCreate();
                } else {
                    // 新建房间
                    var createTime = Math.ceil(Date.now() / 1000);
                    // 构建房间信息
                    var roomInfo = {
                        id: roomId,
                        createTime: createTime, // 房间创建时间
                        seats: [], // 玩家数据
                        creator: creator, // 房间创建者
                        gameType: roomConf.gameType, // 游戏类型
                        subGameType: roomConf.subGameType, // 子游戏类型
                        playerNum: roomConf.playerNum, // 开始游戏的玩家数量
                        gameMgr: null, // 游戏逻辑脚本
                        dr: null,// 游戏发起解散数据
                    };
                    // 游戏逻辑脚本
                    if (roomConf.gameType == 'Rpg_Battle') {
                        roomInfo.gameMgr = require("./rpg_battle_logic");
                    }
                    for (var i = 0; i < roomInfo.playerNum; ++i) {
                        // 玩家座位信息,默认值
                        roomInfo.seats.push({
                            userId: 0,
                            name: "",
                            ready: false,
                            seatIndex: i,
                            roleName: '',
                            currentGirdIndex: 0,
                            ip: "", // 长连接握手IP地址。由客户端发起长连接时赋值
                        });
                    }
                    //写入数据库
                    db.create_room_rpg(roomInfo.id, roomInfo, ip, port, createTime, function (roomId) {
                        delete creatingRooms[roomId];
                        if (roomId != null) {
                            rooms[roomId] = roomInfo;
                            totalRooms++;
                            callback(0, roomId);
                        } else {
                            callback(108, null);
                        }
                    });
                }
            })
        }
    }
    fnCreate();
};
// 通过数据库读取的房间信息构建房间数据
function constructRoomFromDb(dbdata) {
    var roomConf = JSON.parse(dbdata.baseInfo);
    var roomInfo = {
        id: dbdata.roomId,
        createTime: dbdata.create_time, // 房间创建时间
        seats: [], // 玩家数据
        creator: roomConf.creator, // 房间创建者
        gameType: roomConf.gameType, // 游戏类型
        subGameType: roomConf.subGameType, // 子游戏类型
        playerNum: roomConf.playerNum, // 开始游戏的玩家数量
        gameMgr: null,
    };

    if (roomConf.gameType == 'Rpg_Battle') {
        roomInfo.gameMgr = require("./rpg_battle_logic");
    }

    var roomId = roomInfo.id;
    for (var i = 0; i < roomInfo.playerNum; ++i) {
        var s = {};
        s.userId = dbdata["user_id" + i];
        s.name = dbdata["user_name" + i];
        s.ready = false;
        s.seatIndex = i;
        s.currentGirdIndex = 0;
        roomInfo.seats.push(s);

        //老规矩 ，当玩家入座之后，单独为已经入座的玩家创建一个索引。
        if (s.userId > 0) {
            userLocation[s.userId] = {
                roomId: roomId,
                seatIndex: i
            };
        }
    }
    rooms[roomId] = roomInfo;
    totalRooms++;
    return roomInfo;
}
/**
 * 返回坐下的玩家的房间号
 */
exports.getUserRoom = function (userId) {
    var location = userLocation[userId];
    if (location != null) {
        return location.roomId;
    }
    return null;
};
/**
 * 返回玩家在房间内的座位号
 */
exports.getUserSeat = function (userId) {
    var location = userLocation[userId];
    if (location != null) {
        return location.seatIndex;
    }
    return null;
};
/**
 * 返回房间信息
 */
exports.getRoom = function (roomId) {
    return rooms[roomId];
};
// 进入房间
var userLocation = {};
exports.enterRoom = function (roomId, userId, userName, roleName, callback) {
    // 玩家进入座位
    var fnTakeSeat = function (room) {
        if (exports.getUserRoom(userId) == roomId) {
            //玩家已经在房间里面
            return 0;
        }
        for (var i = 0; i < room.playerNum; ++i) {
            var seat = room.seats[i];
            if (seat.userId <= 0) {
                seat.userId = userId;
                seat.name = userName;
                seat.roleName = roleName;
                // todo 上报完整的玩家个人信息

                // 当玩家入座之后，单独为已经入座的玩家创建一个索引。
                userLocation[userId] = {
                    roomId: roomId,
                    seatIndex: i
                };
                //console.log(userLocation[userId]);
                db.update_seat_info_rpg(roomId, i, seat.userId, seat.name, seat.coin);
                //正常
                return 0;
            }
        }
        //房间已满
        return 1;
    }
    var room = rooms[roomId];
    if (room) {
        // 房间存在
        var ret = fnTakeSeat(room);
        callback(ret);
    } else {
        // 房间不存在
        db.get_room_data_rpg(roomId, function (dbdata) {
            if (dbdata == null) {
                //找不到房间
                callback(2);
            } else {
                // 使用服务器的数据构建已有的房间
                console.log('内存中没有房间信息，数据库中创建房间', dbdata);
                room = constructRoomFromDb(dbdata);
                var ret = fnTakeSeat(room);
                callback(ret);
            }
        });
    }
};
/**
 * 玩家设置为准备完毕
 */
exports.setReady = function (userId, value) {
    var roomId = exports.getUserRoom(userId);
    if (roomId == null) {
        return;
    }
    var room = exports.getRoom(roomId);
    if (room == null) {
        return;
    }
    var seatIndex = exports.getUserSeat(userId);
    if (seatIndex == null) {
        return;
    }
    var s = room.seats[seatIndex];
    s.ready = value;
}
/**
 * 销毁房间，包括房间信息rooms，座位信息userLocation，数据库房间号数据和单个玩家房间号信息
 */
exports.destroy = function (roomId) {
    var roomInfo = rooms[roomId];
    if (roomInfo == null) {
        return;
    }
    for (var i = 0; i < roomInfo.playerNum; ++i) {
        var userId = roomInfo.seats[i].userId;
        if (userId > 0) {
            // 删除用于定位玩家房间和座位号的信息
            delete userLocation[userId];
            // 删除玩家在users数据库的房间号信息
            db.set_room_id_of_user_rpg(userId, null);
        }
    }
    // 删除整个房间信息
    delete rooms[roomId];
    // 房间数量-1
    totalRooms--;
    // 删除rooms数据库的房间信息
    db.delete_room_rpg(roomId);
};