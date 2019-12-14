    var mysql = require('mysql');

    var con = mysql.createConnection({
        host: "localhost",
        user: "root",
        password: "",
        database : "kltn"
    });
    
    con.connect(function(err) {
        if (err) throw err;
        var sql = "SELECT Homestay_id,Homestay_description FROM `homestay`"
        con.query(sql, function (err, result) {
        if (err) throw err;
            
        
        for (var i=0 ; i< result.length;i++)
        {
            var originalword = String(result[i].Homestay_description);         
            var listingid = result[i].Homestay_id;
            // Bo cac ki tu dac biet
            var ignor = /[&\/\\#,+()$~%.'":*?<>{}]/;
            withoutnum =originalword.replace(/[0-9]/g, '');
            originalword = withoutnum.replace(ignor,'');
            // Chuyen ve chu thuong
            originalword = originalword.toLowerCase();
            // Tach Tu
            var natural = require('natural');
            var tokenizer = new natural.AggressiveTokenizer();
            var wordtoken = tokenizer.tokenize(originalword);
            // Loai bo tu dung
            sw = require('stopword')
            var  wordtoken = sw.removeStopwords(wordtoken)
            // Chuyen ve nguyen mau 
            var steam = require('wink-lemmatizer');
            var final =''
            wordtoken.forEach(element => {
                wordtoken = steam.verb(element);
                wordtoken = steam.adjective(wordtoken);
                wordtoken = steam.noun(wordtoken);
                if (final!=null)
                {
                final = final + ',' + wordtoken 
                } 
                else if(final = '')
                {
                final = wordtoken
                }
                else
                {
                final = null
                }
            });
           // console.log("---------------------------")
           // console.log(listingid)
            final = String(final).substring(1)
           // console.log(final)
            
            // Update 
           
            var sql = "UPDATE `homestay` SET Homestay_description_token ='" +  final + "' WHERE Homestay_id = " + listingid + "";
            con.query(sql, function (err, result) {
                if (err) throw err;
                console.log(result.affectedRows + " record(s) updated");
            });
           
        }
        })
        
    })

        
        
    function Loaibokitudacbiet( originalword )
    {
        //loai bo ki tu dac biet
        var ignor = /[&\/\\#,+()$~%.'":*?<>{}]/;
        withoutnum =originalword.replace(/[0-9]/g, '');
        originalword = withoutnum.replace(ignor,'');
        return originalword;
    }

    function Chuyenvechuthuong(originalword)
    {
          // Chuyen ve chu thuong
          originalword = originalword.toLowerCase();
          return originalword;
    }

    function Tachtu(originalword)
    {
        // tach tu
        var natural = require('natural');
        var tokenizer = new natural.AggressiveTokenizer();
        var wordtoken = tokenizer.tokenize(originalword);
        // Loai bo tu dung
         sw = require('stopword')
         var  wordtoken = sw.removeStopwords(wordtoken)
        return originalword
    
    }