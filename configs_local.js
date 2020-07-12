var Server_IP = 'localhost'; // 本地开发测试
// var Server_IP = "47.111.248.48"; // 外网客户端和服务器交互地址

var ACCOUNT_PORT = 9000; // 账号服服务端口
var HALL_CLIENT_PORT = 9001; // 大厅服与帐号服服务端口
var HALL_ROOM_PORT = 9002; // 大厅与游戏服服务端口
var GAME_ROOM_PORT = 9003; // 游戏服与大厅服务端口
var GAME_CONECT_PORT = 10000; // 长连接端口


var ACCOUNT_PRI_KEY = "^&*#$%()@"; // 帐号服通讯私钥
var ROOM_PRI_KEY = "~!@#$(*&^%$&"; // 大厅游戏服私钥

var LOCAL_IP = 'localhost'; // 服务器不同服务之间交互地址

exports.mysql = function () {
    return {
        HOST: LOCAL_IP,
        USER: 'root',
        PSWD: '123456',
        DB: 'rollgame',
        PORT: 3306,
    }
}
//账号服配置
exports.account_server = function () {
    return {
        CLIENT_PORT: ACCOUNT_PORT,
        // 交给客户端的大厅服务地址
        HALL_IP: Server_IP,
        HALL_CLIENT_PORT: HALL_CLIENT_PORT,
        ACCOUNT_PRI_KEY: ACCOUNT_PRI_KEY,

        DEALDER_API_IP: LOCAL_IP,
        DEALDER_API_PORT: 12581,
        VERSION: '19891102',
        APP_WEB: 'http://????/????',
    };
};
//大厅服配置
exports.hall_server = function () {
    return {
        // 大厅与账号服交互地址与端口
        HALL_IP: Server_IP,
        CLEINT_PORT: HALL_CLIENT_PORT,

        // 大厅留给游戏服服交互地址与端口
        FOR_ROOM_IP: LOCAL_IP,
        ROOM_PORT: HALL_ROOM_PORT,

        ACCOUNT_PRI_KEY: ACCOUNT_PRI_KEY,
        ROOM_PRI_KEY: ROOM_PRI_KEY
    };
};

//棋盘游戏服配置
exports.chess_game_server = function () {
    return {
        SERVER_TYPE: "Chess_Build",
        SERVER_ID: "001_chess",
        //给大厅服联系游戏服的HTTP端口号
        HTTP_PORT: GAME_ROOM_PORT,
        //HTTP TICK的间隔时间，用于向大厅服汇报情况
        HTTP_TICK_TIME: 5000,
        //联系大厅服IP
        HALL_IP: LOCAL_IP,
        FOR_HALL_IP: LOCAL_IP,
        //联系大厅服端口
        HALL_PORT: HALL_ROOM_PORT,
        //与大厅服协商好的通信加密KEY
        ROOM_PRI_KEY: ROOM_PRI_KEY,

        //暴露给客户端的长连接端口
        CLIENT_IP: Server_IP,
        CLIENT_PORT: GAME_CONECT_PORT,
    };
};
