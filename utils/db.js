var http = require('../utils/http');
var mysql = require("mysql");
var crypto = require('./crypto');
var pool = null;

exports.init = function (config) {
    console.log('数据库初始化')
    pool = mysql.createPool({
        host: config.HOST,
        user: config.USER,
        password: config.PSWD,
        database: config.DB,
        port: config.PORT,
    });

    // 测试数据库
    // dbTestRead();
    // dbTestWrite();
    // dbTestRead();
    // dbTestInsert();
    // // dbTestDelate();
};
// 使用语句在数据库中查询
function query(sql, callback) {
    pool.getConnection(function (err, conn) {
        if (err) {
            callback(err, null, null);
        } else {
            conn.query(sql, function (qerr, vals, fields) {
                //释放连接  
                conn.release();
                //事件驱动回调  
                callback(qerr, vals, fields);
            });
        }
    });
}
// 测试数据库中的表能否正常 增加 删除 修改 查询
// 查
function dbTestRead() {
    var sql = 'SELECT uid,account,name,gems FROM t_users WHERE account = "' + 'liuchen' + '"';
    console.log('dbTestRead ', sql);
    query(sql, function (err, rows, fields) {
        if (err) {
            console.log('dbTestRead 查询出错');
            throw err;
        }

        if (rows.length == 0) {
            console.log('dbTestRead 没有找到数据');
            return;
        }
        console.log(rows[0]);
    });
}
// 改
function dbTestWrite() {
    var sql = 'UPDATE t_users SET gems = gems +' + 5 + ' WHERE account = ' + '"liuchen"';
    console.log('dbTestWrite ', sql);
    query(sql, function (err, rows, fields) {
        if (err) {
            console.log('dbTestWrite 查询出错');
            throw err;
        } else {
            console.log('dbTestWrite 完成');
        }
    });
};
// 曾
function dbTestInsert() {
    var sql = "INSERT INTO t_users(uid,account,name,gems) VALUES({0},'{1}','{2}',{3})";
    sql = sql.format(Math.floor(Math.random() * 100), 'xiaoc', 'cc', 5);
    console.log('dbTestInsert ', sql);
    query(sql, function (err, row, fields) {
        if (err) {
            console.log('dbTestInsert 查询出错');
            throw err;
        } else {
            console.log('dbTestInsert 完成');
        }
    });
}
// 删
function dbTestDelate() {
    var sql = "DELETE FROM t_users WHERE account = '{0}'";
    sql = sql.format('xiaoc');
    console.log('dbTestDelate ', sql);
    query(sql, function (err, rows, fields) {
        if (err) {
            console.log('dbTestDelate 查询出错');
            throw err;
        }
        else {
            console.log('dbTestDelate 完成');
        }
    });
}
function nop(a, b, c, d, e, f, g) {

}
// 更新玩家背包
exports.update_user_bag_items = function (userId, newBagItems, callback) {
    callback = callback == null ? nop : callback;
    if (userId == null) {
        callback(false);
        return;
    }
    if (newBagItems != null) {
        console.log('清除双引号干扰 1：', newBagItems);
        /**
         * 经过一系列的尝试，问题不是出在字符串的单双引号上面，是数据库不支持汉字字符。修改数据库该字段的编码方式即可
         */
        // 双引号改 \"
        // var newBagItems = newBagItems.replace(/"/g, '\\"');
        // 单引号改 \"
        // var newBagItems = newBagItems.replace(/'/g, '\\"');
        // 双引号改单引号
        // newBagItems = newBagItems.replace(/"/g, '\'')
        // console.log('清除双引号干扰 2：', newBagItems);
        // 单引号改双引号
        // newBagItems = newBagItems.replace(/'/g, '"')
        // console.log('清除单引号干扰 3：', newBagItems);
    }

    var sql = 'UPDATE t_users SET itemInBag =' + "\'" + newBagItems + "\'" + ' WHERE uid = "' + userId + '"';

    // var sql = 'UPDATE t_users SET itemInBag = {0} WHERE uid = {1}'
    // sql = sql.format(newBagItems, userId);

    console.log('更新背包', sql);
    query(sql, function (err, row, fields) {
        if (err) {
            callback(false);
            throw err;
        }
        else {
            callback(true);
        }
    });
};

/** 查询玩家背包 */
exports.get_user_bag_items = function (userId, callback) {
    callback = callback == null ? nop : callback;
    if (userId == null) {
        callback(null);
        return;
    }
    var sql = 'SELECT itemInBag FROM t_users WHERE uid = "' + userId + '"';
    query(sql, function (err, rows, fields) {
        if (err) {
            callback(null);
            throw err;
        }
        if (rows.length == 0) {
            callback(null);
            return;
        }
        callback(rows[0]);
    });
}
/**
 * 更新玩家的等级
 * @param {*} userId 
 * @param {*} newLevel 
 * @param {*} callback 
 */
