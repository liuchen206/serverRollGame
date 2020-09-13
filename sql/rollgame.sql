/*
Navicat MySQL Data Transfer

Source Server         : aaa
Source Server Version : 50173
Source Host           : localhost:3306
Source Database       : rollgame

Target Server Type    : MYSQL
Target Server Version : 50173
File Encoding         : 65001

Date: 2020-09-05 16:35:01
*/

SET FOREIGN_KEY_CHECKS=0;

-- ----------------------------
-- Table structure for t_rooms
-- ----------------------------
DROP TABLE IF EXISTS `t_rooms`;
CREATE TABLE `t_rooms` (
  `uuid` int(11) NOT NULL AUTO_INCREMENT,
  `numOfGames` int(11) DEFAULT NULL,
  `nextOperator` int(11) DEFAULT NULL,
  `roomId` char(8) DEFAULT NULL,
  `ip` varchar(16) DEFAULT NULL,
  `port` int(11) DEFAULT NULL,
  `create_time` int(11) DEFAULT NULL,
  `baseInfo` varchar(255) DEFAULT NULL,
  `user_id0` int(11) NOT NULL DEFAULT '0',
  `user_name0` varchar(32) CHARACTER SET utf8 DEFAULT '0',
  `user_coin0` int(11) DEFAULT '0',
  `user_id1` int(11) DEFAULT '0',
  `user_name1` varchar(32) CHARACTER SET utf8 DEFAULT '0',
  `user_coin1` int(11) DEFAULT '0',
  `user_name2` varchar(32) CHARACTER SET utf8 DEFAULT '0',
  `user_name3` varchar(32) CHARACTER SET utf8 DEFAULT '0',
  `user_name4` varchar(32) CHARACTER SET utf8 DEFAULT '0',
  `user_coin2` int(11) DEFAULT '0',
  `user_coin3` int(11) DEFAULT '0',
  `user_coin4` int(11) DEFAULT '0',
  PRIMARY KEY (`uuid`)
) ENGINE=InnoDB AUTO_INCREMENT=165 DEFAULT CHARSET=latin1;

-- ----------------------------
-- Table structure for t_rooms_rpg
-- ----------------------------
DROP TABLE IF EXISTS `t_rooms_rpg`;
CREATE TABLE `t_rooms_rpg` (
  `uuid` int(11) NOT NULL AUTO_INCREMENT,
  `numOfGames` int(11) DEFAULT NULL,
  `roomId` char(8) DEFAULT NULL,
  `ip` varchar(16) DEFAULT NULL,
  `port` int(11) DEFAULT NULL,
  `create_time` int(11) DEFAULT NULL,
  `baseInfo` varchar(255) DEFAULT NULL,
  `user_id0` int(11) NOT NULL DEFAULT '0',
  `user_name0` varchar(32) CHARACTER SET utf8 DEFAULT '0',
  `user_id1` int(11) DEFAULT '0',
  `user_name1` varchar(32) CHARACTER SET utf8 DEFAULT '0',
  `user_id2` int(11) DEFAULT '0',
  `user_id3` int(11) DEFAULT '0',
  `user_id4` int(11) DEFAULT '0',
  `user_name2` varchar(32) CHARACTER SET utf8 DEFAULT '0',
  `user_name3` varchar(32) CHARACTER SET utf8 DEFAULT '0',
  `user_name4` varchar(32) CHARACTER SET utf8 DEFAULT '0',
  PRIMARY KEY (`uuid`)
) ENGINE=InnoDB AUTO_INCREMENT=853 DEFAULT CHARSET=latin1;

-- ----------------------------
-- Table structure for t_users
-- ----------------------------
DROP TABLE IF EXISTS `t_users`;
CREATE TABLE `t_users` (
  `uid` int(11) NOT NULL AUTO_INCREMENT,
  `account` varchar(64) DEFAULT '',
  `name` varchar(64) CHARACTER SET utf8 NOT NULL DEFAULT '',
  `gems` int(11) unsigned DEFAULT '0',
  `roomId` varchar(8) DEFAULT NULL,
  `level` int(11) unsigned DEFAULT '0',
  `exps` int(11) unsigned DEFAULT '0',
  `itemInBag` text CHARACTER SET utf8 NOT NULL,
  `roleName` varchar(64) CHARACTER SET utf8 DEFAULT '',
  PRIMARY KEY (`uid`)
) ENGINE=InnoDB AUTO_INCREMENT=44 DEFAULT CHARSET=latin1;
