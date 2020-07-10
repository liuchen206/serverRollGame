-- MySQL dump 10.14  Distrib 5.5.64-MariaDB, for Linux (x86_64)
--
-- Host: localhost    Database: rollgame
-- ------------------------------------------------------
-- Server version	5.5.64-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `t_rooms`
--

DROP TABLE IF EXISTS `t_rooms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
  `user_name0` varchar(32) DEFAULT '',
  `user_coin0` int(11) DEFAULT '0',
  `user_id1` int(11) DEFAULT '0',
  `user_name1` varchar(32) DEFAULT '',
  `user_coin1` int(11) DEFAULT '0',
  PRIMARY KEY (`uuid`)
) ENGINE=InnoDB AUTO_INCREMENT=99 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_rooms`
--

LOCK TABLES `t_rooms` WRITE;
/*!40000 ALTER TABLE `t_rooms` DISABLE KEYS */;
INSERT INTO `t_rooms` VALUES (71,0,0,'666222','127.0.0.1',10000,1594373836,'{\"gameType\":\"Chess_Build\",\"subGameType\":\"map_forest\",\"playerNum\":2,\"playRound\":1,\"creator\":15}',0,'',0,0,'',0),(72,0,0,'888555','127.0.0.1',10000,1594374300,'{\"gameType\":\"Chess_Build\",\"subGameType\":\"map_forest\",\"playerNum\":2,\"playRound\":1,\"creator\":15}',0,'',0,0,'',0),(73,0,0,'112211','127.0.0.1',10000,1594374564,'{\"gameType\":\"Chess_Build\",\"subGameType\":\"map_forest\",\"playerNum\":2,\"playRound\":1,\"creator\":15}',0,'',0,0,'',0),(74,0,0,'000222','127.0.0.1',10000,1594375591,'{\"gameType\":\"Chess_Build\",\"subGameType\":\"map_forest\",\"playerNum\":2,\"playRound\":1,\"creator\":15}',0,'',0,0,'',0),(90,0,0,'999999','47.111.248.48',10000,1594382207,'{\"gameType\":\"Chess_Build\",\"subGameType\":\"map_forest\",\"playerNum\":2,\"playRound\":1,\"creator\":15}',15,'1???',10000,0,'',0),(96,0,0,'111100','47.111.248.48',10000,1594383467,'{\"gameType\":\"Chess_Build\",\"subGameType\":\"map_forest\",\"playerNum\":2,\"playRound\":1,\"creator\":21}',21,'lc???',10000,0,'',0),(98,0,0,'556688','47.111.248.48',10000,1594383641,'{\"gameType\":\"Chess_Build\",\"subGameType\":\"map_forest\",\"playerNum\":2,\"playRound\":1,\"creator\":22}',22,'lc',10000,0,'',0);
/*!40000 ALTER TABLE `t_rooms` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `t_users`
--

DROP TABLE IF EXISTS `t_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `t_users` (
  `uid` int(11) NOT NULL AUTO_INCREMENT,
  `account` varchar(64) DEFAULT '',
  `name` varchar(64) CHARACTER SET utf8 NOT NULL DEFAULT '',
  `gems` int(11) unsigned DEFAULT '0',
  `roomId` varchar(8) DEFAULT NULL,
  PRIMARY KEY (`uid`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `t_users`
--

LOCK TABLES `t_users` WRITE;
/*!40000 ALTER TABLE `t_users` DISABLE KEYS */;
INSERT INTO `t_users` VALUES (15,'guest_1593758869691','1号玩家',1102,'999999'),(16,'guest_aaa','2号玩家',1102,NULL),(17,'guest_1594380732164','web1号',1102,NULL),(18,'guest_1594382153027','web1号',1102,NULL),(19,'guest_1594382352702','phone1hao',1102,NULL),(20,'guest_1594382352705','phone1',1102,NULL),(21,'guest_1594383362074','lc的手机',1102,'111100'),(22,'guest_1594383628574','lc',1102,'556688');
/*!40000 ALTER TABLE `t_users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2020-07-10 20:24:46
