const REDIS_PORT = 10908;
const REDIS_HOST = 'pub-redis-10908.us-east-1-3.3.ec2.garantiadata.com';

var servers = { };
var clients = { };

var redis_module = require("redis");
var redis = redis_module.createClient(REDIS_PORT, REDIS_HOST);

var express = require('express');
var app = express();

var http = require('http');
var server = http.createServer(app);

var centralSock = require('socket.io').listen(server);

var port = process.env.PORT || 8085;
server.listen(port);
console.log("Server started on port " + port);

app.get('/?', function (req, res) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Peernet Central Server');
});

centralSock.on('connection', function(socket) {
    console.log("client connected to central server");

    socket.on('userdata', function(data) {
        var status = signupAndSendStatus(data.uname,data.email,data.password,socket); 
    });

    socket.on('authenticate', function(username,password) {
        redis.get("uname-"+username, function(err, returnedPass) {
            if(password===returnedPass) {
                socket.emit('auth',"authenticated succesfully!",1);
                var ipaddress = socket.handshake.address;
                redis.set("ipofuname-"+username,ipaddress.address);
                redis.set("auth-"+username,1);
                //redis.set("pubkofuname-"+username);
            } else {
                socket.emit('auth',"Error occured in authentication");
            }
        });
    });

    socket.on('publickey', function(username,pubkey) {
        redis.set("pubkofuname-"+username,pubkey);
    });

    socket.on('getIP',function(username) {
        var users_ip ;
        redis.get("ipofuname-"+username, function(err, user_ip) {

            if(user_ip) {
                socket.emit('receiveIP' + username,user_ip);    
            } else {
                socket.emit('receiveIP' + username,"error");    
            }
        });
    });


    socket.on('getPubKey', function(username) {
        console.log('in getPubKey '+username);
        redis.get("pubkofuname-"+username, function(err, user_pk){

            if(user_pk) {
                socket.emit('recvPubKey' + username,user_pk);
            } else {
                socket.emit('recvPubKey' + username,"error");
            }
        });
    });
    socket.on('disconnect', function() {
        //redis.del("auth-"+username); - put this line in logout
        console.log(socket.username + ' has disconnected');
    });

});

function isUserAuthenticated(username,fn) {
    redis.get("auth-"+username, function(err, unameRet)  {
        if(unameRet) {
            fn(err,true);
        } else {
            fn(err,false);
        }
    });
}

function signupAndSendStatus(username,email,password,socket) {
    var uname;
    redis.get("uname-"+username, function(err, unameRet)  {
        if(unameRet) {
            socket.emit('fail', { message:'username exists'});
        } else {
            redis.get("email-"+email, function(err, emailReturn)  {
                if(emailReturn) {
                    socket.emit('fail', { message:'email exists'});
                } else {
                    redis.set("uname-"+username,password );
                    redis.set("emailofuname-"+username,email);
                    redis.set("email-"+email,password );
                    redis.set("unameofemail-"+email,username );
                    socket.emit('success', { message:'success'});
                }
            });

        }
    });
    return "ignore";
}

