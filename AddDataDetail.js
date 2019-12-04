const csv = require('csv-parser');
const fs = require('fs');

var mysql = require('mysql');

var con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database : "kltn"
});
var done = false

var Data = [];
function AddDataDetail() {
    fs.createReadStream('listings.csv').pipe(csv(['id','picture_url','property_type','room_type']))
    
    .on('data', (row) => {
        // console.log(row)
        Data.push(row);
        })

    .on('end', () => {
       //console.log(Data[1][4])  
       con.connect(function(err)
       {
           if (err) throw err;
           for (i=1;i < Data.length;i++){
           var sqlpic = "insert into `kltn`.`homestay pictures`(`Homestay_id`,`Picture_url`) values ('" + Data[i][0] +"', '"+ Data[i][4]+ "')";           
           con.query(sqlpic,function(err)
           {
               if (err) throw err;              
           })
           var sqlRoom = "Update `homestay` set RoomType_id='" + getRoomType(Data[i][9])+"', PropertyType_id='"+ getPropertyType(Data[i][8])+ "' where Homestay_id= '" + Data[i][0]+"'";
           con.query(sqlRoom,function(err)
           {
               if(err) throw err;
               
           })
    
          
        }   
        console.log("done")        
       }
       )
        
    });
}

function getPropertyType(Data)
{
    switch(Data)
    {
        case "Aparthotel" : 
            return "pro001";
            break;
        case "Apartment" : 
            return "pro002";
            break;
        case "Barn" : 
            return "pro003";
            break;
        case "Bed and breakfast" : 
            return "pro004";
            break;
        case "Boat" : 
            return "pro005";
            break;
        case "Boutique hotel" : 
            return "pro006";
            break;
        case "Bungalow" : 
            return "pro007";
            break;
        case "Bus" : 
            return "pro008";
            break;
        case "Cabin" : 
            return "pro009";
            break;
        case "Camper/RV" : 
            return "pro010";
            break;
        case "Casa paricular (Cuba)" : 
            return "pro011";
            break;
        case "Castle" : 
            return "pro012";
            break;
        case "Cave" : 
            return "pro013";
            break;
        case "Condominium" : 
            return "pro014";
            break;  
        case "Cottage" : 
            return "pro015";
            break;
        case "Dome house" : 
            return "pro016";
            break;
        case "Earth house" : 
            return "pro017";
            break;
        case "Farm stay" : 
            return "pro018";
            break;
        case "Guesthouse" : 
            return "pro020";
            break;
        case "Hostel" : 
            return "pro021";
            break;
        case "Hotel" : 
            return "pro022";
            break;
        case "House" : 
            return "pro023";
            break;
        case "Houseboat" : 
            return "pro024";
            break;
        case "Island" : 
            return "pro025";
            break;
        case "Loft" : 
            return "pro026";
            break;
        case "Nature lodge" : 
            return "pro027";
            break;
        case "Other" : 
            return "pro028";
            break;
        case "Resort" : 
            return "pro029";
            break;
        case "Serviced apartment" : 
            return "pro030";
            break;
        case "Tent" : 
            return "pro031";
            break;
        case "Timeshare" : 
            return "pro032";
            break;
        case "Tiny house" : 
            return "pro033";
            break;
        case "Villa" : 
            return "pro034";
            break;
        case "Yurt" : 
            return "pro035";
            break;
        case "Guest suite" : 
            return "pro036";
            break;
        case "Townhouse" : 
            return "pro037";
            break;
            default : return null;

    }
}

function getRoomType (Data)
{   
    switch (Data)
    {
        case "Entire home/apt" : 
            return  "room001";
            break;           
        case "Hotel room" : 
            return  "room002";
            break;
        case "Private room" : 
            return  "room003";
            break;   
        case "Shared room" : 
            return  "room004";
            break;
        default : return null;
    }

}
AddDataDetail()