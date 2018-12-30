var express = require('express'),
    router = express.Router(),
    neo4j = require('node-neo4j'),
    nodemailer = require('nodemailer'),
    mysql = require('mysql'),
    md5 = require('md5'),//32位小
    fs = require("fs"),
    pool  = mysql.createPool({
        'host': 'localhost',
        'port': '3306',
        'user': 'root',
        'password': '158728',
        'database': 'eloud',
    }),
    redis = require('redis'),
    db = new neo4j('http://neo4j:158728@localhost:7474');

router.post('/info', function(req, res) {
    let old_username = req.body.old_username;
    let username = req.body.username;
    req.session.username = username;
    let sex = req.body.sex;
    let campusCardId = req.body.campusCardId;
    let email = req.body.email;
    let telephone = req.body.telephone;
    let motto = req.body.motto;
    var sql = `update opr
                set id='${username}'
                where id='${old_username}'`;
    var sql1 = `update mininfo
                set id ='${username}'
                where id='${old_username}'`;
    var cypher = `match(user:User)
                    where user.username='${old_username}'
                    set user.username='${username}', 
                    user.campusCardId='${campusCardId}', 
                    user.sex='${sex}',
                    user.email='${email}',
                    user.telephone='${telephone}',
                    user.motto='${motto}'
                    return user`;
    db.cypherQuery(cypher, function(err, result) {
        if(err) {
            throw err;
            return false;
        }
        let resdata = {
            status: 'success',
        }
        pool.getConnection(function(err, connection) {
            if(err) {
                throw err;
                return false;
            } else {
                connection.query(sql, function(err, result) {
                    if(err) {
                        throw err;
                        return false;
                    } else {
                        connection.release();
                        res.end(JSON.stringify(resdata));
                    }
                })
            }
        });
        pool.getConnection(function(err, connection) {
            if(err) {
                throw err;
                return false;
            } else {
                connection.query(sql1, function(err, result) {
                    if(err) {
                        throw err;
                        return false;
                    }
                    connection.release();
                })
            }
        });
    });
});

router.post('/password', function(req, res) {
    let username = req.body.username;
    let new_password = req.body.new_password;
    let cypher = `match(n:User{username:'${username}'})
                    set n.password = '${new_password}'`;
    db.cypherQuery(cypher, function(err, result) {
        // console.log(cypher);
        res.end(JSON.stringify({state:'success'}));
    });
})

router.post('/point_opr', function(req, res) {
    var date = new Date();
    let uploader = req.body.uploader;
    let downloader = req.body.downloader;
    let point = req.body.point;
    let filename = req.body.filename;
    let id = req.body.id;
    let cypher = `match(uploader:User)-[r:Upload]->(doc),(downloader:User)
                    where id(doc)=${id} and downloader.username='${downloader}'
                    with uploader,downloader,doc
                    set uploader.point=uploader.point+${point},downloader.point=downloader.point-${point}, doc.downloadCount=doc.downloadCount+1
                    create (downloader)-[:Download{time:'${date.toLocaleString()}'}]->(doc)
                    return downloader.point`;
    db.cypherQuery(cypher, function(err, result) {
        if(err) {
            throw err;
            return false;
        } 
        // console.log(result);
        res.end(JSON.stringify(result.data));
    });
    let sql = `insert into opr(id, time, opno, info, point) values('${uploader}','${date.toLocaleString()}', 5, '${filename}', ${point}),('${downloader}','${date.toLocaleString()}', 4, '${filename}', ${point})`;
    pool.getConnection(function(err, connection) {
        if(err) {
            throw err;
            return false;
        } else {
            connection.query(sql, function(err, result) {
                if(err) {
                    throw err;
                    return false;
                } else {
                    connection.release();
                }
            })
        }
    })
});

