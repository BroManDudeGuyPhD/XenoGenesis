Inventory = function (socket,serverCheck) {
    var self = {
        items: [], //{id:"itemId", amount:1}
        socket:socket,
        serverCheck:serverCheck,
    }
    self.addItem = function (id, amount) {
        for (var i = 0; i < self.items.length; i++) {
            if (self.items[i].id === id) {
                self.items[i].amount += amount;
                self.refreshRender();
                return;
            }
        }
        self.items.push({ id: id, amount: amount });
        self.refreshRender();
    }

    self.removeItem = function (id, amount) {
        for (var i = 0; i < self.items.length; i++) {
            if (self.items[i].id === id) {
                self.items[i].amount -= amount;
                if (self.items[i].amount <= 0)
                    self.items.splice(i, 1);
                self.refreshRender();
                return;
            }
        }
    }

    self.hasItem = function (id, amount) {
        for (var i = 0; i < self.items.length; i++) {
            if (self.items[i].id === id) {
                return self.items[i].amount >= amount;
            }
        }
        return false;
    }

    self.refreshRender = function () {
        // Server
        if(self.serverCheck){
            self.socket.emit('updateInventory',self.items);
            return;
        }

        //Client only

        document.getElementById("inventory").innerHTML = str;
        var addButton = function(data){
            let item = Item.list[data.id];
            let button = document.createElement('button');
            button.onclick - function(){
                self.socket.emit('useItem'.item.id);
            }
            button.innerText = item.name + ' x' + data.amount;
            inventory.appendChild(button);
        }

        for (var i = 0; i < self.items.length; i++) {
            addButton(self.items[i]);
        }

        if(self.server){
            self.socket.on('useItem',function(itemID){
                if(!self.hasItem(itemID,1)){
                    // If the player does not have the item they claim to have...
                    // Need to implement a better anticheat to determine desync vs malicious attemps
                    console.log("Cheater: "+Player.list[self.socket.id].userName);
                    return;
                }
                console.log("Cheater: "+Player.list[self.socket.id].userName);
                let item = Item.list[itemID];
                item.event(Player.list[self.socket.id]);
            });
        }
        
    }

    return self;
}

Item = function (id, name, event) {
    var self = {
        id: id,
        name: name,
        event: event,
    }
    Item.list[self.id] = self;
    return self;
}

Item.list = {};

Item("potion", "Potion", function (player) {
    player.hp = 10;
    player.inventory.removeItem("potion", 1);
});

Item("enemy", "Spawn Enemy", function () {
    Enemy.randomlyGenerate();
});











