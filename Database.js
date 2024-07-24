var USE_DB = true;
var mongojs = USE_DB ? require("mongojs") : null;
var db = USE_DB ? mongojs('localhost:27017/xenogenesis',['account','progress']) : null;

Database = {};

Database.isValidPassword = function(data,cb){
    if(!USE_DB)
        return cb(true);
    db.account.findOne({username:data.username,password:data.password}, function(err,res){
        if(res)
            cb(true);
        else
            cb(false);
    });
    
}

Database.isAdmin = function(data,cb){
    if(!USE_DB)
        return cb(false);
    db.account.findOne({username:data.username,admin:'true'}, function(err,res){
        if(res)
            cb(true);
        else
            cb(false);
    });
    
}

Database.isUsernameTaken = function(data,cb){
    if(!USE_DB)
        return cb(true);
    db.account.findOne({username:data.username}, function(err,res){
        if(res)
            cb(true);
        else
            cb(false);
    });
    
}

Database.addUser = function(data,cb){
    if(!USE_DB)
        return cb();
    db.account.insert({username:data.username,password:data.password}, function(err){
        // Database.savePlayerProgress({username:data.username,items:[]},function(){
        //     cb();
        // });

        db.progress.insert({username:data.username,items:[]}, function(){
            // {"id":"potion","amount":"2"}
            cb();
        });
    });
    
}

Database.getPlayerProgress = function(username,cb){
    if(!USE_DB)
        return cb({items:[]});
    db.progress.findOne({username:username}, function(err, res){
        cb({items:res.items});
    });
    
}

Database.savePlayerProgress = function(data,cb){
    //Works whether callback is provided or now
    cb = cb || function(){}
    
    if(!USE_DB)
        return cb();
    db.progress.update({username:data.username},{"$set":data},{upsert:true},cb); 
}

// Database.addUser = function (data, cb) {
//     if (!USE_DB)
//         return cb();
//     db.compte.insert({ pseudo: data.pseudo, mdp: data.mdp }, function (err) {
//         cb();
//     });
//     db.progres.insert({ pseudo: data.pseudo, items: [], pos: { x: 100, y: 100 }, skin: 'default' }, function (err) {
//         cb();
//     });

// }