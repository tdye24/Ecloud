
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
        console.log('ready');
    });
    let username = req.body.username;
    let token = md5(username);
    var cypher = `match(user:User)
                    where user.username='${username}'
                    return user.email`;
    client.on('connect', function(err) {
        if(err) {
            throw err;
            return false;
        }
        console.log('Redis connected successfully!');
        client.set(token, username);
        client.expire(token, 300);
        res.end(JSON.stringify({status: 'success'}));
    });
    