router.get('/delete', function(req, res) {
    let id = req.query.id;
    var cypher = `match(n)
                    where id(n)=${id}
                    return n.path`;
    db.cypherQuery(cypher, function(err, result) {
        if(err) {
            throw err;
            return false;
        }
        // console.log(result);
        let file_path = 'public' + result.data[0];
        // console.log(file_path);
        fs.unlink(file_path, function(err) {
            if(err) {
                throw err;
                return false;
            }
            // console.log('文件删除成功！');
        })
    });
    var cypher = `match(uploader:User)-[:Upload]->(doc)
                    where id(doc)=${id}
                    with doc,uploader
                    match (user:User)-[r]->(doc)
                    delete r,doc
                    with uploader
                    match(uploader)-[:Upload]->(n)
                    return n`;
    // console.log(cypher);
    db.cypherQuery(cypher, function(err, result) {
        if(err) {
            throw err;
            return false;
        }
        res.end(JSON.stringify(result.data));
    })
});

router.post('/follow', function(req, res) {
    let date = new Date();
    let from = req.body.from;
    let to = req.body.to;
    var cypher = `match(from:User),(to:User)
                    where from.username='${from}' and to.username='${to}'
                    create(from)-[:Follow{time:'${date.toLocaleString()}'}]->(to)`;
    // console.log(cypher);
    db.cypherQuery(cypher, function(err, result) {
        if(err) {
            throw err;
            return false;
        }
        res.end(JSON.stringify({status: 'success'}));
    })
});

router.post('/unfollow', function(req, res) {
    let from = req.body.from;
    let to = req.body.to;
    var cypher = `match(from:User)-[r]->(to:User)
                    where from.username='${from}' and to.username='${to}'
                    delete r
                    with from
                    match(from:User)-[:Follow]->(to:User)
                    return to.username, to.motto, to.sex`;
    // console.log(cypher);
    db.cypherQuery(cypher, function(err, result) {
        if(err) {
            throw err;
            return false;
        }
        res.end(JSON.stringify(result.data));
    })
});

router.post('/retrieve', function(req, res) {
    var rds_port = 6379,
        rds_host = '127.0.0.1',
        rds_opts = {};
    client = redis.createClient(rds_port, rds_host, rds_opts);
    let username = req.body.username;
    let token = md5(username);
    // console.log('username', username);
    // console.log('token', token);
    var cypher = `match(user:User)
                    where user.username='${username}'
                    return user.email`;
    client.on('error', function(err) {
        if(err) {
            throw err;
            return false;
        }
    });
    client.on('ready', function(err) {
        if(err) {
            throw err;
            return false;
        }
    });
    client.on('connect', function(err) {
        if(err) {
            throw err;
            return false;
        }
        // console.log('Redis connected successfully!');
        db.cypherQuery(cypher, function(err, result) {
            if(err) {
                throw err;
                return false;
            }
            var email = result.data[0];
            var params = {
                host: 'smtp.163.com',
                port: 465,
                sercure: true,
                auth: {
                    user: '18365225454@163.com',
                    pass: 'yetiandi123'
                }
            }
            // 邮件信息
            const mailOptions = {
                from: '18365225454@163.com', 
                to: email, 
                subject: 'Eloud文件共享平台找回密码', 
                html: `<a href='http://tdye123.picp.net:12757/reset.html?username=${username}&&token=${token}'><b>请在五分钟内点击链接完成验证</b></a>` 
            }
            // console.log(mailOptions);
            // 发送邮件
            const transporter = nodemailer.createTransport(params);
            transporter.sendMail(mailOptions, function(err, info) {
                if (err) {
                    return console.log(err);
                }
                client.set(token, username);
                client.expire(token, 300);
                // console.log('Emial sent successfully!'); 
                res.end(JSON.stringify({status: 'success', email: email}));
            });
        });
    });
});

router.post('/reset', function(req, res) {
    let username = req.body.username;
    let new_password = req.body.new_password;
    let token = req.body.token;
    var rds_port = 6379,
        rds_host = '127.0.0.1',
        rds_opts = {};
    client = redis.createClient(rds_port, rds_host, rds_opts);
    client.on('error', function(err) {
        if(err) {
            throw err;
            return false;
        }
    });
    client.on('ready', function(err) {
        if(err) {
            throw err;
            return false;
        }
    });
    client.on('connect', function(err) {
        if(err) {
            throw err;
            return false;
        }
        client.exists(token, function(err, response) {
            if(response == 1) {
                var cypher = `match(user:User)
                        where user.username=${username}
                        set user.password=${new_password}`;
                db.cypherQuery(cypher, function(err, result) {
                    // console.log(cypher);
                    res.end(JSON.stringify({state:'success'}));
                });
            } else {
                res.end(JSON.stringify({state: 'fail'}));
            }
        });
    })
});

