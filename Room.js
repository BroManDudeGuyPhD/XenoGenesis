class Room {

    constructor(creator, name, Players){
        this.creator = creator;
        this.name = name;
        this.joinTIme = new Intl.DateTimeFormat('default',{
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric'
        }).format(new Date());
        this.full = false;

    }

}

module.exports = Room;