exports.set_player_level = function (userId, newLevel, callback) {
    callback = callback == null ? nop : callback;
    if (userId == null) {
        callback(null);
        return;
    }
    var sql = 'UPDATE t_users SET level = ' + newLevel + ' WHERE uid = "' + userId + '"';
    query(sql, function (err, rows, fields) {
        if (err) {
            // console.log(err);
            callback(false);
            throw err;
        } else {
            callback(rows.length > 0);
        }
    });
}
/**
 * 更新玩家当前等级的经验
 * @param {*} userId 
 * @param {*} newExps 
 * @param {*} callback 
 */
exports.set_player_exps = function (userId, newExps, callback) {
    callback = callback == null ? nop : callback;
    if (userId == null) {
        callback(null);
        return;
    }
    var sql = 'UPDATE t_users SET exps = ' + newExps + ' WHERE uid = "' + userId + '"';
    query(sql, function (err, rows, fields) {
        if (err) {
            // console.log(err);
            callback(false);
            throw err;
        } else {
            callback(rows.length > 0);
        }
    });
}
/**
 * 查询玩家信息
 * @param {*} account 
 * @param {*} callback 
 */
exports.get_user_data = function (account, callback) {
    callback = callback == null ? nop : callback;
    if (account == null) {
        callback(null);
        return;
    }
    var sql = 'SELECT uid,account,name,gems,level,exps,itemInBag,roleName FROM t_users WHERE account = "' + account + '"';
    query(sql, function (err, rows, fields) {
        if (err) {
            callback(null);
            throw err;
        }
        if (rows.length == 0) {
            callback(null);
            return;
        }
        // rows[0].name = crypto.fromBase64(rows[0].name);
        callback(rows[0]);
    });
};
/**
 * 查询玩家是已经存在
 * @param {}} account 
 * @param {*} callback 
 */
exports.is_user_exist = function (account, callback) {
    callback = callback == null ? nop : callback;
    if (account == null) {
        callback(false);
        return;
    }
    var sql = 'SELECT uid FROM t_users WHERE account = "' + account + '"';
    query(sql, function (err, rows, fields) {
        if (err) {
            throw err;
        }
        if (rows.length == 0) {
            callback(false);
            return;
        }
        callback(true);
    });
}
/**
 * 创建一个玩家
 * @param {*} account 
 * @param {*} name 
 * @param {*} gems 
 * @param {*} callback 
 */
