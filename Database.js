var USE_DB = false;
var mongojs = USE_DB ? require("mongojs") : null;

// Smart connection with fallback: try ironman first, then localhost
var db = null;
if (USE_DB) {
    try {
        // First try to connect to ironman server
        console.log('🔍 Attempting to connect to MongoDB on ironman...');
        db = mongojs('ironman:27017/xenogenesis', ['account','progress']);
        
        // Test the connection
        db.runCommand("ping", function(err, res) {
            if (err) {
                console.log('❌ Failed to connect to ironman, falling back to localhost...');
                db.close();
                db = mongojs('localhost:27017/xenogenesis', ['account','progress']);
                console.log('✅ Connected to MongoDB on localhost');
            } else {
                console.log('✅ Connected to MongoDB on ironman');
            }
        });
        
    } catch (error) {
        console.log('❌ Error connecting to ironman, using localhost fallback...');
        db = mongojs('localhost:27017/xenogenesis', ['account','progress']);
    }
}

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
    db.account.findOne({username:data.username,admin:"true"}, function(err,res){
        if(res)
            cb(true);
        else
            cb(false);
    });
    
}

Database.makeAdmin = function(data,cb){
    cb = cb || function(){}
    if(!USE_DB)
        cb(false);

    db.account.updateOne({username:data.username},{"$set": {username:data.username, admin:"true"}},{upsert:true},function(err){
        Database.isAdmin({username:data.username}, function(){
            cb(true);
        })
    }); 
}

Database.removeAdmin = function(data,cb){
    cb = cb || function(){}
    if(!USE_DB)
        cb(true);

    db.account.updateOne({username:data.username},{"$set": {username:data.username, admin:"false"}},{upsert:true},function(err){
        Database.isAdmin({username:data.username}, function(){
            cb(false);
        })
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
    db.account.insert({username:data.username,password:data.password,admin:"false"}, function(err){
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
        //cb({items:res.items});
        cb({items:[]});
    });
    
}

Database.savePlayerProgress = function(data,cb){
    //Works whether callback is provided or now
    cb = cb || function(){}
    
    if(!USE_DB)
        return cb();
    db.progress.updateOne({username:data.username},{"$set":data},{upsert:true},cb); 
}