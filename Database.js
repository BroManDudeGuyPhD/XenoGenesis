var USE_DB = true;
var mongojs = USE_DB ? require("mongojs") : null;

// Smart connection with fallback: try ironman first, then localhost
var db = null;
if (USE_DB) {
    try {
        // First try to connect to ironman server
        console.log('🔍 Attempting to connect to MongoDB on ironman...');
        db = mongojs('ironman:27017/xenogenesis', ['account','progress','invites']);
        
        // Test the connection
        db.runCommand("ping", function(err, res) {
            if (err) {
                console.log('❌ Failed to connect to ironman, falling back to localhost...');
                db.close();
                db = mongojs('localhost:27017/xenogenesis', ['account','progress','invites']);
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
    
    // First, let's see what's actually in the database for this user
    console.log(`🔍 Checking admin status for user: ${data.username}`);
    db.account.findOne({username:data.username}, function(err,user){
        if(user) {
            console.log(`🔍 User found:`, user);
            console.log(`🔍 Admin field value:`, user.admin, `(type: ${typeof user.admin})`);
        } else {
            console.log(`❌ User not found in database: ${data.username}`);
        }
    });
    
    // Check for admin status - try both string and boolean values
    db.account.findOne({username:data.username}, function(err,res){
        if(res && (res.admin === "true" || res.admin === true)) {
            console.log(`✅ ${data.username} is confirmed admin`);
            cb(true);
        } else {
            console.log(`❌ ${data.username} is not admin`);
            cb(false);
        }
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
        return cb(true);
    
    db.account.insert({username:data.username,password:data.password,admin:"false"}, function(err, result){
        if (err) {
            console.error('❌ Error inserting user account:', err);
            return cb(false);
        }
        
        console.log('✅ User account inserted successfully:', result);
        
        // Insert progress data
        db.progress.insert({username:data.username,items:[]}, function(progressErr, progressResult){
            if (progressErr) {
                console.error('❌ Error inserting user progress:', progressErr);
                return cb(false);
            }
            
            console.log('✅ User progress inserted successfully:', progressResult);
            cb(true); // Success!
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

// Invite Code System Functions
// Debug function to list all invite codes
Database.listAllInviteCodes = function(cb) {
    if (!USE_DB) return cb([]);
    
    db.invites.find({}, function(err, invites) {
        if (err) {
            console.log('❌ Error fetching invite codes:', err);
            return cb([]);
        }
        
        console.log('📋 All invite codes in database:');
        invites.forEach((invite, index) => {
            const status = invite.used ? '❌ USED' : '✅ AVAILABLE';
            const usedInfo = invite.used ? ` (by ${invite.usedBy} at ${invite.usedAt})` : '';
            console.log(`${index + 1}. ${invite.code} - ${status}${usedInfo}`);
        });
        
        cb(invites);
    });
}

// Cleanup function to remove used invite codes (except permanent ones)
// Update existing invite codes to add isPermanent flag if missing
Database.updateInviteCodeSchema = function(cb) {
    if (!USE_DB) return cb(true);
    
    console.log('🔄 Updating invite code schema...');
    
    // Add isPermanent: false to all codes that don't have this field
    db.invites.update(
        { isPermanent: { $exists: false } },
        { $set: { isPermanent: false } },
        { multi: true },
        function(err, result) {
            if (err) {
                console.log('❌ Error updating invite code schema:', err);
                return cb(false);
            }
            
            if (result.n > 0) {
                console.log(`🔄 Added isPermanent flag to ${result.n} invite code(s)`);
            }
            
            console.log('✅ Invite code schema update completed');
            cb(true);
        }
    );
}

Database.cleanupUsedInviteCodes = function(cb) {
    if (!USE_DB) return cb(true);
    
    // Remove used invite codes, but preserve permanent codes
    db.invites.remove(
        {
            used: true,
            isPermanent: { $ne: true } // Don't remove permanent codes even if marked as used
        },
        { multi: true },
        function(err, result) {
            if (err) {
                console.log('❌ Error cleaning up used invite codes:', err);
                return cb(false);
            }
            
            if (result.n > 0) {
                console.log(`🧹 Cleaned up ${result.n} used invite code(s) from database`);
            }
            
            cb(true);
        }
    );
}

Database.generateInviteCode = function(adminUsername, cb) {
    if (!USE_DB) return cb(null);
    
    // Generate unique 8-character alphanumeric code
    function generateCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
    
    let inviteCode = generateCode();
    
    // Check if code already exists (very unlikely but ensure uniqueness)
    db.invites.findOne({code: inviteCode}, function(err, existing) {
        if (existing) {
            // If code exists, generate a new one (recursive)
            return Database.generateInviteCode(adminUsername, cb);
        }
        
        // Store the invite code (regular, not permanent)
        const inviteData = {
            code: inviteCode,
            createdBy: adminUsername,
            createdAt: new Date(),
            used: false,
            usedBy: null,
            usedAt: null,
            isPermanent: false
        };
        
        db.invites.insertOne(inviteData, function(err) {
            if (err) {
                console.log('❌ Error creating invite code:', err);
                return cb(null);
            }
            console.log(`✅ Random invite code ${inviteCode} created by ${adminUsername}`);
            cb(inviteCode);
        });
    });
}

// Generate a custom permanent invite code
Database.generatePermanentInviteCode = function(customCode, adminUsername, cb) {
    if (!USE_DB) return cb(null);
    
    console.log(`🔍 Creating permanent invite code: ${customCode} by ${adminUsername}`);
    
    // Check if code already exists
    db.invites.findOne({code: customCode}, function(err, existing) {
        if (err) {
            console.log('❌ Error checking for existing code:', err);
            return cb(null);
        }
        
        if (existing) {
            console.log(`❌ Code ${customCode} already exists in database`);
            return cb(null);
        }
        
        // Store the permanent invite code
        const inviteData = {
            code: customCode,
            createdBy: adminUsername,
            createdAt: new Date(),
            used: false,
            usedBy: null,
            usedAt: null,
            isPermanent: true
        };
        
        db.invites.insertOne(inviteData, function(err) {
            if (err) {
                console.log('❌ Error creating permanent invite code:', err);
                return cb(null);
            }
            console.log(`👑 Permanent invite code ${customCode} created by ${adminUsername}`);
            cb(customCode);
        });
    });
}

Database.validateInviteCode = function(code, cb) {
    if (!USE_DB) return cb(false);
    
    console.log(`🔍 Validating invite code: ${code}`);
    
    // Check database for the code
    db.invites.findOne({code: code}, function(err, invite) {
        if (err) {
            console.log(`❌ Database error checking invite code ${code}:`, err);
            return cb(false);
        }
        
        if (!invite) {
            console.log(`❌ Invite code ${code} does not exist in database`);
            return cb(false);
        }
        
        console.log(`🔍 Found invite code ${code} in database:`, invite);
        
        // Check if it's a permanent code
        if (invite.isPermanent) {
            console.log(`👑 Permanent invite code ${code} - always valid`);
            return cb(true);
        }
        
        // For regular codes, check if already used
        if (invite.used) {
            console.log(`❌ Invite code ${code} has already been used by ${invite.usedBy} at ${invite.usedAt}`);
            return cb(false);
        }
        
        console.log(`✅ Valid unused invite code found: ${code}`);
        cb(true);
    });
}

Database.useInviteCode = function(code, username, cb) {
    if (!USE_DB) return cb(false);
    
    console.log(`🔄 Attempting to use invite code: ${code} for user: ${username}`);
    
    // First find the invite code to check if it's permanent
    db.invites.findOne({code: code}, function(err, invite) {
        if (err) {
            console.log(`❌ Database error finding invite code ${code}:`, err);
            return cb(false);
        }
        
        if (!invite) {
            console.log(`❌ Invite code ${code} not found in database`);
            return cb(false);
        }
        
        // Check if it's a permanent code
        if (invite.isPermanent) {
            console.log(`👑 Permanent invite code ${code} used by ${username} - not marking as consumed`);
            return cb(true); // Success, but don't mark as used
        }
        
        // For regular codes, mark as used
        if (invite.used) {
            console.log(`❌ Invite code ${code} already used by ${invite.usedBy}`);
            return cb(false);
        }
        
        // Mark the regular code as used
        db.invites.updateOne(
            {code: code, used: false}, 
            {"$set": {
                used: true,
                usedBy: username,
                usedAt: new Date()
            }}, 
            function(err, result) {
                if (err || result.modifiedCount === 0) {
                    console.log(`❌ Failed to use invite code: ${code}`);
                    return cb(false);
                }
                console.log(`✅ Invite code ${code} used by ${username}`);
                cb(true);
            }
        );
    });
}