exports.create_user = function (account, name, gems, level, exps, itemInbag, roleName, callback) {
    callback = callback == null ? nop : callback;
    if (account == null || name == null || gems == null) {
        callback(false);
        return;
    }
    var sql = 'INSERT INTO t_users(account,name,gems,level,exps,itemInbag,roleName) VALUES("{0}","{1}",{2},{3},{4},"{5}","{6}")';
    // name = crypto.toBase64(name);
    sql = sql.format(account, name, gems, level, exps, itemInbag, roleName);
    query(sql, function (err, rows, fields) {
        if (err) {
            throw err;
        }
        callback(true);
    });
};
// 查询玩家宝石数量
exports.get_gems = function (account, callback) {
    callback = callback == null ? nop : callback;
    if (account == null) {
        callback(null);
        return;
    }
    var sql = 'SELECT gems FROM t_users WHERE account = "' + account + '"';
    query(sql, function (err, rows, fields) {
        if (err) {
            callback(null);
            throw err;
        }
        if (rows.length == 0) {
            callback(null);
            return;
        }
        callback(rows[0]);
    });
};
// 查询房间是否存在(包括棋盘游戏和rpg副本)
exports.is_room_exist = function (roomId, callback) {
    callback = callback == null ? nop : callback;
    var sql = 'SELECT * FROM t_rooms WHERE roomId = "' + roomId + '"';
    query(sql, function (err, rows, fields) {
        if (err) {
            callback(false);
            throw err;
        } else {
            var re = rows.length > 0;
            console.log('棋盘 房间', re)
            if (re == false) {
                var sqlRPG = 'SELECT * FROM t_rooms_rpg WHERE roomId = "' + roomId + '"';
                query(sqlRPG, function (err, rows, fields) {
                    if (err) {
                        callback(false);
                        throw err;
                    } else {
                        var re = rows.length > 0;
                        console.log('rpg 房间', re)
                        callback(re);
                    }
                });
            } else {
                callback(re);
            }
        }
    });
};
// 更新庄家，也就是下轮游戏首先操作的玩家
exports.update_next_operator = function (roomId, nextOperator, callback) {
    callback = callback == null ? nop : callback;
    var sql = 'UPDATE t_rooms SET nextOperator = {0} WHERE roomId = "{1}"'
    sql = sql.format(nextOperator, roomId);
    //console.log(sql);
    query(sql, function (err, row, fields) {
        if (err) {
            callback(false);
            throw err;
        }
        else {
            callback(true);
        }
    });
};
// 更新游戏轮数
exports.update_num_of_numOfGame = function (roomId, numOfGames, callback) {
    callback = callback == null ? nop : callback;
    var sql = 'UPDATE t_rooms SET numOfGames = {0} WHERE roomId = "{1}"'
    sql = sql.format(numOfGames, roomId);
    //console.log(sql);
    query(sql, function (err, row, fields) {
        if (err) {
            callback(false);
            throw err;
        } else {
            callback(true);
        }
    });
};
// 保存房间信息
exports.create_room = function (roomId, conf, ip, port, create_time, callback) {
    callback = callback == null ? nop : callback;
    var sql = "INSERT INTO t_rooms(roomId,baseInfo,ip,port,create_time) \
                VALUES('{0}','{1}','{2}','{3}',{4})";
    var baseInfo = JSON.stringify({
        gameType: conf.gameType, // 游戏类型
        subGameType: conf.subGameType, // 子游戏类型
        playerNum: conf.playerNum, // 开始游戏的玩家数量
        playRound: conf.playRound, // 总共玩几盘
        creator: conf.creator, // 房间创建者
    });
    sql = sql.format(roomId, baseInfo, ip, port, create_time);
    query(sql, function (err, row, fields) {
        if (err) {
            callback(null);
            throw err;
        } else {
            exports.update_num_of_numOfGame(roomId, 0, nop);
            exports.update_next_operator(roomId, 0, nop);
            callback(roomId);
        }
    });
};
// 将一名入座玩家更新到数据库房间信息
exports.update_seat_info = function (roomId, seatIndex, userId, name, coin, callback) {
    callback = callback == null ? nop : callback;
    var sql = 'UPDATE t_rooms SET user_id{0} = {1},user_name{0} = "{2}",user_coin{0} = "{3}" WHERE roomId = "{4}"';
    // name = crypto.toBase64(name);
    sql = sql.format(seatIndex, userId, name, coin, roomId);
    console.log(sql);
    query(sql, function (err, row, fields) {
        if (err) {
            callback(false);
            throw err;
        } else {
            callback(true);
        }
    });
};
// 查询房间的整体信息（注：服务器中的房间信息，不包括玩家在游戏内的具体游戏信息，只包含了描述是什么游戏，有哪些玩家，玩到哪一句了）
exports.get_room_data = function (roomId, callback) {
    callback = callback == null ? nop : callback;
    if (roomId == null) {
        callback(null);
        return;
    }
    var sql = 'SELECT * FROM t_rooms WHERE roomId = "' + roomId + '"';
    query(sql, function (err, rows, fields) {
        if (err) {
            callback(null);
            throw err;
        }
        if (rows.length > 0) {
            callback(rows[0]);
        } else {
            callback(null);
        }
    });
};
// 查询游戏房间的网络连接地址
exports.get_room_addr = function (roomId, callback) {
    callback = callback == null ? nop : callback;
    if (roomId == null) {
        callback(false, null, null);
        return;
    }
    var sql = 'SELECT ip,port FROM t_rooms WHERE roomId = "' + roomId + '"';
    query(sql, function (err, rows, fields) {
        if (err) {
            callback(false, null, null);
            throw err;
        }
        if (rows.length > 0) {
            callback(true, rows[0].ip, rows[0].port);
        } else {
            callback(false, null, null);
        }
    });
};
// 更新个人信息中的roomId字段，记录玩家已经在某个房间里面了
exports.set_room_id_of_user = function (userId, roomId, callback) {
    callback = callback == null ? nop : callback;
    if (roomId != null) {
        roomId = '"' + roomId + '"';
    }
    var sql = 'UPDATE t_users SET roomId = ' + roomId + ' WHERE uid = "' + userId + '"';
    // console.log('棋盘 玩家房间信息更新', sql);
    query(sql, function (err, rows, fields) {
        if (err) {
            console.log(err);
            callback(false);
            throw err;
        } else {
            callback(rows.length > 0);
        }
    });
};
// 获取玩家的历史房间记录
exports.get_room_id_of_user = function (userId, callback) {
    callback = callback == null ? nop : callback;
    var sql = 'SELECT roomId FROM t_users WHERE uid = "' + userId + '"';
    // console.log(sql);
    query(sql, function (err, rows, fields) {
        if (err) {
            callback(null);
            throw err;
        } else {
            if (rows.length > 0) {
                callback(rows[0].roomId);
            } else {
                callback(null);
            }
        }
    });
};
// 销毁房间
exports.delete_room = function (roomId, callback) {
    callback = callback == null ? nop : callback;
    if (roomId == null) {
        callback(false);
    }
    var sql = "DELETE FROM t_rooms WHERE roomId = '{0}'";
    sql = sql.format(roomId);
    // console.log(sql);
    query(sql, function (err, rows, fields) {
        if (err) {
            callback(false);
            throw err;
        } else {
            callback(true);
        }
    });
}

