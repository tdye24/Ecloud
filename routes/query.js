var express = require('express'),
    router = express.Router(),
    neo4j = require('node-neo4j'),
    levenshtein = require('../utils/levenshtein'),
    compare = require('../utils/compare'),
    screen = require('../utils/screen')
    mysql = require('mysql'),
    pool  = mysql.createPool({
        'host': 'localhost',
        'port': '3306',
        'user': 'root',
        'password': '158728',
        'database': 'eloud',
    });
var db = new neo4j('http://neo4j:158728@localhost:7474');

router.get('/pointrecord', function(req, res) {   
    let username = req.query.username;
    var sql = `select time,opno,info,point from opr
                where id='${username}'
                order by time desc`;
    pool.getConnection(function(err, connection) {
        connection.query(sql, function(err, result) {
            if(err) {
                throw err;
                return false;
            } else {
                connection.release();
                res.end(JSON.stringify(result));
            }
            
        });
    });
})

router.get('/source', function(req, res) {
    let key = req.query.key;
    var keylist = key.split('');
    var re = '.*?';
    for(var i = 0; i < keylist.length; i ++) {
        re += keylist[i] + '.*?';
    }
    var cypher = `match(user:User)-[r:Upload]->(n)
                    where n.title=~'(?i)${re}'
                    return user.username,r.time,n,user.sex`;
    db.cypherQuery(cypher, function(err, result) {
        if(err) {
            throw err;
            return false;
        }
        var data = result.data;
        var resultlist = [];
        for(var i = 0; i < data.length; i ++) {
            var obj = {
                user: data[i][0],
                time: data[i][1],
                info: data[i][2],
                sex: data[i][3],
                relevancy: levenshtein(key, data[i][2].title)
            };
            resultlist.push(obj);
        }
        res.end(JSON.stringify({result:resultlist.sort(compare('relevancy'))}));
    });


});

router.get('/docdetail', function(req, res) {
    let id = req.query.id;
    var cypher = `match(user:User)-[r:Upload]->(doc)
                    where id(doc)=${id}
                    return user.username,user.point,user.motto,r.time,doc,user.sex`;
    db.cypherQuery(cypher, function(err, result) {
        if(err) {
            throw err;
            return false;
        }
        res.end(JSON.stringify(result));
    });
});

router.get('/uploadrecord', function(req, res) {
    let username = req.query.username;
    var cypher = `match(user:User{username:'${username}'})-[:Upload]->(doc:Source)
                    return doc`;
    db.cypherQuery(cypher, function(err, result) {
        if(err) {
            throw err;
            return false;
        }
        res.end(JSON.stringify(result.data));
    });
});

router.get('/follow', function(req, res) {
    let username = req.query.username;
    var cypher = `match(from:User)-[:Follow]->(to:User)
                    where from.username='${username}'
                    return to.username, to.motto, to.sex`;
    db.cypherQuery(cypher, function(err, result) {
        if(err) {
            throw err;
            return false;
        }
        res.end(JSON.stringify(result.data));
    })
});

router.get('/info', function(req, res) {
    let username = req.query.username;
    var cypher = `match(user:User)
                    where user.username='${username}'
                    return user`;
    db.cypherQuery(cypher, function(err, result) {
        // console.log(cypher);
        if(err) {
            throw err;
            return false;
        } 
        let resdata = {
            username: result.data[0].username,
            sex: result.data[0].sex,
            point: result.data[0].point,
            campusCardId: result.data[0].campusCardId,
            email : result.data[0].email,
            telephone: result.data[0].telephone,
            motto: result.data[0].motto
        }
        res.end(JSON.stringify(resdata));
    })
});

router.get('/recommend_user', function(req, res) {
    let username = req.query.username;
    var cypher = `match p=(host:User)-[:Follow|:Upload|:Download*1..6]-(fof:User)
                    where host.username = '${username}'
                    and not (host)-[:Follow]->(fof)
                    and host.username <> fof.username
                    return fof.username as username,
                            fof.sex as sex,
                            fof.motto as motto,
                            length(p) as length
                    order by length`;
    db.cypherQuery(cypher, function(err, result) {
        let resdata = screen(result.data);
        if(err) {
            throw err;
            return false;
        }
        res.end(JSON.stringify(resdata));
    })
});

router.get('/recommend_source', function(req, res) {
    let username = req.query.username;
    var cypher = `match p=(host:User)-[:Follow|:Upload|:Download*1..6]-(ps:Source)
                    where host.username = '${username}'
                    and not (host)-[:Upload|:Download]->(ps)
                    return substring(ps.title, 0, 30) as title,
                            substring(ps.filename, 0, 30) as filename, 
                            id(ps) as id,
                            labels(ps)[1] as type,
                            length(p) as length
                    order by length`;
    db.cypherQuery(cypher, function(err, result) {
        let resdata = screen(result.data);
        if(err) {
            throw err;
            return false;
        }
        res.end(JSON.stringify(resdata));
    })
});

router.get('/comment', function(req, res) {
    let src = req.query.id;
    pool.getConnection(function(err, connection) {
        if(err) {
            throw err;
            return false;
        }
        let sql = `select * from like_num where src = ${src} order by like_num desc, time desc`;
        connection.query(sql, function(err, result) {
            if(err) {
                throw err;
                return false;
            }
                // console.log(result);
                connection.release();
                res.end(JSON.stringify(result));
            })
        })
        
});

router.get('/islike', function(req, res) {
    let username = req.query.username;
    pool.getConnection(function(err, connection) {
        if(err) {
            throw err;
            return false;
        } else {
            let sql = `select comment_id from user_like where username = '${username}'`;
            connection.query(sql, function(err, result) {
                if(err) {
                    throw err;
                    return false;
                } else {
                    connection.release();
                    let like_list = [];
                    for(let i = 0; i < result.length; i ++) {
                        like_list.push(result[i].comment_id);
                    }
                    res.end(JSON.stringify(like_list));
                }
            });
        }
    })
});

router.get('/comment4more', function(req, res) {
    let comment_id = req.query.comment_id;
    pool.getConnection(function(err, connection) {
        if(err) {
            throw err;
            return false;
        }
        let sql = `select * from like_num where parentnode = ${comment_id}`;
        connection.query(sql, function(err, result) {
            if(err) {
                throw err;
                return false;
            }
            connection.release();
            res.end(JSON.stringify(result));
        });
    })
});

router.get('/mycomments', function(req, res) {
    let username = req.query.username;
    pool.getConnection(function(err, connection) {
        if(err) {
            throw err;
            return false;
        }
        let sql = `select * from like_num where username = '${username}'`;
        connection.query(sql, function(err, result) {
            if(err) {
                throw err;
                return false;
            }
            connection.release();
            res.end(JSON.stringify(result));
        });
    })
});

module.exports = router;