router.post('/comment', function(req, res) {
    var date = new Date();
    let pone = req.body.pone;
    let time = date.toLocaleString();
    let src = req.body.src;
    let text = req.body.text;
    pool.getConnection(function(err, connection) {
        if (err) {
            throw err;
            return false;
        } else {
            let sql = `call insert_and_return_id('${pone}','${time}',${src},'${text}',-1,@id)`;
            connection.query(sql, function(err, result) {
                if (err) {
                    throw err;
                    return false;
                } else {
                    connection.release();
                    res.end(JSON.stringify({state:"success", id: result[0][0].oid}));
                }
            })
        }
    })

});

router.get('/likeplus', function(req, res) {
    let username = req.query.username;
    let id = req.query.id;
    let sql = `insert into user_like (username, comment_id) values ('${username}', ${id})`;
    // console.log(sql);
    pool.getConnection(function(err, connection) {
        if(err) {
            throw err;
            return false;
        } else {
            connection.query(sql, function(err, result) {
                if(err) {
                    throw err;
                    return false;
                } else {
                    connection.release();
                    // console.log(sql);
                    res.end();
                }
            })
        }
    });
});

router.get('/likeminus', function(req, res) {
    let username = req.query.username;
    let id = req.query.id;
    let sql = `delete from user_like where username = '${username}' and comment_id = ${id}`;
    // console.log(sql);
    pool.getConnection(function(err, connection) {
        if(err) {
            throw err;
            return false;
        } else {
            connection.query(sql, function(err, result) {
                if(err) {
                    throw err;
                    return false;
                } else {
                    connection.release();
                    res.end();
                }
            })
        }
    });
});

router.post('/reply', function(req, res) {
    var date = new Date();
    let pone = req.body.pone;
    let time = date.toLocaleString();
    let src = req.body.src;
    let text = req.body.text;
    let parentnode = req.body.parentnode;
    pool.getConnection(function(err, connection) {
        if (err) {
            throw err;
            return false;
        } else {
            let sql = `call insert_and_return_id('${pone}','${time}',${src},'${text}',${parentnode},@id)`;
            // console.log(sql);
            connection.query(sql, function(err, result) {
                if (err) {
                    throw err;
                    return false;
                } else {
                    connection.release();
                    res.end(JSON.stringify({status:"success"}));
                }
            })
        }
    })
});

router.get('/delete_comment', function(req, res) {
    let comment_id = req.query.comment_id;
    pool.getConnection(function(err, connection) {
        if(err) {
            throw err;
            return false;
        } else {
            let sql = `select id from comment where FIND_IN_SET(id,getChildren(${comment_id}))`;
            connection.query(sql, function(err, childrenlist) {
                if(err) {
                    throw err;
                    return false;
                } 
                // console.log(childrenlist);
                let sql2 = `DELETE comment,user_like FROM comment LEFT JOIN user_like ON comment.id=user_like.comment_id WHERE id IN (`;
                for(let i =0; i < childrenlist.length; i ++) {
                    if(i != childrenlist.length - 1) {
                        sql2 += childrenlist[i].id + ',';
                    } else {
                        sql2 += childrenlist[i].id + ')';
                    }
                    
                }
                let sql1 = 'SET FOREIGN_KEY_CHECKS=0';
                let sql3 = 'SET FOREIGN_KEY_CHECKS=1';

                connection.query(sql1, function(err, res1) {
                    if(err) {
                        throw err;
                        return false;
                    }
                    connection.query(sql2, function(err, res2) {
                        if(err) {
                            throw err;
                            return false;
                        }
                        connection.query(sql3, function(err, result) {
                            // console.log(sql);
                            if(err) {
                                throw err;
                                return false;
                            } 
                            connection.release();
                            res.end(JSON.stringify({status: "success"}));   
                        })
                    })
                })
            })
        }
    })
});

module.exports = router;