/**
 * 新游戏rpg接口
 */
// 查询房间是否存在
exports.is_room_exist_rpg = function (roomId, callback) {
    callback = callback == null ? nop : callback;
    var sql = 'SELECT * FROM t_rooms_rpg WHERE roomId = "' + roomId + '"';
    query(sql, function (err, rows, fields) {
        if (err) {
            callback(false);
            throw err;
        } else {
            callback(rows.length > 0);
        }
    });
};
// 保存房间信息
exports.create_room_rpg = function (roomId, conf, ip, port, create_time, callback) {
    callback = callback == null ? nop : callback;
    var sql = "INSERT INTO t_rooms_rpg(roomId,baseInfo,ip,port,create_time) \
                VALUES('{0}','{1}','{2}','{3}',{4})";
    var baseInfo = JSON.stringify({
        gameType: conf.gameType, // 游戏类型
        subGameType: conf.subGameType, // 子游戏类型
        creator: conf.creator, // 房间创建者
    });
    sql = sql.format(roomId, baseInfo, ip, port, create_time);
    query(sql, function (err, row, fields) {
        if (err) {
            callback(null);
            throw err;
        } else {
            exports.update_num_of_numOfGame(roomId, 0, nop);
            callback(roomId);
        }
    });
};
// 查询游戏房间的网络连接地址
exports.get_room_addr_rpg = function (roomId, callback) {
    callback = callback == null ? nop : callback;
    if (roomId == null) {
        callback(false, null, null);
        return;
    }
    var sql = 'SELECT ip,port FROM t_rooms_rpg WHERE roomId = "' + roomId + '"';
    query(sql, function (err, rows, fields) {
        if (err) {
            callback(false, null, null);
            throw err;
        }
        if (rows.length > 0) {
            callback(true, rows[0].ip, rows[0].port);
        } else {
            callback(false, null, null);
        }
    });
};
// 查询房间的整体信息（注：服务器中的房间信息，不包括玩家在游戏内的具体游戏信息，只包含了描述是什么游戏，有哪些玩家，玩到哪一句了）
exports.get_room_data_rpg = function (roomId, callback) {
    callback = callback == null ? nop : callback;
    if (roomId == null) {
        callback(null);
        return;
    }
    var sql = 'SELECT * FROM t_rooms_rpg WHERE roomId = "' + roomId + '"';
    query(sql, function (err, rows, fields) {
        if (err) {
            callback(null);
            throw err;
        }
        if (rows.length > 0) {
            callback(rows[0]);
        } else {
            callback(null);
        }
    });
};
// 将一名入座玩家更新到数据库房间信息
exports.update_seat_info_rpg = function (roomId, seatIndex, userId, name, coin, callback) {
    callback = callback == null ? nop : callback;
    var sql = 'UPDATE t_rooms_rpg SET user_id{0} = {1},user_name{0} = "{2}" WHERE roomId = "{3}"';
    // name = crypto.toBase64(name);
    sql = sql.format(seatIndex, userId, name, roomId);
    //console.log(sql);
    query(sql, function (err, row, fields) {
        if (err) {
            callback(false);
            throw err;
        } else {
            callback(true);
        }
    });
};
// 更新个人信息中的roomId字段，记录玩家已经在某个房间里面了
exports.set_room_id_of_user_rpg = function (userId, roomId, callback) {
    callback = callback == null ? nop : callback;
    if (roomId != null) {
        roomId = '"' + roomId + '"';
    }
    var sql = 'UPDATE t_users SET roomId = ' + roomId + ' WHERE uid = "' + userId + '"';
    // console.log('rpg 玩家房间信息更新', sql);
    query(sql, function (err, rows, fields) {
        if (err) {
            console.log(err);
            callback(false);
            throw err;
        } else {
            callback(rows.length > 0);
        }
    });
};
// 销毁房间
exports.delete_room_rpg = function (roomId, callback) {
    callback = callback == null ? nop : callback;
    if (roomId == null) {
        callback(false);
    }
    var sql = "DELETE FROM t_rooms_rpg WHERE roomId = '{0}'";
    sql = sql.format(roomId);
    // console.log(sql);
    query(sql, function (err, rows, fields) {
        if (err) {
            callback(false);
            throw err;
        } else {
            callback(true);
        }
    });
}
